import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.mock("../../src/services/tokenService", () => ({
  isJtiRevoked: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  findById: jest.fn(),
  getUserRoles: jest.fn(),
  updateUserProfile: jest.fn(),
  getPublicUserById: jest.fn(),
  getUserAchievements: jest.fn(),
  getUserAllergies: jest.fn(),
  getUserOfficials: jest.fn(),
  getUserOfficialsHistory: jest.fn(),
}));

jest.mock("../../src/services/lodgeService", () => ({
  getUserLodge: jest.fn(),
  setUserLodge: jest.fn(),
}));

jest.mock("../../src/utils/fileUpload", () => ({
  getPublicUrl: jest.fn(),
  uploadProfilePicture: (_req: unknown, _res: unknown, next: () => void) =>
    next(),
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
import {
  findById,
  getPublicUserById,
  getUserAchievements,
  getUserAllergies,
  getUserOfficials,
  getUserOfficialsHistory,
  getUserRoles,
  updateUserProfile,
} from "../../src/services/userService";
import { isJtiRevoked } from "../../src/services/tokenService";
import { getPublicUrl } from "../../src/utils/fileUpload";

const mockedFindById = findById as jest.MockedFunction<typeof findById>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<
  typeof getUserRoles
>;
const mockedUpdateUserProfile = updateUserProfile as jest.MockedFunction<
  typeof updateUserProfile
>;
const mockedGetPublicUserById = getPublicUserById as jest.MockedFunction<
  typeof getPublicUserById
>;
const mockedIsJtiRevoked = isJtiRevoked as jest.MockedFunction<
  typeof isJtiRevoked
>;

const baseUser = {
  matrikelnummer: 42,
  email: "medlem@example.com",
  createdAt: "2020-01-01",
  picture: null,
  archive: null,
  firstname: "Sven",
  lastname: "Svensson",
  dateOfBirth: "1960-05-05",
  work: null,
  revokedAt: null,
  accommodationAvailable: 0,
  mobile: "0700000000",
  homeNumber: null,
  city: "Karlskrona",
  address: "Gatan 1",
  zipcode: "37130",
  notes: null,
  feeExempt: 1,
  standingList: 0,
};

function token(matrikelnummer: number) {
  return `Bearer ${jwt.sign(
    { matrikelnummer, jti: "test-jti" },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  )}`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/users", usersRouter);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  mockedIsJtiRevoked.mockResolvedValue(false);
  mockedFindById.mockResolvedValue(baseUser as never);
  mockedGetUserRoles.mockResolvedValue(["Member"]);
  mockedUpdateUserProfile.mockResolvedValue(undefined);
  (getPublicUrl as jest.Mock).mockResolvedValue("https://cdn.example.com/p.webp");
  (getUserAchievements as jest.Mock).mockResolvedValue([]);
  (getUserAllergies as jest.Mock).mockResolvedValue([]);
  (getUserOfficials as jest.Mock).mockResolvedValue([]);
  (getUserOfficialsHistory as jest.Mock).mockResolvedValue([]);
});

describe("PUT /users/:matrikelnummer user flags", () => {
  it.each([["Admin"], ["Editor"]] as const)(
    "lets %s set feeExempt and standingList and returns them",
    async (role) => {
      mockedGetUserRoles.mockResolvedValue([role]);

      const response = await request(buildApp())
        .put("/users/42")
        .set("Authorization", token(7))
        .send({ feeExempt: true, standingList: false });

      expect(response.status).toBe(200);
      expect(mockedUpdateUserProfile).toHaveBeenCalledWith(42, {
        feeExempt: true,
        standingList: false,
      });
      expect(response.body.user).toEqual(
        expect.objectContaining({ feeExempt: true, standingList: false }),
      );
    },
  );

  it("forbids members from setting the flags on another user", async () => {
    mockedGetUserRoles.mockResolvedValue(["Member"]);

    const response = await request(buildApp())
      .put("/users/42")
      .set("Authorization", token(7))
      .send({ standingList: true });

    expect(response.status).toBe(403);
    expect(mockedUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("rejects non-boolean flag values with field errors", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const response = await request(buildApp())
      .put("/users/42")
      .set("Authorization", token(7))
      .send({ feeExempt: "ja", standingList: null });

    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual({
      feeExempt: "Ogiltigt värde",
      standingList: "Ogiltigt värde",
    });
    expect(mockedUpdateUserProfile).not.toHaveBeenCalled();
  });
});

describe("PUT /users/me user flags", () => {
  it("rejects self-service changes to the flags, even for Admin", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);

    const response = await request(buildApp())
      .put("/users/me")
      .set("Authorization", token(42))
      .send({ firstname: "Sven", feeExempt: true });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Åtkomst nekad");
    expect(mockedUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("ignores archive in self-service updates", async () => {
    const response = await request(buildApp())
      .put("/users/me")
      .set("Authorization", token(42))
      .send({ firstname: "Sven", archive: "Avliden" });

    expect(response.status).toBe(200);
    expect(mockedUpdateUserProfile).toHaveBeenCalledWith(42, { firstname: "Sven" });
  });

  it("does not expose the flags in the self-service response", async () => {
    const response = await request(buildApp())
      .put("/users/me")
      .set("Authorization", token(42))
      .send({ firstname: "Sven" });

    expect(response.status).toBe(200);
    expect(response.body.user).not.toHaveProperty("feeExempt");
    expect(response.body.user).not.toHaveProperty("standingList");
  });
});

describe("GET /users/:matrikelnummer user flags", () => {
  it("asks for the flags when the caller is Admin/Editor", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);
    mockedGetPublicUserById.mockResolvedValue({
      matrikelnummer: 42,
      feeExempt: true,
      standingList: false,
    } as never);

    const response = await request(buildApp())
      .get("/users/42")
      .set("Authorization", token(7));

    expect(response.status).toBe(200);
    expect(mockedGetPublicUserById).toHaveBeenCalledWith(42, {
      includeAdminFlags: true,
    });
    expect(response.body.user.feeExempt).toBe(true);
  });

  it("does not ask for the flags when the caller is a plain member", async () => {
    mockedGetUserRoles.mockResolvedValue(["Member"]);
    mockedGetPublicUserById.mockResolvedValue({ matrikelnummer: 42 } as never);

    const response = await request(buildApp())
      .get("/users/42")
      .set("Authorization", token(7));

    expect(response.status).toBe(200);
    expect(mockedGetPublicUserById).toHaveBeenCalledWith(42, {
      includeAdminFlags: false,
    });
  });
});
