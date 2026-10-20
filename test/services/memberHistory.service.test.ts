jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
  },
}));

jest.mock("../../src/repositories/memberHistory.repo", () => ({
  memberExists: jest.fn(),
  findOfficialTitle: jest.fn(),
  findAchievementTitle: jest.fn(),
  findOfficialEntryForUpdate: jest.fn(),
  findAchievementEntryForUpdate: jest.fn(),
  hasOngoingOfficial: jest.fn(),
  insertOfficialEntry: jest.fn(),
  updateOfficialEntry: jest.fn(),
  deleteOfficialEntry: jest.fn(),
  listOngoingOfficialEntriesForUpdate: jest.fn(),
  insertAchievementEntry: jest.fn(),
  updateAchievementEntry: jest.fn(),
  deleteAchievementEntry: jest.fn(),
  insertChangeLog: jest.fn(),
}));

import pool from "../../src/config/db";
import * as historyRepo from "../../src/repositories/memberHistory.repo";
import {
  createOfficialEntry,
  deleteAchievementEntry,
  deleteOfficialEntry,
  setMemberOngoingOfficials,
  updateAchievementEntry,
  updateOfficialEntry,
} from "../../src/services/memberHistoryService";
import { ValidationError } from "../../src/utils/errors";

const mockedPool = pool as unknown as { getConnection: jest.Mock };
const repo = historyRepo as jest.Mocked<typeof historyRepo>;

function createConnectionMock() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

const existingOfficial = {
  id: 31,
  uid: 7,
  officialId: 2,
  title: "Ordförande",
  appointedAt: "2019-01-15 13:45:00",
  unappointedAt: null,
};

