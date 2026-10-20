import type { PoolConnection } from "mysql2/promise";
import pool from "../config/db";
import * as historyRepo from "../repositories/memberHistory.repo";
import type {
  AchievementEntryRecord,
  ChangeLogRecord,
  OfficialEntryRecord,
} from "../repositories/memberHistory.repo";
import { notFound, ValidationError } from "../utils/errors";
import { NOTE_REQUIRED_MESSAGE } from "../validators/memberHistoryValidators";

// Editable member history (OSVS-25) with mandatory change notes and a
// transactional change log (OSVS-26). Every mutation of a tjänst or
// utmärkelse entry writes one `user_change_log` row on the same connection
// and inside the same transaction as the change itself: if logging fails the
// change is rolled back.

export type OfficialEntry = {
  id: number;
  officialId: number;
  title: string;
  /** YYYY-MM-DD */
  appointedAt: string;
  /** YYYY-MM-DD, or null when pågående */
  unappointedAt: string | null;
};

export type AchievementEntry = {
  id: number;
  achievementId: number;
  title: string;
  /** YYYY-MM-DD */
  awardedAt: string;
};

export type ChangeLogEntry = Omit<ChangeLogRecord, "uid">;

export type OfficialEntryInput = {
  officialId: number;
  appointedAt: string;
  unappointedAt: string | null;
  note: string | null;
};

export type AchievementEntryInput = {
  achievementId: number;
  awardedAt: string;
  note: string | null;
};

const MEMBER_NOT_FOUND = "Brodern hittades inte";
const OFFICIAL_ENTRY_NOT_FOUND = "Tjänsteposten hittades inte";
const ACHIEVEMENT_ENTRY_NOT_FOUND = "Utmärkelseposten hittades inte";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local "YYYY-MM-DD HH:MM:SS" (same convention mysql2 uses for Date params). */
export function toSqlDateTime(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function datePart(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

/**
 * Keeps the stored datetime when the submitted calendar date is unchanged
 * (legacy rows may carry a time of day), otherwise stores midnight.
 */
function mergeDate(submitted: string, stored: string | null): string {
  if (stored && datePart(stored) === submitted) return stored;
  return `${submitted} 00:00:00`;
}

function mergeNullableDate(
  submitted: string | null,
  stored: string | null,
): string | null {
  if (submitted === null) return null;
  return mergeDate(submitted, stored);
}

function requireNote(note: string | null | undefined): string {
  const trimmed = typeof note === "string" ? note.trim() : "";
  if (!trimmed) throw new ValidationError({ note: NOTE_REQUIRED_MESSAGE });
  return trimmed;
}

function normalizeOptionalNote(note: string | null | undefined): string | null {
  const trimmed = typeof note === "string" ? note.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function toOfficialEntry(r: OfficialEntryRecord): OfficialEntry {
  return {
    id: r.id,
    officialId: r.officialId,
    title: r.title,
    appointedAt: datePart(r.appointedAt) ?? "",
    unappointedAt: datePart(r.unappointedAt),
  };
}

function toAchievementEntry(r: AchievementEntryRecord): AchievementEntry {
  return {
    id: r.id,
    achievementId: r.achievementId,
    title: r.title,
    awardedAt: datePart(r.awardedAt) ?? "",
  };
}

function officialSnapshot(v: {
  officialId: number;
  title: string;
  appointedAt: string;
  unappointedAt: string | null;
}) {
  return {
    officialId: v.officialId,
    title: v.title,
    appointedAt: v.appointedAt,
    unappointedAt: v.unappointedAt,
  };
}

function achievementSnapshot(v: {
  achievementId: number;
  title: string;
  awardedAt: string;
}) {
  return {
    achievementId: v.achievementId,
    title: v.title,
    awardedAt: v.awardedAt,
  };
}

async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback failure; original error is more useful
    }
    throw err;
  } finally {
    try {
      conn.release();
    } catch {
      // ignore
    }
  }
}

