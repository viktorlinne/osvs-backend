// OSVS-16: Access events (+ unmatched tEvents 'Verksamhet') -> events,
// lodges_events, events_attendances. Pure functions only.

import type { AccessEvent, AttendanceRow, EventItem, EventRow, TEvent } from "./types";
import { fit, mapLodge, text } from "./users";

export function isoDay(value: string | null | undefined): string | null {
  const m = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000);
}

function timeOf(value: string | null | undefined): string {
  const m = String(value ?? "").match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : "00:00:00";
}

function words(value: string): Set<string> {
  return new Set(
    text(value)
      .toLowerCase()
      .split(/[^a-zåäö0-9]+/)
      .filter((w) => w.length > 0),
  );
}

function overlap(a: string, b: string): number {
  const wa = words(a);
  let n = 0;
  for (const w of words(b)) if (wa.has(w)) n++;
  return n;
}

export type EventMatch = {
  eventId: number;
  tEventId: number;
  dayDiff: number;
};

export type EventMatchResult = {
  matches: EventMatch[];
  unmatchedTEvents: TEvent[];
  unmatchedEvents: AccessEvent[];
};

/**
 * One-to-one match between Access `events` and tEvents 'Verksamhet' rows:
 * same lodge code and the same date (pass 1), optionally the same lodge
 * within ±`toleranceDays` (pass 2; off by default because on the real extract
 * a ±1 day pass paired lodge visits with the host's board meetings). Among several candidates the one
 * with the most shared words in the title wins, then the closest date, then
 * the lowest tEvents Id. A tEvents row matched to an event is not imported
 * separately.
 */
export function matchEvents(events: AccessEvent[], tEvents: TEvent[], toleranceDays = 0): EventMatchResult {
  const candidates = tEvents.filter((t) => text(t.Category) === "Verksamhet" && isoDay(t.Start_Date));
  const used = new Set<number>();
  const matches: EventMatch[] = [];
  const pending = [...events].filter((e) => isoDay(e.dated)).sort((a, b) => a.Id - b.Id);

  for (const maxDiff of [0, toleranceDays]) {
    for (const ev of [...pending]) {
      const day = dayNumber(isoDay(ev.dated) as string);
      const options = candidates
        .filter((t) => !used.has(t.Id) && text(t.Lodge) === text(ev.lodge))
        .map((t) => ({ t, diff: Math.abs(dayNumber(isoDay(t.Start_Date) as string) - day) }))
        .filter((o) => o.diff <= maxDiff)
        .sort(
          (a, b) =>
            overlap(text(ev.description), text(b.t.Event_Contact)) - overlap(text(ev.description), text(a.t.Event_Contact)) ||
            a.diff - b.diff ||
            a.t.Id - b.t.Id,
        );
      if (options.length === 0) continue;
      used.add(options[0].t.Id);
      matches.push({ eventId: ev.Id, tEventId: options[0].t.Id, dayDiff: options[0].diff });
      pending.splice(pending.indexOf(ev), 1);
    }
  }
  return {
    matches,
    unmatchedTEvents: candidates.filter((t) => !used.has(t.Id)).sort((a, b) => a.Id - b.Id),
    unmatchedEvents: pending,
  };
}

/** Access `events` row -> events (title/description from the text, lodgeMeeting=1, food=1, price=0, start=end=date). */
export function mapAccessEvent(ev: AccessEvent): EventRow {
  const day = isoDay(ev.dated) as string;
  const title = fit(text(ev.description) || "Logemöte", 256);
  return {
    key: `events:${ev.Id}`,
    source: "events",
    sourceId: ev.Id,
    title,
    description: text(ev.description) || title,
    lodgeMeeting: true,
    food: true,
    price: 0,
    startDate: `${day} 00:00:00`,
    endDate: `${day} 00:00:00`,
    lodge: mapLodge(ev.lodge).lodge,
  };
}

/**
 * tEvents 'Verksamhet' row with no Access event -> events (historical only,
 * no attendance). Times are used when set; an end before the start (35 rows
 * have an End_Date before Start_Date) collapses to the start.
 */
export function mapTEvent(t: TEvent): EventRow {
  const startDay = isoDay(t.Start_Date) as string;
  const endDay = isoDay(t.End_Date) ?? startDay;
  const start = `${startDay} ${timeOf(t.Start_Time)}`;
  let end = `${endDay} ${timeOf(t.End_Time)}`;
  if (end < start) end = start;
  const title = fit(text(t.Event_Contact) || "Logemöte", 256);
  return {
    key: `tEvents:${t.Id}`,
    source: "tEvents",
    sourceId: t.Id,
    title,
    description: text(t.Event_Contact) || title,
    lodgeMeeting: true,
    food: false,
    price: 0,
    startDate: start,
    endDate: end,
    lodge: mapLodge(t.Lodge).lodge,
  };
}

export type AttendanceStats = {
  skippedNoFlags: number;
  skippedMissingContact: number;
  skippedMissingEvent: number;
  mergedDuplicates: number;
  past: number;
  coming: number;
};

/**
 * events_items -> events_attendances. `reserved` (meal booked) -> bookFood,
 * `attended` -> attended. `rsvp` is tri-state in this schema (0 = kommer inte,
 * 1 = kommer, 2 = obesvarat; see src/utils/rsvp.ts). Past events (before the
 * cutover) get rsvp=2 (unknown: the old site had no RSVP); coming events get
 * rsvp=1 where `reserved` was set (the old site pre-filled reserved from
 * Ständiga listan, which the new app expresses as an RSVP), otherwise 2. Rows with neither flag are
 * skipped; `paid` and `labeled` are not migrated. Duplicate (member, event)
 * pairs, also those created by merged contacts, are OR-ed together.
 */
export function mapAttendance(
  items: EventItem[],
  eventDay: Map<number, string>,
  matrikelFor: (contactId: number) => number | undefined,
  cutover: string,
): { rows: AttendanceRow[]; stats: AttendanceStats } {
  const stats: AttendanceStats = {
    skippedNoFlags: 0, skippedMissingContact: 0, skippedMissingEvent: 0, mergedDuplicates: 0, past: 0, coming: 0,
  };
  const byKey = new Map<string, AttendanceRow>();
  for (const item of items) {
    if (!item.reserved && !item.attended) {
      stats.skippedNoFlags++;
      continue;
    }
    const day = eventDay.get(item.listId);
    if (!day) {
      stats.skippedMissingEvent++;
      continue;
    }
    const uid = matrikelFor(item.contId);
    if (uid === undefined) {
      stats.skippedMissingContact++;
      continue;
    }
    const coming = day >= cutover;
    const row: AttendanceRow = {
      matrikelnummer: uid,
      eventKey: `events:${item.listId}`,
      rsvp: coming && item.reserved ? 1 : 2,
      bookFood: item.reserved ? 1 : 0,
      attended: item.attended ? 1 : 0,
    };
    const key = `${uid}|${item.listId}`;
    const existing = byKey.get(key);
    if (existing) {
      stats.mergedDuplicates++;
      existing.rsvp = existing.rsvp === 1 || row.rsvp === 1 ? 1 : 2;
      existing.bookFood = (existing.bookFood | row.bookFood) as 0 | 1;
      existing.attended = (existing.attended | row.attended) as 0 | 1;
      continue;
    }
    byKey.set(key, row);
    if (coming) stats.coming++;
    else stats.past++;
  }
  return { rows: [...byKey.values()], stats };
}
