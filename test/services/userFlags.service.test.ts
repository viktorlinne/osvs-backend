jest.mock("../../src/repositories/user.repo", () => ({
  getUserPublicById: jest.fn(),
}));

import * as userRepo from "../../src/repositories/user.repo";
import { getPublicUserById } from "../../src/services/users/read";

const mockedRepo = userRepo as jest.Mocked<typeof userRepo>;

const row = {
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
  accommodationAvailable: 1,
  mobile: "0700000000",
  homeNumber: null,
  city: "Karlskrona",
  address: "Gatan 1",
  zipcode: "37130",
  notes: null,
  feeExempt: 0,
  standingList: 1,
};

describe("users read service: admin flags", () => {
  beforeEach(() => {
    mockedRepo.getUserPublicById.mockResolvedValue(row);
  });

  it("includes feeExempt and standingList as booleans when requested", async () => {
    const user = await getPublicUserById(42, { includeAdminFlags: true });

    expect(user).toEqual(
      expect.objectContaining({ feeExempt: false, standingList: true }),
    );
  });

  it("omits the flags by default (member directory view)", async () => {
    const user = await getPublicUserById(42);

    expect(user).toBeDefined();
    expect(user).not.toHaveProperty("feeExempt");
    expect(user).not.toHaveProperty("standingList");
  });
});
