import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.mock("../../src/services/tokenService", () => ({
  isJtiRevoked: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  findById: jest.fn(),
  getUserRoles: jest.fn(),
}));

jest.mock("../../src/repositories/groups.repo", () => ({
  listGroups: jest.fn(),
  findGroupById: jest.fn(),
  findGroupIdByName: jest.fn(),
  insertGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  listGroupMembers: jest.fn(),
  selectExistingUserIds: jest.fn(),
  selectMemberIdsInGroup: jest.fn(),
  insertMemberships: jest.fn(),
  deleteMembership: jest.fn(),
  selectUserIdsForGroups: jest.fn(),
}));

// The groups router also mounts the mailing endpoints (covered in
// mailings.integration.test.ts); keep this suite free of a real DB pool.
jest.mock("../../src/repositories/mailings.repo", () => ({}));

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
import errorHandler from "../../src/middleware/errorHandler";
import { findById, getUserRoles } from "../../src/services/userService";
import { isJtiRevoked } from "../../src/services/tokenService";
import * as groupsRepo from "../../src/repositories/groups.repo";
import type { Group } from "../../src/types";

const mockedFindById = findById as jest.MockedFunction<typeof findById>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<typeof getUserRoles>;
const mockedIsJtiRevoked = isJtiRevoked as jest.MockedFunction<typeof isJtiRevoked>;
const repo = groupsRepo as jest.Mocked<typeof groupsRepo>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/groups", groupsRouter);
  app.use(errorHandler);
  return app;
}

function bearer(matrikelnummer = 1) {
  const token = jwt.sign(
    { matrikelnummer, jti: "test-jti" },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
  return `Bearer ${token}`;
}

const sampleGroup: Group = {
  id: 5,
  name: "Planeringsgruppen",
  description: "Planering",
  userIds: [1, 9],
  memberCount: 2,
};

beforeEach(() => {
  mockedFindById.mockResolvedValue(undefined);
  mockedIsJtiRevoked.mockResolvedValue(false);
  mockedGetUserRoles.mockResolvedValue(["Admin"]);
  repo.findGroupById.mockResolvedValue(sampleGroup);
  repo.findGroupIdByName.mockResolvedValue(null);
  repo.insertGroup.mockResolvedValue(42);
  repo.updateGroup.mockResolvedValue(undefined);
  repo.deleteGroup.mockResolvedValue(1);
  repo.selectExistingUserIds.mockImplementation(async (ids) => ids);
  repo.selectMemberIdsInGroup.mockResolvedValue([]);
  repo.insertMemberships.mockResolvedValue(undefined);
  repo.deleteMembership.mockResolvedValue(1);
});

describe("groups routes: authorization", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await request(buildApp()).get("/groups");
    expect(response.status).toBe(401);
  });

  it("keeps GET /groups available to members and includes memberCount", async () => {
    mockedGetUserRoles.mockResolvedValue(["Member"]);
    repo.listGroups.mockResolvedValue([sampleGroup]);

    const response = await request(buildApp())
      .get("/groups")
      .set("Authorization", bearer());

    expect(response.status).toBe(200);
    expect(response.body.groups[0]).toEqual({
      id: 5,
      name: "Planeringsgruppen",
      description: "Planering",
      userIds: [1, 9],
      memberCount: 2,
    });
  });

  it.each([
    ["post", "/groups", { name: "Ny" }],
    ["put", "/groups/5", { name: "Ny" }],
    ["delete", "/groups/5", undefined],
    ["post", "/groups/5/members", { userIds: [3] }],
    ["delete", "/groups/5/members/3", undefined],
  ] as const)("forbids Member from %s %s", async (method, path, body) => {
    mockedGetUserRoles.mockResolvedValue(["Member"]);

    const req = request(buildApp())[method](path).set("Authorization", bearer(12));
    const response = body ? await req.send(body) : await req;

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Åtkomst nekad" });
    expect(repo.insertGroup).not.toHaveBeenCalled();
    expect(repo.updateGroup).not.toHaveBeenCalled();
    expect(repo.deleteGroup).not.toHaveBeenCalled();
    expect(repo.insertMemberships).not.toHaveBeenCalled();
    expect(repo.deleteMembership).not.toHaveBeenCalled();
  });

  it("allows Editor to create a group", async () => {
    mockedGetUserRoles.mockResolvedValue(["Editor"]);

    const response = await request(buildApp())
      .post("/groups")
      .set("Authorization", bearer())
      .send({ name: "  Resegruppen  ", description: "" });

    expect(response.status).toBe(201);
    expect(repo.insertGroup).toHaveBeenCalledWith("Resegruppen", null);
    expect(response.body).toEqual({
      success: true,
      id: 42,
      group: {
        id: 42,
        name: "Resegruppen",
        description: null,
        userIds: [],
        memberCount: 0,
      },
    });
  });
});

