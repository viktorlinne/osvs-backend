jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), getConnection: jest.fn() },
}));

jest.mock("../../src/repositories/user.repo", () => ({
  findById: jest.fn(),
  updateUserProfile: jest.fn(),
  removeUserFromFutureEvents: jest.fn(),
  setUserRevokedAt: jest.fn(),
}));

jest.mock("../../src/services/tokenService", () => ({
  revokeAllRefreshTokensForUser: jest.fn(),
}));

jest.mock("../../src/services/users/geocoding", () => ({
  geocodeSwedishAddress: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as userRepo from "../../src/repositories/user.repo";
import { revokeAllRefreshTokensForUser } from "../../src/services/tokenService";
import { updateUserProfile } from "../../src/services/users/write";

const repo = userRepo as jest.Mocked<typeof userRepo>;
const revokeRefresh = revokeAllRefreshTokensForUser as jest.MockedFunction<
  typeof revokeAllRefreshTokensForUser
>;

beforeEach(() => {
  jest.clearAllMocks();
  repo.findById.mockResolvedValue({ matrikelnummer: 42, archive: null } as never);
});

describe("updateUserProfile archive (audit A-01)", () => {
  it("ends every session when a member is archived", async () => {
    await updateUserProfile(42, { archive: "Avförd" });

    expect(repo.removeUserFromFutureEvents).toHaveBeenCalledWith(42);
    expect(repo.setUserRevokedAt).toHaveBeenCalledWith(42, expect.any(Date));
    expect(revokeRefresh).toHaveBeenCalledWith(42);
  });

  it("leaves sessions alone for ordinary profile edits", async () => {
    await updateUserProfile(42, { archive: null, notes: "Ny anteckning" });

    expect(repo.setUserRevokedAt).not.toHaveBeenCalled();
    expect(revokeRefresh).not.toHaveBeenCalled();
  });
});
