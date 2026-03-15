jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
  },
}));

jest.mock("../../src/repositories", () => ({
  allergiesRepo: {
    listAllergies: jest.fn(),
  },
  membershipRepo: {
    insertMembershipPayment: jest.fn(),
  },
}));

jest.mock("../../src/repositories/user.repo", () => ({
  findById: jest.fn(),
  insertUser: jest.fn(),
  assignDefaultRoleToUser: jest.fn(),
  lodgeExists: jest.fn(),
  assignUserToLodge: jest.fn(),
  setUserAllergies: jest.fn(),
  setUserAchievement: jest.fn(),
  updateUserGeocode: jest.fn(),
}));

jest.mock("../../src/services/users/read", () => ({
  findById: jest.fn(),
}));

jest.mock("../../src/services/users/geocoding", () => ({
  geocodeSwedishAddress: jest.fn(),
}));

jest.mock("../../src/services/tokenService", () => ({
  revokeAllRefreshTokensForUser: jest.fn(),
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

import pool from "../../src/config/db";
import { allergiesRepo, membershipRepo } from "../../src/repositories";
import * as userRepo from "../../src/repositories/user.repo";
import { findById } from "../../src/services/users/read";
import { geocodeSwedishAddress } from "../../src/services/users/geocoding";
import { ValidationError } from "../../src/utils/errors";
import { createUser } from "../../src/services/users/write";

const mockedPool = pool as unknown as {
  getConnection: jest.Mock;
};

const mockedAllergiesRepo = allergiesRepo as {
  listAllergies: jest.Mock;
};

const mockedMembershipRepo = membershipRepo as unknown as {
  insertMembershipPayment: jest.Mock;
};

const mockedUserRepo = userRepo as jest.Mocked<typeof userRepo>;
const mockedFindById = findById as jest.MockedFunction<typeof findById>;
const mockedGeocodeSwedishAddress =
  geocodeSwedishAddress as jest.MockedFunction<typeof geocodeSwedishAddress>;

function createConnectionMock() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe("users.write.createUser", () => {
  beforeEach(() => {
    mockedUserRepo.insertUser.mockResolvedValue(101);
    mockedUserRepo.assignDefaultRoleToUser.mockResolvedValue(undefined);
    mockedUserRepo.lodgeExists.mockResolvedValue(true);
    mockedUserRepo.assignUserToLodge.mockResolvedValue(undefined);
    mockedUserRepo.setUserAllergies.mockResolvedValue(undefined);
    mockedUserRepo.setUserAchievement.mockResolvedValue(1);
    mockedUserRepo.updateUserGeocode.mockResolvedValue(undefined);
    mockedUserRepo.findById.mockResolvedValue({
      matrikelnummer: 101,
      email: "new.member@example.com",
      createdAt: "2026-03-15T10:00:00.000Z",
      firstname: "Ny",
      lastname: "Medlem",
      dateOfBirth: "1990-01-01",
      mobile: "0700000000",
      city: "Karlskrona",
      address: "Gatan 1",
      zipcode: "37130",
      picture: "profiles/member.webp",
    });
    mockedFindById.mockResolvedValue({
      matrikelnummer: 101,
      email: "new.member@example.com",
      createdAt: "2026-03-15T10:00:00.000Z",
      firstname: "Ny",
      lastname: "Medlem",
      dateOfBirth: "1990-01-01",
      mobile: "0700000000",
      city: "Karlskrona",
      address: "Gatan 1",
      zipcode: "37130",
      picture: "profiles/member.webp",
    });
    mockedAllergiesRepo.listAllergies.mockResolvedValue([
      { id: 1, title: "Gluten" },
      { id: 3, title: "Laktos" },
    ]);
    mockedMembershipRepo.insertMembershipPayment.mockResolvedValue(9);
    mockedGeocodeSwedishAddress.mockResolvedValue({
      ok: false,
      reason: "NO_RESULT",
      queryHash: "query-hash",
      queryText: "gatan 1, 37130 karlskrona, sweden",
      fromCache: false,
    });
  });

  it("persists lodge, allergies, payment, and default achievement in one transaction", async () => {
    const conn = createConnectionMock();
    mockedPool.getConnection.mockResolvedValue(conn);

    const user = await createUser(
      {
        email: "new.member@example.com",
        passwordHash: "hashed-password",
        firstname: "Ny",
        lastname: "Medlem",
        dateOfBirth: "1990-01-01",
        mobile: "0700000000",
        city: "Karlskrona",
        address: "Gatan 1",
        zipcode: "37130",
        picture: "profiles/member.webp",
      },
      {
        lodgeId: 2,
        allergyIds: [1, 3],
      },
    );

    expect(conn.beginTransaction).toHaveBeenCalled();
    expect(mockedUserRepo.assignUserToLodge).toHaveBeenCalledWith(101, 2, conn);
    expect(mockedUserRepo.setUserAllergies).toHaveBeenCalledWith(101, [1, 3], conn);
    expect(mockedMembershipRepo.insertMembershipPayment).toHaveBeenCalledWith(
      {
        uid: 101,
        amount: 600,
        year: new Date().getFullYear(),
      },
      conn,
    );
    expect(mockedUserRepo.setUserAchievement).toHaveBeenCalledWith(
      101,
      1,
      undefined,
      conn,
    );
    expect(conn.commit).toHaveBeenCalled();
    expect(user?.matrikelnummer).toBe(101);
  });

  it("rolls back when allergy ids are invalid", async () => {
    const conn = createConnectionMock();
    mockedPool.getConnection.mockResolvedValue(conn);
    mockedAllergiesRepo.listAllergies.mockResolvedValue([{ id: 1, title: "Gluten" }]);

    await expect(
      createUser(
        {
          email: "new.member@example.com",
          passwordHash: "hashed-password",
          firstname: "Ny",
          lastname: "Medlem",
          dateOfBirth: "1990-01-01",
          mobile: "0700000000",
          city: "Karlskrona",
          address: "Gatan 1",
          zipcode: "37130",
          picture: "profiles/member.webp",
        },
        {
          allergyIds: [99],
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(conn.rollback).toHaveBeenCalled();
    expect(mockedUserRepo.setUserAllergies).not.toHaveBeenCalled();
    expect(mockedMembershipRepo.insertMembershipPayment).not.toHaveBeenCalled();
  });
});