describe("groups routes: validation", () => {
  it("requires a name on create", async () => {
    const response = await request(buildApp())
      .post("/groups")
      .set("Authorization", bearer())
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual({
      name: "Namn är obligatoriskt",
    });
    expect(repo.insertGroup).not.toHaveBeenCalled();
  });

  it("rejects too long names and non-string descriptions", async () => {
    const response = await request(buildApp())
      .post("/groups")
      .set("Authorization", bearer())
      .send({ name: "x".repeat(256), description: 5 });

    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual({
      name: "Namnet får vara högst 255 tecken",
      description: "Ogiltig beskrivning",
    });
  });

  it("returns 409 with a field error for a duplicate name", async () => {
    repo.findGroupIdByName.mockResolvedValue(7);

    const response = await request(buildApp())
      .post("/groups")
      .set("Authorization", bearer())
      .send({ name: "planeringsgruppen" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Det finns redan en grupp med det namnet",
      details: { fields: { name: "Det finns redan en grupp med det namnet" } },
    });
    expect(repo.insertGroup).not.toHaveBeenCalled();
  });

  it("rejects an empty update", async () => {
    const response = await request(buildApp())
      .put("/groups/5")
      .set("Authorization", bearer())
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Inget att uppdatera");
  });

  it("rejects invalid group ids", async () => {
    const response = await request(buildApp())
      .get("/groups/abc/members")
      .set("Authorization", bearer());

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Ogiltigt grupp-id");
  });

  it("requires at least one valid user id when adding members", async () => {
    const app = buildApp();
    const empty = await request(app)
      .post("/groups/5/members")
      .set("Authorization", bearer())
      .send({ userIds: [] });
    const invalid = await request(app)
      .post("/groups/5/members")
      .set("Authorization", bearer())
      .send({ userIds: [3, "x"] });

    expect(empty.status).toBe(400);
    expect(empty.body.details.fields.userIds).toBe("Välj minst en medlem");
    expect(invalid.status).toBe(400);
    expect(invalid.body.details.fields.userIds).toBe("Ogiltigt matrikelnummer");
    expect(repo.insertMemberships).not.toHaveBeenCalled();
  });

  it("rejects unknown users with a field error", async () => {
    repo.selectExistingUserIds.mockResolvedValue([3]);

    const response = await request(buildApp())
      .post("/groups/5/members")
      .set("Authorization", bearer())
      .send({ userIds: [3, 999] });

    expect(response.status).toBe(400);
    expect(response.body.details.fields.userIds).toBe(
      "Medlemmen med matrikelnummer 999 finns inte",
    );
    expect(repo.insertMemberships).not.toHaveBeenCalled();
  });
});

describe("groups routes: not found", () => {
  beforeEach(() => {
    repo.findGroupById.mockResolvedValue(null);
    repo.deleteGroup.mockResolvedValue(0);
  });

  it.each([
    ["get", "/groups/99", undefined],
    ["put", "/groups/99", { name: "Ny" }],
    ["delete", "/groups/99", undefined],
    ["get", "/groups/99/members", undefined],
    ["post", "/groups/99/members", { userIds: [3] }],
    ["delete", "/groups/99/members/3", undefined],
  ] as const)("returns 404 for %s %s", async (method, path, body) => {
    const req = request(buildApp())[method](path).set("Authorization", bearer());
    const response = body ? await req.send(body) : await req;

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Gruppen hittades inte" });
  });

  it("returns 404 when removing a user who is not a member", async () => {
    repo.findGroupById.mockResolvedValue(sampleGroup);
    repo.deleteMembership.mockResolvedValue(0);

    const response = await request(buildApp())
      .delete("/groups/5/members/3")
      .set("Authorization", bearer());

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Medlemmen finns inte i gruppen");
  });
});

describe("groups routes: updates and membership", () => {
  it("skips the duplicate-name check when only the case changes", async () => {
    const response = await request(buildApp())
      .put("/groups/5")
      .set("Authorization", bearer())
      .send({ name: "PLANERINGSGRUPPEN", description: null });

    expect(response.status).toBe(200);
    expect(repo.findGroupIdByName).not.toHaveBeenCalled();
    expect(repo.updateGroup).toHaveBeenCalledWith(5, {
      name: "PLANERINGSGRUPPEN",
      description: null,
    });
  });

  it("checks the new name against other groups on rename", async () => {
    repo.findGroupIdByName.mockResolvedValue(8);

    const response = await request(buildApp())
      .put("/groups/5")
      .set("Authorization", bearer())
      .send({ name: "Resegruppen" });

    expect(response.status).toBe(409);
    expect(repo.findGroupIdByName).toHaveBeenCalledWith("Resegruppen", 5);
    expect(repo.updateGroup).not.toHaveBeenCalled();
  });

  it("deletes a group", async () => {
    const response = await request(buildApp())
      .delete("/groups/5")
      .set("Authorization", bearer());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(repo.deleteGroup).toHaveBeenCalledWith(5);
  });

  it("treats duplicate memberships as idempotent", async () => {
    repo.selectMemberIdsInGroup.mockResolvedValue([9]);

    const response = await request(buildApp())
      .post("/groups/5/members")
      .set("Authorization", bearer())
      .send({ userIds: [9, 3, "3"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      added: [3],
      alreadyMembers: [9],
    });
    expect(repo.insertMemberships).toHaveBeenCalledWith(5, [3]);
  });

  it("lists members of a group", async () => {
    repo.listGroupMembers.mockResolvedValue([
      {
        matrikelnummer: 9,
        firstname: "Anders",
        lastname: "Andersson",
        email: "anders@example.com",
        archive: null,
      },
    ]);

    const response = await request(buildApp())
      .get("/groups/5/members")
      .set("Authorization", bearer());

    expect(response.status).toBe(200);
    expect(response.body.members).toHaveLength(1);
    expect(repo.listGroupMembers).toHaveBeenCalledWith(5);
  });

  it("removes a member", async () => {
    const response = await request(buildApp())
      .delete("/groups/5/members/9")
      .set("Authorization", bearer());

    expect(response.status).toBe(200);
    expect(repo.deleteMembership).toHaveBeenCalledWith(5, 9);
  });
});