describe("memberHistoryService", () => {
  let conn: ReturnType<typeof createConnectionMock>;

  beforeEach(() => {
    conn = createConnectionMock();
    mockedPool.getConnection.mockResolvedValue(conn);
    repo.memberExists.mockResolvedValue(true);
    repo.findOfficialTitle.mockResolvedValue("Sekreterare");
    repo.hasOngoingOfficial.mockResolvedValue(false);
    repo.insertOfficialEntry.mockResolvedValue(55);
    repo.updateOfficialEntry.mockResolvedValue(undefined);
    repo.deleteOfficialEntry.mockResolvedValue(undefined);
    repo.insertChangeLog.mockResolvedValue(1);
    repo.findOfficialEntryForUpdate.mockResolvedValue({ ...existingOfficial });
  });

  it("logs old and new values on the same connection when a tjänst is updated", async () => {
    const entry = await updateOfficialEntry(
      7,
      31,
      {
        officialId: 2,
        appointedAt: "2019-01-15",
        unappointedAt: "2021-06-30",
        note: "Avgick vid årsmötet",
      },
      99,
    );

    // Unchanged start date keeps the stored time of day.
    expect(repo.updateOfficialEntry).toHaveBeenCalledWith(
      31,
      {
        officialId: 2,
        appointedAt: "2019-01-15 13:45:00",
        unappointedAt: "2021-06-30 00:00:00",
      },
      conn,
    );
    expect(repo.insertChangeLog).toHaveBeenCalledWith(
      {
        uid: 7,
        entityType: "official",
        action: "update",
        entryId: 31,
        itemId: 2,
        oldValue: {
          officialId: 2,
          title: "Ordförande",
          appointedAt: "2019-01-15 13:45:00",
          unappointedAt: null,
        },
        newValue: {
          officialId: 2,
          title: "Ordförande",
          appointedAt: "2019-01-15 13:45:00",
          unappointedAt: "2021-06-30 00:00:00",
        },
        note: "Avgick vid årsmötet",
        editorId: 99,
      },
      conn,
    );
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
    expect(entry).toEqual({
      id: 31,
      officialId: 2,
      title: "Ordförande",
      appointedAt: "2019-01-15",
      unappointedAt: "2021-06-30",
    });
  });

  it("rolls back the change when writing the log row fails", async () => {
    repo.insertChangeLog.mockRejectedValue(new Error("log insert failed"));

    await expect(
      updateOfficialEntry(
        7,
        31,
        {
          officialId: 2,
          appointedAt: "2019-01-15",
          unappointedAt: null,
          note: "Rättelse",
        },
        99,
      ),
    ).rejects.toThrow("log insert failed");

    expect(repo.updateOfficialEntry).toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  it("rolls back a delete when writing the log row fails", async () => {
    repo.insertChangeLog.mockRejectedValue(new Error("log insert failed"));

    await expect(deleteOfficialEntry(7, 31, "Dubblett", 99)).rejects.toThrow(
      "log insert failed",
    );
    expect(repo.deleteOfficialEntry).toHaveBeenCalledWith(31, conn);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it("refuses updates and deletions without a note before touching the DB", async () => {
    await expect(
      updateOfficialEntry(
        7,
        31,
        {
          officialId: 2,
          appointedAt: "2019-01-15",
          unappointedAt: null,
          note: "  ",
        },
        99,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteOfficialEntry(7, 31, "", 99)).rejects.toMatchObject({
      status: 400,
      details: { fields: { note: expect.any(String) } },
    });
    await expect(
      updateAchievementEntry(
        7,
        88,
        { achievementId: 3, awardedAt: "2021-03-20", note: null },
        99,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteAchievementEntry(7, 88, "", 99)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(mockedPool.getConnection).not.toHaveBeenCalled();
  });

  it("returns 404 when the entry does not belong to the member", async () => {
    repo.findOfficialEntryForUpdate.mockResolvedValue(null);
    await expect(deleteOfficialEntry(7, 999, "Fel", 99)).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.deleteOfficialEntry).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });

  it("logs creation with optional note and rejects a duplicate ongoing tjänst", async () => {
    const created = await createOfficialEntry(
      7,
      {
        officialId: 4,
        appointedAt: "2024-01-01",
        unappointedAt: null,
        note: null,
      },
      99,
    );
    expect(created.id).toBe(55);
    expect(repo.insertChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entryId: 55,
        oldValue: null,
        newValue: {
          officialId: 4,
          title: "Sekreterare",
          appointedAt: "2024-01-01 00:00:00",
          unappointedAt: null,
        },
        note: null,
      }),
      conn,
    );

    repo.hasOngoingOfficial.mockResolvedValue(true);
    await expect(
      createOfficialEntry(
        7,
        {
          officialId: 4,
          appointedAt: "2024-01-01",
          unappointedAt: null,
          note: null,
        },
        99,
      ),
    ).rejects.toMatchObject({ details: { fields: { officialId: expect.any(String) } } });
  });

  it("logs achievement deletion with the old value", async () => {
    repo.findAchievementEntryForUpdate.mockResolvedValue({
      id: 88,
      uid: 7,
      achievementId: 3,
      title: "III",
      awardedAt: "2021-03-20 00:00:00",
    });

    await deleteAchievementEntry(7, 88, "Felregistrerad", 99);

    expect(repo.deleteAchievementEntry).toHaveBeenCalledWith(88, conn);
    expect(repo.insertChangeLog).toHaveBeenCalledWith(
      {
        uid: 7,
        entityType: "achievement",
        action: "delete",
        entryId: 88,
        itemId: 3,
        oldValue: {
          achievementId: 3,
          title: "III",
          awardedAt: "2021-03-20 00:00:00",
        },
        newValue: null,
        note: "Felregistrerad",
        editorId: 99,
      },
      conn,
    );
    expect(conn.commit).toHaveBeenCalled();
  });

  it("logs every started and ended tjänst from the legacy bulk endpoint", async () => {
    repo.listOngoingOfficialEntriesForUpdate.mockResolvedValue([
      { ...existingOfficial },
    ]);

    await setMemberOngoingOfficials(7, [5], 99, undefined);

    expect(repo.updateOfficialEntry).toHaveBeenCalledWith(
      31,
      expect.objectContaining({ unappointedAt: expect.any(String) }),
      conn,
    );
    expect(repo.insertOfficialEntry).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 7, officialId: 5, unappointedAt: null }),
      conn,
    );
    const actions = repo.insertChangeLog.mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(["update", "create"]);
    expect(conn.commit).toHaveBeenCalled();
  });
});
