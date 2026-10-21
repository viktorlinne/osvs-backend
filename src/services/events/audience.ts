import * as eventsRepo from "../../repositories/events.repo";
import * as groupsRepo from "../../repositories/groups.repo";
import { badRequest } from "../../utils/errors";
import type { PoolConnection } from "mysql2/promise";

const RSVP_UNANSWERED = 2;
const RSVP_GOING = 1;
const AUDIENCE_REQUIRED_ERROR = "Välj minst en målgrupp";

export type EventAudienceSelection = {
  lodgeIds: number[];
  groupIds: number[];
  userIds: number[];
};

type SyncEventAudienceOptions = {
  conn?: PoolConnection;
  requireAudience?: boolean;
  repricePending?: boolean;
  price?: number;
  /**
   * OSVS-28 "Ständiga listan": only set when the event is being created.
   * Newly invited users with users.standingList = 1 get rsvp = 1 (going) and
   * bookFood = 1 when the event has food. Never used on update (no backfill).
   */
  prefillStandingList?: { food: boolean };
};

function normalizeIds(ids: number[]): number[] {
  return Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && id > 0)
        .map((id) => Math.floor(id)),
    ),
  );
}

export function normalizeEventAudienceSelection(
  input: Partial<EventAudienceSelection> | undefined,
): EventAudienceSelection {
  return {
    lodgeIds: normalizeIds(input?.lodgeIds ?? []),
    groupIds: normalizeIds(input?.groupIds ?? []),
    userIds: normalizeIds(input?.userIds ?? []),
  };
}

export function assertValidEventAudience(
  audience: EventAudienceSelection,
  options?: { requireAudience?: boolean },
) {
  const requireAudience = options?.requireAudience !== false;
  if (
    requireAudience &&
    audience.lodgeIds.length === 0 &&
    audience.groupIds.length === 0 &&
    audience.userIds.length === 0
  ) {
    throw badRequest("Formuläret innehåller fel", {
      fields: { audience: AUDIENCE_REQUIRED_ERROR },
    });
  }
}

export async function getEventAudienceSelection(
  eventId: number,
  conn?: PoolConnection,
): Promise<EventAudienceSelection> {
  const [lodgeIds, groupIds, userIds] = await Promise.all([
    eventsRepo.selectEventLodgeIds(eventId, conn),
    eventsRepo.selectGroupIdsForEvent(eventId, conn),
    eventsRepo.selectUserIdsForEvent(eventId, conn),
  ]);

  return {
    lodgeIds: normalizeIds(lodgeIds),
    groupIds: normalizeIds(groupIds),
    userIds: normalizeIds(userIds),
  };
}

async function resolveInvitedUserIds(
  audience: EventAudienceSelection,
  conn?: PoolConnection,
): Promise<number[]> {
  const invited = new Set<number>();

  if (audience.lodgeIds.length > 0) {
    // Members of every selected lodge are invited (deduped via the Set).
    const rows = await eventsRepo.findUsersInLodges(audience.lodgeIds, conn);
    for (const row of rows) {
      const uid = Number(row.uid);
      if (Number.isFinite(uid)) invited.add(uid);
    }
  }

  if (audience.groupIds.length > 0) {
    const groupUserIds = await groupsRepo.selectUserIdsForGroups(
      audience.groupIds,
      conn,
    );
    for (const uid of groupUserIds) invited.add(uid);
  }

  for (const uid of audience.userIds) invited.add(uid);

  return Array.from(invited).sort((a, b) => a - b);
}

export async function syncEventAudience(
  eventId: number,
  input: Partial<EventAudienceSelection> | undefined,
  options?: SyncEventAudienceOptions,
): Promise<EventAudienceSelection> {
  const audience = normalizeEventAudienceSelection(input);
  assertValidEventAudience(audience, {
    requireAudience: options?.requireAudience,
  });

  const conn = options?.conn;
  const currentInvitedUserIds = await eventsRepo.selectInvitedUserIds(eventId, conn);

  await eventsRepo.replaceEventLodges(eventId, audience.lodgeIds, conn);
  await eventsRepo.replaceEventGroups(eventId, audience.groupIds, conn);
  await eventsRepo.replaceEventUsers(eventId, audience.userIds, conn);

  const nextInvitedUserIds = await resolveInvitedUserIds(audience, conn);

  const currentInvitedSet = new Set(currentInvitedUserIds);
  const nextInvitedSet = new Set(nextInvitedUserIds);

  const toRemove = currentInvitedUserIds.filter((uid) => !nextInvitedSet.has(uid));
  const toAdd = nextInvitedUserIds.filter((uid) => !currentInvitedSet.has(uid));

  if (toRemove.length > 0) {
    await eventsRepo.deleteEventAttendancesForUids(eventId, toRemove, conn);
    await eventsRepo.deleteEventPaymentsForUids(eventId, toRemove, conn);
  }

  if (toAdd.length > 0) {
    const amount = Number.isFinite(options?.price)
      ? Number(options?.price)
      : await eventsRepo.selectEventPrice(eventId, conn);

    const standingListSet = options?.prefillStandingList
      ? new Set(await eventsRepo.selectStandingListUserIds(toAdd, conn))
      : new Set<number>();
    const prefillBookFood = options?.prefillStandingList?.food ? 1 : 0;

    // INSERT IGNORE: an existing attendance row is never overwritten.
    await eventsRepo.bulkInsertEventAttendances(
      toAdd.map((uid) =>
        standingListSet.has(uid)
          ? [uid, eventId, RSVP_GOING, prefillBookFood, 0]
          : [uid, eventId, RSVP_UNANSWERED, 0, 0],
      ),
      conn,
    );
    await eventsRepo.bulkInsertEventPayments(
      toAdd.map((uid) => [uid, eventId, amount, "Pending"]),
      conn,
    );
  }

  if (options?.repricePending) {
    const amount = Number.isFinite(options?.price)
      ? Number(options?.price)
      : await eventsRepo.selectEventPrice(eventId, conn);
    await eventsRepo.updatePendingEventPaymentsAmount(eventId, amount, conn);
  }

  return audience;
}

export const EVENT_AUDIENCE_ERRORS = {
  audienceRequired: AUDIENCE_REQUIRED_ERROR,
};
