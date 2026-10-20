jest.mock("../../src/repositories/events.repo", () => ({
  selectInvitedUserIds: jest.fn(),
  replaceEventLodges: jest.fn(),
  replaceEventGroups: jest.fn(),
  replaceEventUsers: jest.fn(),
  findUsersInLodge: jest.fn(),
  deleteEventAttendancesForUids: jest.fn(),
  deleteEventPaymentsForUids: jest.fn(),
  bulkInsertEventAttendances: jest.fn(),
  bulkInsertEventPayments: jest.fn(),
  selectEventPrice: jest.fn(),
  updatePendingEventPaymentsAmount: jest.fn(),
  selectEventLodgeIds: jest.fn(),
  selectGroupIdsForEvent: jest.fn(),
  selectUserIdsForEvent: jest.fn(),
  selectStandingListUserIds: jest.fn(),
}));

jest.mock("../../src/repositories/groups.repo", () => ({
  selectUserIdsForGroups: jest.fn(),
}));

import * as eventsRepo from "../../src/repositories/events.repo";
import * as groupsRepo from "../../src/repositories/groups.repo";
import { syncEventAudience } from "../../src/services/events/audience";

const mockedEventsRepo = eventsRepo as jest.Mocked<typeof eventsRepo>;
const mockedGroupsRepo = groupsRepo as jest.Mocked<typeof groupsRepo>;

