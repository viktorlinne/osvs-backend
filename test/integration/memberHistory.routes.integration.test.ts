import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { getConnection: jest.fn(), query: jest.fn() },
}));

jest.mock("../../src/services/tokenService", () => ({
  isJtiRevoked: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  findById: jest.fn(),
  getUserRoles: jest.fn(),
}));

jest.mock("../../src/utils/fileUpload", () => ({
  uploadProfilePicture: (_req: unknown, _res: unknown, next: () => void) =>
    next(),
  getPublicUrl: jest.fn(),
}));

jest.mock("../../src/services/memberHistoryService", () => ({
  listOfficialEntries: jest.fn(),
  listAchievementEntries: jest.fn(),
  listChangeLog: jest.fn(),
  createOfficialEntry: jest.fn(),
  updateOfficialEntry: jest.fn(),
  deleteOfficialEntry: jest.fn(),
  createAchievementEntry: jest.fn(),
  updateAchievementEntry: jest.fn(),
  deleteAchievementEntry: jest.fn(),
  setMemberOngoingOfficials: jest.fn(),
  toSqlDateTime: jest.fn(() => "2026-10-21 12:00:00"),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child() {
      return this;
    },
  },
}));

import usersRouter from "../../src/routes/users";
import errorHandler from "../../src/middleware/errorHandler";
import { getUserRoles } from "../../src/services/userService";
import { isJtiRevoked } from "../../src/services/tokenService";
import * as historyService from "../../src/services/memberHistoryService";

const mockedGetUserRoles = getUserRoles as jest.MockedFunction<
  typeof getUserRoles
>;
const mockedIsJtiRevoked = isJtiRevoked as jest.MockedFunction<
  typeof isJtiRevoked
>;
const service = historyService as jest.Mocked<typeof historyService>;

function bearer(matrikelnummer: number) {
  const token = jwt.sign(
    { matrikelnummer, jti: "test-jti" },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
  return `Bearer ${token}`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/users", usersRouter);
  app.use(errorHandler);
  return app;
}

const validTjanst = {
  officialId: 2,
  appointedAt: "2019-01-15",
  unappointedAt: null,
  datesConfirmed: true,
  note: "Rättat datum",
};

beforeEach(() => {
  mockedIsJtiRevoked.mockResolvedValue(false);
  mockedGetUserRoles.mockResolvedValue(["Editor"]);
});

describe("member history routes", () => {
  it.each([
    ["get", "/api/users/7/history"],
    ["get", "/api/users/7/change-log"],
    ["post", "/api/users/7/officials"],
    ["put", "/api/users/7/officials/31"],
    ["delete", "/api/users/7/officials/31"],
    ["put", "/api/users/7/achievements/88"],
    ["delete", "/api/users/7/achievements/88"],
    ["post", "/api/users/7/achievements"],
  ] as const)("forbids a Member from %s %s", async (method, path) => {
    mockedGetUserRoles.mockResolvedValue(["Member"]);

    const agent = request(buildApp());
    const response = await agent[method](path)
      .set("Authorization", bearer(7))
      .send({ ...validTjanst, achievementId: 1, awardedAt: "2020-01-01" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Åtkomst nekad" });
    for (const fn of Object.values(service).filter((v) => jest.isMockFunction(v))) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it("requires authentication", async () => {
    const response = await request(buildApp()).get("/api/users/7/change-log");
    expect(response.status).toBe(401);
  });

  it("rejects a tjänst update without datesConfirmed and note with Swedish field errors", async () => {
    const response = await request(buildApp())
      .put("/api/users/7/officials/31")
      .set("Authorization", bearer(1))
      .send({ officialId: 2, appointedAt: "2019-01-15" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Formuläret innehåller fel");
    expect(response.body.details.fields).toEqual({
      datesConfirmed: "Bekräfta både startdatum och slutdatum innan du sparar",
      note: "Ange en anteckning som förklarar ändringen",
    });
    expect(service.updateOfficialEntry).not.toHaveBeenCalled();
  });

  it("rejects deleting an achievement entry without a note", async () => {
    const response = await request(buildApp())
      .delete("/api/users/7/achievements/88")
      .set("Authorization", bearer(1))
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.details.fields.note).toBe(
      "Ange en anteckning som förklarar ändringen",
    );
    expect(service.deleteAchievementEntry).not.toHaveBeenCalled();
  });

  it("lets an Editor update a tjänst entry and passes the editor id", async () => {
    service.updateOfficialEntry.mockResolvedValue({
      id: 31,
      officialId: 2,
      title: "Ordförande",
      appointedAt: "2019-01-15",
      unappointedAt: null,
    });

    const response = await request(buildApp())
      .put("/api/users/7/officials/31")
      .set("Authorization", bearer(1))
      .send(validTjanst);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(service.updateOfficialEntry).toHaveBeenCalledWith(
      7,
      31,
      {
        officialId: 2,
        appointedAt: "2019-01-15",
        unappointedAt: null,
        note: "Rättat datum",
      },
      1,
    );
  });

  it("lets an Admin read the change log", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);
    service.listChangeLog.mockResolvedValue([]);

    const response = await request(buildApp())
      .get("/api/users/7/change-log")
      .set("Authorization", bearer(1));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ entries: [] });
    expect(service.listChangeLog).toHaveBeenCalledWith(7);
  });

  it("logs awards made through the existing achievements endpoint", async () => {
    service.createAchievementEntry.mockResolvedValue({
      id: 90,
      achievementId: 1,
      title: "I",
      awardedAt: "2020-01-01",
    });

    const response = await request(buildApp())
      .post("/api/users/7/achievements")
      .set("Authorization", bearer(1))
      .send({ achievementId: 1, awardedAt: "2020-01-01", note: "Ny grad" });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(90);
    expect(service.createAchievementEntry).toHaveBeenCalledWith(
      7,
      { achievementId: 1, awardedAt: "2020-01-01", note: "Ny grad" },
      1,
    );
  });
});
