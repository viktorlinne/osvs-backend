import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.mock("../../src/services/tokenService", () => ({
  isJtiRevoked: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  findById: jest.fn(),
  getUserRoles: jest.fn(),
}));

jest.mock("../../src/repositories/groups.repo", () => ({
  findGroupById: jest.fn(),
}));

jest.mock("../../src/repositories/mailings.repo", () => ({
  selectGroupRecipients: jest.fn(),
  selectUserEmail: jest.fn(),
  insertMailingWithOutbox: jest.fn(),
  listMailingsForGroup: jest.fn(),
  findMailingById: jest.fn(),
  listMailingRecipients: jest.fn(),
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

import groupsRouter from "../../src/routes/groups";
import mailingsRouter from "../../src/routes/mailings";
import errorHandler from "../../src/middleware/errorHandler";
import { findById, getUserRoles } from "../../src/services/userService";
import { isJtiRevoked } from "../../src/services/tokenService";
import * as groupsRepo from "../../src/repositories/groups.repo";
import * as mailingsRepo from "../../src/repositories/mailings.repo";

const mockedFindById = findById as jest.MockedFunction<typeof findById>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<typeof getUserRoles>;
const mockedIsJtiRevoked = isJtiRevoked as jest.MockedFunction<typeof isJtiRevoked>;
const groups = groupsRepo as jest.Mocked<typeof groupsRepo>;
const repo = mailingsRepo as jest.Mocked<typeof mailingsRepo>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/groups", groupsRouter);
  app.use("/mailings", mailingsRouter);
  app.use(errorHandler);
  return app;
}

function bearer(matrikelnummer = 4089) {
  const token = jwt.sign(
    { matrikelnummer, jti: "test-jti" },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
  return `Bearer ${token}`;
}

beforeEach(() => {
  mockedFindById.mockResolvedValue(undefined);
  mockedIsJtiRevoked.mockResolvedValue(false);
  mockedGetUserRoles.mockResolvedValue(["Editor"]);
  groups.findGroupById.mockResolvedValue({
    id: 5,
    name: "Planeringsgruppen",
    description: null,
    userIds: [1, 2, 3],
    memberCount: 3,
  });
  repo.selectGroupRecipients.mockResolvedValue([
    { uid: 1, email: "a@example.com", archive: null },
    { uid: 2, email: "b@example.com", archive: "Avförd" },
    { uid: 3, email: "saknas+9@osvs.invalid", archive: null },
  ]);
  repo.selectUserEmail.mockResolvedValue("editor@example.com");
  repo.insertMailingWithOutbox.mockResolvedValue(17);
  repo.listMailingsForGroup.mockResolvedValue([]);
});

describe("mailing routes: authorization", () => {
  const cases: Array<[string, string, object | undefined]> = [
    ["get", "/groups/5/mailings/preview", undefined],
    ["get", "/groups/5/mailings", undefined],
    ["post", "/groups/5/mailings", { subject: "S", body: "B" }],
    ["get", "/mailings/17", undefined],
  ];

  it.each(cases)("rejects unauthenticated %s %s", async (method, path, body) => {
    const agent = request(buildApp());
    const req = method === "post" ? agent.post(path).send(body) : agent.get(path);
    expect((await req).status).toBe(401);
  });

  it.each(cases)("returns 403 for Members on %s %s", async (method, path, body) => {
    mockedGetUserRoles.mockResolvedValue(["Member"]);
    const agent = request(buildApp());
    const req =
      method === "post"
        ? agent.post(path).set("Authorization", bearer()).send(body)
        : agent.get(path).set("Authorization", bearer());
    const response = await req;
    expect(response.status).toBe(403);
    expect(typeof response.body.message).toBe("string");
    expect(repo.insertMailingWithOutbox).not.toHaveBeenCalled();
  });
});

describe("POST /groups/:id/mailings", () => {
  it("queues the mailing and returns 202 with counts", async () => {
    const response = await request(buildApp())
      .post("/groups/5/mailings")
      .set("Authorization", bearer())
      .send({ subject: "  Kallelse  ", body: "Hej!\r\nVälkomna." });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      success: true,
      mailing: {
        id: 17,
        status: "queued",
        queued: 1,
        skipped: 2,
        skippedByReason: { archived: 1, placeholder: 1 },
      },
    });
    const [mailing] = repo.insertMailingWithOutbox.mock.calls[0];
    expect(mailing).toMatchObject({
      subject: "Kallelse",
      body: "Hej!\nVälkomna.",
      senderId: 4089,
      senderEmail: "editor@example.com",
    });
  });

  it.each([
    [{}, { subject: "Ämne är obligatoriskt", body: "Meddelande är obligatoriskt" }],
    [{ subject: "   ", body: "  " }, { subject: "Ämne är obligatoriskt", body: "Meddelande är obligatoriskt" }],
    [{ subject: "x".repeat(201), body: "ok" }, { subject: "Ämnet får vara högst 200 tecken" }],
    [{ subject: "ok", body: "x".repeat(20001) }, { body: "Meddelandet får vara högst 20000 tecken" }],
    [{ subject: "rad1\nrad2", body: "ok" }, { subject: "Ämnet får inte innehålla radbrytningar" }],
    [{ subject: 5, body: ["x"] }, { subject: "Ogiltigt ämne", body: "Ogiltigt meddelande" }],
  ])("rejects invalid input %#", async (body, fields) => {
    const response = await request(buildApp())
      .post("/groups/5/mailings")
      .set("Authorization", bearer())
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Formuläret innehåller fel");
    expect(response.body.details.fields).toEqual(fields);
    expect(repo.insertMailingWithOutbox).not.toHaveBeenCalled();
  });

  it("accepts the maximum lengths", async () => {
    const response = await request(buildApp())
      .post("/groups/5/mailings")
      .set("Authorization", bearer())
      .send({ subject: "x".repeat(200), body: "y".repeat(20000) });
    expect(response.status).toBe(202);
  });

  it("returns 404 for an unknown group", async () => {
    groups.findGroupById.mockResolvedValue(null);
    const response = await request(buildApp())
      .post("/groups/99/mailings")
      .set("Authorization", bearer())
      .send({ subject: "S", body: "B" });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Gruppen hittades inte");
  });

  it("returns 400 for a malformed group id", async () => {
    const response = await request(buildApp())
      .post("/groups/abc/mailings")
      .set("Authorization", bearer())
      .send({ subject: "S", body: "B" });
    expect(response.status).toBe(400);
  });
});

describe("GET endpoints", () => {
  it("returns the preview for Admin", async () => {
    mockedGetUserRoles.mockResolvedValue(["Admin"]);
    const response = await request(buildApp())
      .get("/groups/5/mailings/preview")
      .set("Authorization", bearer());
    expect(response.status).toBe(200);
    expect(response.body.preview).toMatchObject({
      recipients: 1,
      skipped: 2,
      skippedByReason: { archived: 1, placeholder: 1 },
      devAllowlist: { active: true },
    });
  });

  it("lists the group's mailings", async () => {
    const response = await request(buildApp())
      .get("/groups/5/mailings")
      .set("Authorization", bearer());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ mailings: [] });
    expect(repo.listMailingsForGroup).toHaveBeenCalledWith(5);
  });

  it("returns 404 for an unknown mailing", async () => {
    repo.findMailingById.mockResolvedValue(null);
    const response = await request(buildApp())
      .get("/mailings/123")
      .set("Authorization", bearer());
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Utskicket hittades inte");
  });
});