describe("events audience sync", () => {
  beforeEach(() => {
    mockedEventsRepo.selectInvitedUserIds.mockResolvedValue([]);
    mockedEventsRepo.replaceEventLodges.mockResolvedValue(undefined);
    mockedEventsRepo.replaceEventGroups.mockResolvedValue(undefined);
    mockedEventsRepo.replaceEventUsers.mockResolvedValue(undefined);
    mockedEventsRepo.findUsersInLodge.mockResolvedValue([]);
    mockedEventsRepo.deleteEventAttendancesForUids.mockResolvedValue(undefined);
    mockedEventsRepo.deleteEventPaymentsForUids.mockResolvedValue(undefined);
    mockedEventsRepo.bulkInsertEventAttendances.mockResolvedValue(undefined);
    mockedEventsRepo.bulkInsertEventPayments.mockResolvedValue(undefined);
    mockedEventsRepo.selectEventPrice.mockResolvedValue(275);
    mockedEventsRepo.updatePendingEventPaymentsAmount.mockResolvedValue(undefined);
    mockedGroupsRepo.selectUserIdsForGroups.mockResolvedValue([]);
    mockedEventsRepo.selectStandingListUserIds.mockResolvedValue([]);
  });

  it("dedupes overlapping lodge, group, and direct user coverage", async () => {
    mockedEventsRepo.selectInvitedUserIds.mockResolvedValue([1, 2]);
    mockedEventsRepo.findUsersInLodge.mockResolvedValue([{ uid: 1 }, { uid: 2 }]);
    mockedGroupsRepo.selectUserIdsForGroups.mockResolvedValue([2, 3]);

    await syncEventAudience(
      9,
      {
        lodgeIds: [1, 1],
        groupIds: [5],
        userIds: [3, 4, 4],
      },
      { price: 275 },
    );

    expect(mockedEventsRepo.replaceEventLodges).toHaveBeenCalledWith(
      9,
      [1],
      undefined,
    );
    expect(mockedEventsRepo.replaceEventGroups).toHaveBeenCalledWith(
      9,
      [5],
      undefined,
    );
    expect(mockedEventsRepo.replaceEventUsers).toHaveBeenCalledWith(
      9,
      [3, 4],
      undefined,
    );
    expect(mockedEventsRepo.deleteEventAttendancesForUids).not.toHaveBeenCalled();
    expect(mockedEventsRepo.deleteEventPaymentsForUids).not.toHaveBeenCalled();
    expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
      [
        [3, 9, 2, 0, 0],
        [4, 9, 2, 0, 0],
      ],
      undefined,
    );
    expect(mockedEventsRepo.bulkInsertEventPayments).toHaveBeenCalledWith(
      [
        [3, 9, 275, "Pending"],
        [4, 9, 275, "Pending"],
      ],
      undefined,
    );
  });

  it("preserves users who stay covered when the lodge source is switched", async () => {
    mockedEventsRepo.selectInvitedUserIds.mockResolvedValue([1, 2, 3]);
    mockedEventsRepo.findUsersInLodge.mockResolvedValue([{ uid: 4 }, { uid: 5 }]);
    mockedGroupsRepo.selectUserIdsForGroups.mockResolvedValue([3, 4]);

    await syncEventAudience(
      10,
      {
        lodgeIds: [4],
        groupIds: [5],
        userIds: [3],
      },
      { price: 325 },
    );

    expect(mockedEventsRepo.deleteEventAttendancesForUids).toHaveBeenCalledWith(
      10,
      [1, 2],
      undefined,
    );
    expect(mockedEventsRepo.deleteEventPaymentsForUids).toHaveBeenCalledWith(
      10,
      [1, 2],
      undefined,
    );
    expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
      [
        [4, 10, 2, 0, 0],
        [5, 10, 2, 0, 0],
      ],
      undefined,
    );
    expect(mockedEventsRepo.bulkInsertEventPayments).toHaveBeenCalledWith(
      [
        [4, 10, 325, "Pending"],
        [5, 10, 325, "Pending"],
      ],
      undefined,
    );
  });

  it("creates canonical invite rows for group-only audiences", async () => {
    mockedGroupsRepo.selectUserIdsForGroups.mockResolvedValue([7, 8]);

    await syncEventAudience(
      6,
      {
        lodgeIds: [],
        groupIds: [3],
        userIds: [],
      },
      { price: 0 },
    );

    expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
      [
        [7, 6, 2, 0, 0],
        [8, 6, 2, 0, 0],
      ],
      undefined,
    );
    expect(mockedEventsRepo.bulkInsertEventPayments).toHaveBeenCalledWith(
      [
        [7, 6, 0, "Pending"],
        [8, 6, 0, "Pending"],
      ],
      undefined,
    );
  });

  it("creates canonical invite rows for user-only audiences", async () => {
    await syncEventAudience(
      7,
      {
        lodgeIds: [],
        groupIds: [],
        userIds: [5, 6, 12],
      },
      { price: 180 },
    );

    expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
      [
        [5, 7, 2, 0, 0],
        [6, 7, 2, 0, 0],
        [12, 7, 2, 0, 0],
      ],
      undefined,
    );
    expect(mockedEventsRepo.bulkInsertEventPayments).toHaveBeenCalledWith(
      [
        [5, 7, 180, "Pending"],
        [6, 7, 180, "Pending"],
        [12, 7, 180, "Pending"],
      ],
      undefined,
    );
  });

  it("reprices pending payments without touching canonical invite membership", async () => {
    mockedEventsRepo.selectInvitedUserIds.mockResolvedValue([1]);
    mockedEventsRepo.findUsersInLodge.mockResolvedValue([{ uid: 1 }]);

    await syncEventAudience(
      14,
      {
        lodgeIds: [5],
        groupIds: [],
        userIds: [],
      },
      { price: 350, repricePending: true },
    );

    expect(mockedEventsRepo.updatePendingEventPaymentsAmount).toHaveBeenCalledWith(
      14,
      350,
      undefined,
    );
    expect(mockedEventsRepo.deleteEventAttendancesForUids).not.toHaveBeenCalled();
    expect(mockedEventsRepo.bulkInsertEventAttendances).not.toHaveBeenCalled();
  });

  describe("standing list prefill (OSVS-28)", () => {
    it("prefills going + food for standing-list invitees when the event has food", async () => {
      mockedEventsRepo.findUsersInLodge.mockResolvedValue([{ uid: 1 }, { uid: 2 }]);
      mockedGroupsRepo.selectUserIdsForGroups.mockResolvedValue([3]);
      mockedEventsRepo.selectStandingListUserIds.mockResolvedValue([2, 3]);

      await syncEventAudience(
        20,
        { lodgeIds: [4], groupIds: [6], userIds: [] },
        { price: 250, prefillStandingList: { food: true } },
      );

      expect(mockedEventsRepo.selectStandingListUserIds).toHaveBeenCalledWith(
        [1, 2, 3],
        undefined,
      );
      expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
        [
          [1, 20, 2, 0, 0],
          [2, 20, 1, 1, 0],
          [3, 20, 1, 1, 0],
        ],
        undefined,
      );
      // Payments are unchanged by the prefill.
      expect(mockedEventsRepo.bulkInsertEventPayments).toHaveBeenCalledWith(
        [
          [1, 20, 250, "Pending"],
          [2, 20, 250, "Pending"],
          [3, 20, 250, "Pending"],
        ],
        undefined,
      );
    });

    it("prefills going without food when the event has no food", async () => {
      mockedEventsRepo.selectStandingListUserIds.mockResolvedValue([5]);

      await syncEventAudience(
        21,
        { lodgeIds: [], groupIds: [], userIds: [5, 6] },
        { price: 0, prefillStandingList: { food: false } },
      );

      expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
        [
          [5, 21, 1, 0, 0],
          [6, 21, 2, 0, 0],
        ],
        undefined,
      );
    });

    it("does not prefill when the audience changes on update (no backfill)", async () => {
      mockedEventsRepo.selectInvitedUserIds.mockResolvedValue([1]);
      mockedEventsRepo.selectStandingListUserIds.mockResolvedValue([2]);

      await syncEventAudience(
        22,
        { lodgeIds: [], groupIds: [], userIds: [1, 2] },
        { price: 100 },
      );

      expect(mockedEventsRepo.selectStandingListUserIds).not.toHaveBeenCalled();
      expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
        [[2, 22, 2, 0, 0]],
        undefined,
      );
    });

    it("never rewrites attendance rows of users who are already invited", async () => {
      mockedEventsRepo.selectInvitedUserIds.mockResolvedValue([1, 2]);
      mockedEventsRepo.selectStandingListUserIds.mockResolvedValue([3]);

      await syncEventAudience(
        23,
        { lodgeIds: [], groupIds: [], userIds: [1, 2, 3] },
        { price: 100, prefillStandingList: { food: true } },
      );

      expect(mockedEventsRepo.selectStandingListUserIds).toHaveBeenCalledWith(
        [3],
        undefined,
      );
      expect(mockedEventsRepo.bulkInsertEventAttendances).toHaveBeenCalledWith(
        [[3, 23, 1, 1, 0]],
        undefined,
      );
      expect(mockedEventsRepo.deleteEventAttendancesForUids).not.toHaveBeenCalled();
    });
  });
});