async function assertMemberExists(uid: number, conn: PoolConnection) {
  if (!(await historyRepo.memberExists(uid, conn))) {
    throw notFound(MEMBER_NOT_FOUND);
  }
}

async function requireOfficialTitle(
  officialId: number,
  conn: PoolConnection,
): Promise<string> {
  const title = await historyRepo.findOfficialTitle(officialId, conn);
  if (title === null) {
    throw new ValidationError({ officialId: "Välj en giltig tjänst" });
  }
  return title;
}

async function requireAchievementTitle(
  achievementId: number,
  conn: PoolConnection,
): Promise<string> {
  const title = await historyRepo.findAchievementTitle(achievementId, conn);
  if (title === null) {
    throw new ValidationError({ achievementId: "Välj en giltig utmärkelse" });
  }
  return title;
}

async function assertNoDuplicateOngoing(
  uid: number,
  officialId: number,
  unappointedAt: string | null,
  excludeEntryId: number | null,
  conn: PoolConnection,
) {
  if (unappointedAt !== null) return;
  if (
    await historyRepo.hasOngoingOfficial(uid, officialId, excludeEntryId, conn)
  ) {
    throw new ValidationError({
      officialId: "Brodern har redan denna tjänst som pågående",
    });
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listOfficialEntries(uid: number): Promise<OfficialEntry[]> {
  const rows = await historyRepo.listOfficialEntries(uid);
  return rows.map(toOfficialEntry);
}

export async function listAchievementEntries(
  uid: number,
): Promise<AchievementEntry[]> {
  const rows = await historyRepo.listAchievementEntries(uid);
  return rows.map(toAchievementEntry);
}

export async function listChangeLog(uid: number): Promise<ChangeLogEntry[]> {
  const rows = await historyRepo.listChangeLog(uid);
  return rows.map(({ uid: _uid, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Tjänster
// ---------------------------------------------------------------------------

export async function createOfficialEntry(
  uid: number,
  input: OfficialEntryInput,
  editorId: number,
): Promise<OfficialEntry> {
  return withTransaction(async (conn) => {
    await assertMemberExists(uid, conn);
    const title = await requireOfficialTitle(input.officialId, conn);
    const appointedAt = `${input.appointedAt} 00:00:00`;
    const unappointedAt = input.unappointedAt
      ? `${input.unappointedAt} 00:00:00`
      : null;
    await assertNoDuplicateOngoing(
      uid,
      input.officialId,
      unappointedAt,
      null,
      conn,
    );

    const id = await historyRepo.insertOfficialEntry(
      { uid, officialId: input.officialId, appointedAt, unappointedAt },
      conn,
    );

    await historyRepo.insertChangeLog(
      {
        uid,
        entityType: "official",
        action: "create",
        entryId: id,
        itemId: input.officialId,
        oldValue: null,
        newValue: officialSnapshot({
          officialId: input.officialId,
          title,
          appointedAt,
          unappointedAt,
        }),
        note: normalizeOptionalNote(input.note),
        editorId,
      },
      conn,
    );

    return toOfficialEntry({
      id,
      uid,
      officialId: input.officialId,
      title,
      appointedAt,
      unappointedAt,
    });
  });
}

export async function updateOfficialEntry(
  uid: number,
  entryId: number,
  input: OfficialEntryInput,
  editorId: number,
): Promise<OfficialEntry> {
  const note = requireNote(input.note);
  return withTransaction(async (conn) => {
    const existing = await historyRepo.findOfficialEntryForUpdate(
      uid,
      entryId,
      conn,
    );
    if (!existing) throw notFound(OFFICIAL_ENTRY_NOT_FOUND);

    const title =
      input.officialId === existing.officialId
        ? existing.title
        : await requireOfficialTitle(input.officialId, conn);
    const appointedAt = mergeDate(input.appointedAt, existing.appointedAt);
    const unappointedAt = mergeNullableDate(
      input.unappointedAt,
      existing.unappointedAt,
    );
    await assertNoDuplicateOngoing(
      uid,
      input.officialId,
      unappointedAt,
      entryId,
      conn,
    );

    await historyRepo.updateOfficialEntry(
      entryId,
      { officialId: input.officialId, appointedAt, unappointedAt },
      conn,
    );

    await historyRepo.insertChangeLog(
      {
        uid,
        entityType: "official",
        action: "update",
        entryId,
        itemId: input.officialId,
        oldValue: officialSnapshot(existing),
        newValue: officialSnapshot({
          officialId: input.officialId,
          title,
          appointedAt,
          unappointedAt,
        }),
        note,
        editorId,
      },
      conn,
    );

    return toOfficialEntry({
      id: entryId,
      uid,
      officialId: input.officialId,
      title,
      appointedAt,
      unappointedAt,
    });
  });
}

export async function deleteOfficialEntry(
  uid: number,
  entryId: number,
  noteInput: string,
  editorId: number,
): Promise<void> {
  const note = requireNote(noteInput);
  await withTransaction(async (conn) => {
    const existing = await historyRepo.findOfficialEntryForUpdate(
      uid,
      entryId,
      conn,
    );
    if (!existing) throw notFound(OFFICIAL_ENTRY_NOT_FOUND);

    await historyRepo.deleteOfficialEntry(entryId, conn);
    await historyRepo.insertChangeLog(
      {
        uid,
        entityType: "official",
        action: "delete",
        entryId,
        itemId: existing.officialId,
        oldValue: officialSnapshot(existing),
        newValue: null,
        note,
        editorId,
      },
      conn,
    );
  });
}

/**
 * Legacy bulk endpoint (`PUT /officials/member/:matrikelnummer`): makes the
 * given officials the member's ongoing tjänster. Removed ones get today's end
 * date, new ones start today. Each affected entry is logged; the note is
 * optional here to keep the existing contract working.
 */
export async function setMemberOngoingOfficials(
  uid: number,
  officialIds: number[],
  editorId: number,
  noteInput?: string | null,
): Promise<void> {
  const note = normalizeOptionalNote(noteInput);
  const desired = Array.from(
    new Set(officialIds.filter((id) => Number.isFinite(id))),
  );

  await withTransaction(async (conn) => {
    const ongoing = await historyRepo.listOngoingOfficialEntriesForUpdate(
      uid,
      conn,
    );
    const ongoingIds = new Set(ongoing.map((e) => e.officialId));
    const desiredSet = new Set(desired);
    const now = toSqlDateTime(new Date());

    for (const entry of ongoing) {
      if (desiredSet.has(entry.officialId)) continue;
      await historyRepo.updateOfficialEntry(
        entry.id,
        {
          officialId: entry.officialId,
          appointedAt: entry.appointedAt,
          unappointedAt: now,
        },
        conn,
      );
      await historyRepo.insertChangeLog(
        {
          uid,
          entityType: "official",
          action: "update",
          entryId: entry.id,
          itemId: entry.officialId,
          oldValue: officialSnapshot(entry),
          newValue: officialSnapshot({ ...entry, unappointedAt: now }),
          note,
          editorId,
        },
        conn,
      );
    }

    for (const officialId of desired) {
      if (ongoingIds.has(officialId)) continue;
      const title = await requireOfficialTitle(officialId, conn);
      const id = await historyRepo.insertOfficialEntry(
        { uid, officialId, appointedAt: now, unappointedAt: null },
        conn,
      );
      await historyRepo.insertChangeLog(
        {
          uid,
          entityType: "official",
          action: "create",
          entryId: id,
          itemId: officialId,
          oldValue: null,
          newValue: officialSnapshot({
            officialId,
            title,
            appointedAt: now,
            unappointedAt: null,
          }),
          note,
          editorId,
        },
        conn,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Utmärkelser
// ---------------------------------------------------------------------------

/**
 * Creates an achievement entry. `awardedAt` is either a calendar date
 * (YYYY-MM-DD) or a full SQL datetime; used by both the new editor and the
 * legacy `POST /users/:matrikelnummer/achievements`.
 */
export async function createAchievementEntry(
  uid: number,
  input: { achievementId: number; awardedAt: string; note: string | null },
  editorId: number,
): Promise<AchievementEntry> {
  return withTransaction(async (conn) => {
    await assertMemberExists(uid, conn);
    const title = await requireAchievementTitle(input.achievementId, conn);
    const awardedAt =
      input.awardedAt.length === 10
        ? `${input.awardedAt} 00:00:00`
        : input.awardedAt;

    const id = await historyRepo.insertAchievementEntry(
      { uid, achievementId: input.achievementId, awardedAt },
      conn,
    );

    await historyRepo.insertChangeLog(
      {
        uid,
        entityType: "achievement",
        action: "create",
        entryId: id,
        itemId: input.achievementId,
        oldValue: null,
        newValue: achievementSnapshot({
          achievementId: input.achievementId,
          title,
          awardedAt,
        }),
        note: normalizeOptionalNote(input.note),
        editorId,
      },
      conn,
    );

    return toAchievementEntry({
      id,
      uid,
      achievementId: input.achievementId,
      title,
      awardedAt,
    });
  });
}

export async function updateAchievementEntry(
  uid: number,
  entryId: number,
  input: AchievementEntryInput,
  editorId: number,
): Promise<AchievementEntry> {
  const note = requireNote(input.note);
  return withTransaction(async (conn) => {
    const existing = await historyRepo.findAchievementEntryForUpdate(
      uid,
      entryId,
      conn,
    );
    if (!existing) throw notFound(ACHIEVEMENT_ENTRY_NOT_FOUND);

    const title =
      input.achievementId === existing.achievementId
        ? existing.title
        : await requireAchievementTitle(input.achievementId, conn);
    const awardedAt = mergeDate(input.awardedAt, existing.awardedAt);

    await historyRepo.updateAchievementEntry(
      entryId,
      { achievementId: input.achievementId, awardedAt },
      conn,
    );

    await historyRepo.insertChangeLog(
      {
        uid,
        entityType: "achievement",
        action: "update",
        entryId,
        itemId: input.achievementId,
        oldValue: achievementSnapshot(existing),
        newValue: achievementSnapshot({
          achievementId: input.achievementId,
          title,
          awardedAt,
        }),
        note,
        editorId,
      },
      conn,
    );

    return toAchievementEntry({
      id: entryId,
      uid,
      achievementId: input.achievementId,
      title,
      awardedAt,
    });
  });
}

export async function deleteAchievementEntry(
  uid: number,
  entryId: number,
  noteInput: string,
  editorId: number,
): Promise<void> {
  const note = requireNote(noteInput);
  await withTransaction(async (conn) => {
    const existing = await historyRepo.findAchievementEntryForUpdate(
      uid,
      entryId,
      conn,
    );
    if (!existing) throw notFound(ACHIEVEMENT_ENTRY_NOT_FOUND);

    await historyRepo.deleteAchievementEntry(entryId, conn);
    await historyRepo.insertChangeLog(
      {
        uid,
        entityType: "achievement",
        action: "delete",
        entryId,
        itemId: existing.achievementId,
        oldValue: achievementSnapshot(existing),
        newValue: null,
        note,
        editorId,
      },
      conn,
    );
  });
}

export default {
  listOfficialEntries,
  listAchievementEntries,
  listChangeLog,
  createOfficialEntry,
  updateOfficialEntry,
  deleteOfficialEntry,
  setMemberOngoingOfficials,
  createAchievementEntry,
  updateAchievementEntry,
  deleteAchievementEntry,
};
