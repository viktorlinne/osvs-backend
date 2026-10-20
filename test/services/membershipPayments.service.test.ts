jest.mock("../../src/repositories", () => ({
  membershipRepo: {
    insertMembershipPayment: jest.fn(),
    findById: jest.fn(),
    updatePaymentStatus: jest.fn(),
    listAllPaymentsWithUser: jest.fn(),
    findPaymentsForUser: jest.fn(),
    findPaymentsForUsers: jest.fn(),
    findExistingForUsers: jest.fn(),
    findFeeExemptUserIds: jest.fn(),
    bulkInsertIfMissing: jest.fn(),
  },
}));

import { membershipRepo } from "../../src/repositories";
import {
  createMembershipPaymentsIfMissingBulk,
  setMembershipPaymentStatus,
  listMembershipPaymentsForUser,
} from "../../src/services/membershipPaymentsService";

const mockedRepo = membershipRepo as jest.Mocked<typeof membershipRepo>;

describe("membershipPaymentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates membership payment status", async () => {
    mockedRepo.updatePaymentStatus.mockResolvedValue(undefined);
    mockedRepo.findById.mockResolvedValue({
      id: 3,
      uid: 7,
      amount: 600,
      year: 2026,
      status: "Paid",
    });

    const payment = await setMembershipPaymentStatus(3, "Paid");

    expect(mockedRepo.updatePaymentStatus).toHaveBeenCalledWith(3, "Paid");
    expect(payment).toEqual({
      id: 3,
      uid: 7,
      amount: 600,
      year: 2026,
      status: "Paid",
      createdAt: undefined,
      updatedAt: undefined,
    });
  });

  it("returns null when updated payment row is invalid", async () => {
    mockedRepo.updatePaymentStatus.mockResolvedValue(undefined);
    mockedRepo.findById.mockResolvedValue({ id: "bad" });

    const payment = await setMembershipPaymentStatus(3, "Pending");

    expect(payment).toBeNull();
  });

  it("lists membership payments for a user", async () => {
    mockedRepo.findPaymentsForUser.mockResolvedValue([
      {
        id: 1,
        uid: 9,
        amount: 600,
        year: 2026,
        status: "Pending",
      },
    ]);

    const payments = await listMembershipPaymentsForUser(9);

    expect(mockedRepo.findPaymentsForUser).toHaveBeenCalledWith(9);
    expect(payments).toEqual([
      {
        id: 1,
        uid: 9,
        amount: 600,
        year: 2026,
        status: "Pending",
        createdAt: undefined,
        updatedAt: undefined,
      },
    ]);
  });

  describe("createMembershipPaymentsIfMissingBulk (yearly job)", () => {
    it("skips fee-exempt members and only creates missing payments for the rest", async () => {
      mockedRepo.findFeeExemptUserIds.mockResolvedValue([2]);
      mockedRepo.findExistingForUsers.mockResolvedValue([{ uid: 3 }]);
      mockedRepo.bulkInsertIfMissing.mockResolvedValue(undefined);
      mockedRepo.findPaymentsForUsers.mockResolvedValue([]);

      await createMembershipPaymentsIfMissingBulk([1, 2, 3], 2026);

      expect(mockedRepo.findFeeExemptUserIds).toHaveBeenCalledWith([1, 2, 3]);
      expect(mockedRepo.findExistingForUsers).toHaveBeenCalledWith(2026, [1, 3]);
      expect(mockedRepo.bulkInsertIfMissing).toHaveBeenCalledWith([
        [1, 600, 2026, "Pending"],
      ]);
      expect(mockedRepo.findPaymentsForUsers).toHaveBeenCalledWith(2026, [1, 3]);
    });

    it("creates nothing and touches no existing payments when everyone is exempt", async () => {
      mockedRepo.findFeeExemptUserIds.mockResolvedValue([4, 5]);

      const result = await createMembershipPaymentsIfMissingBulk([4, 5], 2026);

      expect(result).toEqual([]);
      expect(mockedRepo.findExistingForUsers).not.toHaveBeenCalled();
      expect(mockedRepo.bulkInsertIfMissing).not.toHaveBeenCalled();
      expect(mockedRepo.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it("creates payments for everyone when nobody is exempt", async () => {
      mockedRepo.findFeeExemptUserIds.mockResolvedValue([]);
      mockedRepo.findExistingForUsers.mockResolvedValue([]);
      mockedRepo.bulkInsertIfMissing.mockResolvedValue(undefined);
      mockedRepo.findPaymentsForUsers.mockResolvedValue([]);

      await createMembershipPaymentsIfMissingBulk([8, 9], 2027, 700);

      expect(mockedRepo.bulkInsertIfMissing).toHaveBeenCalledWith([
        [8, 700, 2027, "Pending"],
        [9, 700, 2027, "Pending"],
      ]);
    });
  });
});
