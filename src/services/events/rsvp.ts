import { fromDbRsvp, toDbRsvp, type RsvpStatus } from "../../utils/rsvp";
import * as eventsRepo from "../../repositories/events.repo";

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
  await eventsRepo.upsertUserRsvp(userId, eventId, rsvpValue);
}

export async function getUserRsvp(
  userId: number,
  eventId: number,
): Promise<RsvpStatus | null> {
  const val = await eventsRepo.getUserRsvpFromDb(userId, eventId);
  return val === null || typeof val === "undefined" ? null : fromDbRsvp(val);
}

export async function getEventStats(
  eventId: number,
): Promise<{ invited: number; answered: number; going: number }> {
  const invited = await eventsRepo.countInvitedUsersForEvent(eventId);
  const rsvpCounts = await eventsRepo.countRsvpStatsForEvent(eventId);
  return { invited, answered: rsvpCounts.answered, going: rsvpCounts.going };
}

