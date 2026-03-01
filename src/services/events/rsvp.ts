import pool from "../../config/db";
import type { EventAttendanceRow } from "../../types";
import { badRequest, forbidden } from "../../utils/errors";
import { fromDbRsvp, toDbRsvp, type RsvpStatus } from "../../utils/rsvp";
import * as eventsRepo from "../../repositories/events.repo";

type PatchAttendanceInput = Partial<{
  rsvp: boolean;
  bookFood: boolean;
  attended: boolean;
  paymentPaid: boolean;
}>;

function toDbFlag(value: unknown): number {
  return value === true || Number(value) === 1 ? 1 : 0;
}

function toDbRsvpState(value: unknown): number {
  const numeric = Number(value);
  return numeric === 0 || numeric === 1 || numeric === 2 ? numeric : 2;
}

function toPaymentStatus(
  value: unknown,
): "Pending" | "Paid" | null {
  if (typeof value !== "string") return null;
  if (value === "Pending" || value === "Paid") {
    return value;
  }
  return null;
}

function parseAllergies(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }
  if (typeof value !== "string") return [];
  const raw = value.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asAttendanceRow(row: Record<string, unknown>): EventAttendanceRow {
  const paymentStatus = toPaymentStatus(row.paymentStatus);
  return {
    uid: Number(row.uid),
    firstname: String(row.firstname ?? ""),
    lastname: String(row.lastname ?? ""),
    allergies: parseAllergies(row.allergies),
    rsvp: toDbFlag(row.rsvp) === 1,
    bookFood: toDbFlag(row.bookFood) === 1,
    attended: toDbFlag(row.attended) === 1,
    paymentStatus,
    paymentPaid: paymentStatus === "Paid",
  };
}

export async function isUserInvitedToEvent(
  userId: number,
  eventId: number,
): Promise<boolean> {
  return await eventsRepo.isUserInvitedToEvent(eventId, userId);
}

export async function setUserRsvp(
  userId: number,
  eventId: number,
  rsvp: RsvpStatus | number,
): Promise<void> {
  const rsvpValue =
    typeof rsvp === "number" ? Number(rsvp) : toDbRsvp(rsvp as RsvpStatus);
  const existing = await eventsRepo.getEventAttendanceFromDb(userId, eventId);
  await eventsRepo.upsertEventAttendance(userId, eventId, {
    rsvp: rsvpValue === 1 ? 1 : 0,
    bookFood: rsvpValue === 1 ? toDbFlag(existing?.bookFood) : 0,
    attended: toDbFlag(existing?.attended),
  });
}

export async function getUserRsvp(
  userId: number,
  eventId: number,
): Promise<RsvpStatus | null> {
  const val = await eventsRepo.getUserRsvpFromDb(userId, eventId);
  return val === null || typeof val === "undefined" ? null : fromDbRsvp(val);
}

export async function getUserBookFood(
  userId: number,
  eventId: number,
): Promise<boolean | null> {
  const val = await eventsRepo.getUserBookFoodFromDb(userId, eventId);
  if (val === null || typeof val === "undefined") return null;
  return toDbFlag(val) === 1;
}

export async function setUserBookFood(
  userId: number,
  eventId: number,
  bookFood: boolean,
): Promise<boolean> {
  const rsvpVal = await eventsRepo.getUserRsvpFromDb(userId, eventId);
  if (toDbFlag(rsvpVal) !== 1) {
    if (bookFood) {
      throw badRequest("RSVP must be 'going' before booking food");
    }
    return false;
  }

  const value = bookFood ? 1 : 0;
  await eventsRepo.upsertUserBookFood(userId, eventId, value);
  return value === 1;
}

export async function getEventStats(
  eventId: number,
): Promise<{ invited: number; answered: number; going: number }> {
  const invited = await eventsRepo.countInvitedUsersForEvent(eventId);
  const rsvpCounts = await eventsRepo.countRsvpStatsForEvent(eventId);
  return { invited, answered: rsvpCounts.answered, going: rsvpCounts.going };
}

export async function listEventAttendances(
  eventId: number,
): Promise<EventAttendanceRow[]> {
  const rows = await eventsRepo.selectEventAttendances(eventId);
  return rows
    .map((row) => asAttendanceRow(row as Record<string, unknown>))
    .filter((row) => Number.isFinite(row.uid));
}

export async function patchEventAttendanceByAdmin(
  eventId: number,
  userId: number,
  patch: PatchAttendanceInput,
): Promise<EventAttendanceRow> {
  const invited = await eventsRepo.isUserInvitedToEvent(eventId, userId);
  if (!invited) throw forbidden("User is not invited to this event");

  const touchesAttendance =
    typeof patch.rsvp === "boolean" ||
    typeof patch.bookFood === "boolean" ||
    typeof patch.attended === "boolean";
  const touchesPayment = typeof patch.paymentPaid === "boolean";
  if (!touchesAttendance && !touchesPayment) {
    throw badRequest("No valid attendance fields provided");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (touchesAttendance) {
      const current = await eventsRepo.getEventAttendanceFromDb(userId, eventId);
      const next = {
        rsvp:
          typeof patch.rsvp === "boolean"
            ? toDbFlag(patch.rsvp)
            : toDbRsvpState(current?.rsvp),
        bookFood:
          typeof patch.bookFood === "boolean"
            ? toDbFlag(patch.bookFood)
            : toDbFlag(current?.bookFood),
        attended:
          typeof patch.attended === "boolean"
            ? toDbFlag(patch.attended)
            : toDbFlag(current?.attended),
      };

      if (next.rsvp !== 1) next.bookFood = 0;

      await eventsRepo.upsertEventAttendance(userId, eventId, next, conn);
    }

    if (touchesPayment) {
      const amount = await eventsRepo.selectEventPrice(eventId, conn);
      await eventsRepo.upsertEventPaymentStatus(
        userId,
        eventId,
        Number.isFinite(amount) ? amount : 0,
        patch.paymentPaid ? "Paid" : "Pending",
        conn,
      );
    }

    await conn.commit();
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    conn.release();
  }

  const rows = await listEventAttendances(eventId);
  const updated = rows.find((row) => row.uid === userId);
  if (!updated) throw badRequest("Failed to load updated attendance");
  return updated;
}
