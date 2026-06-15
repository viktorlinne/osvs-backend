jest.mock("../../src/repositories", () => ({
  membershipRepo: {
    insertMembershipPayment: jest.fn(),
    findById: jest.fn(),
    updatePaymentStatus: jest.fn(),
    listAllPaymentsWithUser: jest.fn(),
    findPaymentsForUser: jest.fn(),
    findPaymentsForUsers: jest.fn(),
    findExistingForUsers: jest.fn(),
    bulkInsertIfMissing: jest.fn(),
  },
}));

import { membershipRepo } from "../../src/repositories";
import {
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
});
