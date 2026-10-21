// Builds the complete in-memory migration plan from the extract. No DB and no
// file access: file-derived facts (news folder dates, which photo files exist)
// are passed in by run.ts.

import { createHash } from "crypto";
import type {
  AchievementRow, AttendanceRow, Contact, EventRow, Extract, GroupMemberRow, GroupRow,
  OfficialRow, PostRow, UserRow,
} from "./types";
import { Registry } from "./registry";
import {
  LEGACY_PASSWORD_PLACEHOLDER, PLACEHOLDERS, allergiesForPnotes, assignMatrikelnummer, buildNotes,
  findDuplicateGroups, findPossibleDuplicates, fit, mapArchive, mapLodge, mergeContacts, multiline,
  parseBirthDate, parseEmail, rolesForAccessLevel, text,
} from "./users";
import type { DuplicateGroup } from "./users";
import {
  buildAchievements, buildOfficials, classifyCv, toAchievementRows,
} from "./history";
import type { ClassifiedCv, HistoryIssue } from "./history";
import { isoDay, mapAccessEvent, mapAttendance, mapTEvent, matchEvents } from "./events";
import type { AttendanceStats, EventMatchResult } from "./events";
import { estimatePostDates, inWindow, mapPost, windowStart } from "./posts";
import type { PostDate, PostFiles } from "./posts";

export type TransformOptions = {
  cutover: string; // YYYY-MM-DD
  postsPublicum: boolean;
  eventToleranceDays: number;
};

export type TransformEnv = {
  newsFolderDates: Map<number, string>;
  photoExists: (file: string) => boolean;
  /** Old-site file lookups for post pictures/attachments (default: none exist). */
  postFiles?: PostFiles;
};

export type IdMapRow = { contactId: number; survivorContactId: number; matrikelnummer: number; memberno: string };

export type MigrationPlan = {
  cutover: string;
  users: UserRow[];
  groups: GroupRow[];
  groupMembers: GroupMemberRow[];
  events: EventRow[];
  attendances: AttendanceRow[];
  posts: PostRow[];
  achievements: AchievementRow[];
  officials: OfficialRow[];
  idMap: IdMapRow[];
  merges: DuplicateGroup[];
  mergeHash: string;
  possibleDuplicates: Contact[][];
  eventMatch: EventMatchResult;
  attendanceStats: AttendanceStats;
  postDates: Map<number, PostDate>;
  registry: Registry;
  stats: Record<string, number | string>;
};

export function mergePlanHash(groups: DuplicateGroup[]): string {
  const canonical = groups.map((g) => [g.survivor.Id, ...g.discarded.map((d) => d.Id).sort((a, b) => a - b)]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 12);
}

function fullName(c: Contact): string {
  return `${text(c.firstname)} ${text(c.lastname)}`.trim();
}

export function transform(extract: Extract, options: TransformOptions, env: TransformEnv): MigrationPlan {
  const registry = new Registry();
  const cutoverYear = Number(options.cutover.slice(0, 4));
  const contacts = [...extract.contacts].sort((a, b) => a.Id - b.Id);
  const contactIds = new Set(contacts.map((c) => c.Id));

  // --- duplicates -----------------------------------------------------------
  const merges = findDuplicateGroups(contacts, cutoverYear);
  const survivorOf = new Map<number, number>();
  for (const c of contacts) survivorOf.set(c.Id, c.Id);
  const mergedById = new Map<number, Contact>();
  for (const g of merges) {
    for (const d of g.discarded) survivorOf.set(d.Id, g.survivor.Id);
    mergedById.set(g.survivor.Id, mergeContacts(g));
    registry.add({
      category: "merge",
      contactId: g.survivor.Id,
      name: fullName(g.survivor),
      subject: `keeps ${g.survivor.Id}, merges ${g.discarded.map((d) => d.Id).join(", ")}`,
      detail: "irreversible; approve with --approve-merges=<hash> (see merge-report.md)",
    });
  }
  const survivors = contacts.filter((c) => survivorOf.get(c.Id) === c.Id).map((c) => mergedById.get(c.Id) ?? c);
  const possibleDuplicates = findPossibleDuplicates(contacts, new Set(merges.flatMap((g) => g.discarded.map((d) => d.Id))));

  // --- matrikelnummer -------------------------------------------------------
  const matrikel = assignMatrikelnummer(survivors);
  for (const r of matrikel.reassigned) {
    if (!r.memberno) continue; // no number at all: nothing to decide
    const c = survivors.find((s) => s.Id === r.contactId) as Contact;
    registry.add({
      category: "matrikelnummer",
      contactId: r.contactId,
      matrikelnummer: r.matrikelnummer,
      name: fullName(c),
      subject: `memberno "${r.memberno}" not kept`,
      detail: r.reason,
    });
  }
  const matrikelFor = (contactId: number): number | undefined => {
    const s = survivorOf.get(contactId);
    return s === undefined ? undefined : matrikel.byContact.get(s);
  };
  const idMap: IdMapRow[] = contacts.map((c) => ({
    contactId: c.Id,
    survivorContactId: survivorOf.get(c.Id) as number,
    matrikelnummer: matrikelFor(c.Id) as number,
    memberno: text(c.memberno),
  }));

  // --- contacts_cv ----------------------------------------------------------
  let cvOrphans = 0;
  const cvRows = extract.contactsCv
    .filter((r) => {
      if (contactIds.has(r.listId)) return true;
      cvOrphans++;
      return false;
    })
    .map((r) => ({ id: r.Id, dated: r.dated, description: String(r.description ?? ""), contactId: survivorOf.get(r.listId) as number }));
  const buckets = classifyCv(cvRows);
  const cvByContact = new Map<number, ClassifiedCv[]>();
  for (const list of [buckets.achievement, buckets.official, buckets.memberNote]) {
    for (const row of list) {
      const arr = cvByContact.get(row.contactId) ?? [];
      arr.push(row);
      cvByContact.set(row.contactId, arr);
    }
  }
  for (const arr of cvByContact.values()) arr.sort((a, b) => String(a.dated ?? "").localeCompare(String(b.dated ?? "")) || a.id - b.id);
  const byId = new Map(survivors.map((c) => [c.Id, c]));
  for (const row of buckets.review) {
    const c = byId.get(row.contactId) as Contact;
    registry.add({
      category: "cv-review",
      contactId: row.contactId,
      matrikelnummer: matrikelFor(row.contactId),
      name: fullName(c),
      subject: `${text(row.dated)} ${row.description}`,
      detail: `contacts_cv row ${row.id}: ${row.result.note ?? "review"}; not loaded`,
    });
  }

  // --- users ----------------------------------------------------------------
  const placeholderCounts: Record<string, number> = {};
  const users: UserRow[] = [];
  const emailLeftovers = new Map<number, string>();
  let civicnoStored = 0;
  let legacyHashes = 0;
  let photos = 0;
  for (const c of survivors) {
    const uid = matrikel.byContact.get(c.Id) as number;
    const name = fullName(c);
    const placeholder = (field: string, detail: string) => {
      placeholderCounts[field] = (placeholderCounts[field] ?? 0) + 1;
      registry.add({ category: "placeholder", contactId: c.Id, matrikelnummer: uid, name, subject: field, detail });
    };

    const lodge = mapLodge(c.lodge);
    if (!lodge.known) {
      registry.add({ category: "lodge", contactId: c.Id, matrikelnummer: uid, name, subject: text(c.lodge), detail: "unknown lodge value; no users_lodges row" });
    }
    const archive = mapArchive(c.archive);
    if (archive.garbage) {
      registry.add({ category: "merge", contactId: c.Id, matrikelnummer: uid, name, subject: `archive "${text(c.archive)}"`, detail: "not an archive status; archive = NULL" });
    }

    const birth = parseBirthDate(c.civicno, cutoverYear);
    if (birth.civicno) civicnoStored++;
    if (!birth.dateOfBirth) {
      if (birth.format === "invalid") {
        registry.add({ category: "birth-date", contactId: c.Id, matrikelnummer: uid, name, subject: "civicno", detail: `"${text(c.civicno)}" could not be parsed` });
      }
      placeholder("dateOfBirth", `${PLACEHOLDERS.dateOfBirth} (source "${text(c.civicno)}")`);
    }

    const email = parseEmail(c.email);
    if (email.leftover) emailLeftovers.set(c.Id, email.leftover);

    const mobile = text(c.mobile);
    if (!mobile) placeholder("mobile", "empty string");
    for (const f of ["city", "address", "zipcode"] as const) {
      if (!text(c[f])) placeholder(f, "empty string");
    }

    const pnotes = text(c.pnotes);
    const allergies = allergiesForPnotes(pnotes);
    if (pnotes && allergies.length === 0) {
      registry.add({ category: "allergy", contactId: c.Id, matrikelnummer: uid, name, subject: pnotes, detail: "kept only in notes (Specialkost)" });
    }

    let photoFile: string | null = null;
    const link = text(c.link);
    if (link) {
      if (env.photoExists(link)) {
        photoFile = link;
        photos++;
      } else {
        registry.add({ category: "photo", contactId: c.Id, matrikelnummer: uid, name, subject: link, detail: "contacts.link set but the file is missing in db\\contacts" });
      }
    }

    const password = text(c.password);
    if (password) legacyHashes++;

    users.push({
      matrikelnummer: uid,
      contactId: c.Id,
      email: email.email ?? "",
      passwordHash: LEGACY_PASSWORD_PLACEHOLDER,
      legacyPasswordHash: password || null,
      legacyPasswordSalt: password ? text(c.passwordSalt) || null : null,
      archive: archive.archive,
      firstname: fit(text(c.firstname), 256),
      lastname: fit(text(c.lastname), 256),
      dateOfBirth: birth.dateOfBirth ?? PLACEHOLDERS.dateOfBirth,
      civicno: birth.civicno,
      mobile: fit(mobile, 20),
      homeNumber: text(c.phone1) ? fit(text(c.phone1), 20) : null,
      city: fit(text(c.city), 256),
      address: fit(text(c.address), 256),
      zipcode: fit(text(c.zipcode), 10),
      notes: null, // filled below, after e-mail conflicts are known
      standingList: !!c.plist,
      roles: rolesForAccessLevel(c.accesslevel),
      lodge: lodge.lodge,
      allergies,
      photoFile,
    });
  }

  // E-mail: unique among survivors. The address stays with the active member,
  // then the one with a legacy hash, then the higher access level, then the
  // lower contacts.Id; the others get a placeholder and keep the text in notes.
  const byEmail = new Map<string, UserRow[]>();
  for (const u of users) {
    if (!u.email) continue;
    const list = byEmail.get(u.email) ?? [];
    list.push(u);
    byEmail.set(u.email, list);
  }
  const sharedEmailNote = new Map<number, string>();
  let emailConflicts = 0;
  for (const [address, list] of byEmail) {
    if (list.length < 2) continue;
    emailConflicts++;
    const level = (u: UserRow) => (u.roles.includes("Admin") ? 3 : u.roles.includes("Editor") ? 2 : 1);
    const ranked = [...list].sort(
      (a, b) =>
        Number(b.archive === null) - Number(a.archive === null) ||
        Number(!!b.legacyPasswordHash) - Number(!!a.legacyPasswordHash) ||
        level(b) - level(a) ||
        a.contactId - b.contactId,
    );
    const keeper = ranked[0];
    for (const u of ranked.slice(1)) {
      u.email = "";
      sharedEmailNote.set(u.contactId, `E-post (gamla sajten, delad med matrikelnummer ${keeper.matrikelnummer}): ${address}`);
      registry.add({
        category: "email",
        contactId: u.contactId,
        matrikelnummer: u.matrikelnummer,
        name: `${u.firstname} ${u.lastname}`,
        subject: address,
        detail: `shared with matrikelnummer ${keeper.matrikelnummer} (contacts.Id ${keeper.contactId}), who keeps it; placeholder used`,
      });
    }
  }
  for (const u of users) {
    if (!u.email) {
      u.email = PLACEHOLDERS.email(u.contactId);
      placeholderCounts.email = (placeholderCounts.email ?? 0) + 1;
      registry.add({ category: "placeholder", contactId: u.contactId, matrikelnummer: u.matrikelnummer, name: `${u.firstname} ${u.lastname}`, subject: "email", detail: u.email });
    }
    const leftover = emailLeftovers.get(u.contactId);
    if (leftover && !sharedEmailNote.has(u.contactId)) {
      registry.add({ category: "email", contactId: u.contactId, matrikelnummer: u.matrikelnummer, name: `${u.firstname} ${u.lastname}`, subject: leftover, detail: "non-address text in contacts.email; kept in notes" });
    }
  }

  // Notes
  for (const u of users) {
    const c = byId.get(u.contactId) as Contact;
    const memberNotes = (cvByContact.get(u.contactId) ?? [])
      .filter((r) => r.result.kind === "member-note")
      .map((r) => ({ dated: r.dated, description: r.description }));
    const shared = sharedEmailNote.get(u.contactId);
    u.notes = buildNotes({
      notes: multiline(c.notes) || null,
      pnotes: c.pnotes,
      memberNotes,
      official: c.official,
      emailLeftover: shared ? null : emailLeftovers.get(u.contactId) ?? null,
      phone2: c.phone2,
      extra: shared ? [shared] : [],
    });
  }

  // --- achievements + officials ---------------------------------------------
  const issues: HistoryIssue[] = [];
  const achievements: AchievementRow[] = [];
  const officials: OfficialRow[] = [];
  for (const u of users) {
    const c = byId.get(u.contactId) as Contact;
    const cv = cvByContact.get(u.contactId) ?? [];
    achievements.push(...toAchievementRows(u.matrikelnummer, buildAchievements(u.contactId, cv, c.grade, cutoverYear, issues)));
    officials.push(...buildOfficials(u.contactId, u.matrikelnummer, cv, c.official, cutoverYear, issues));
  }
  const userByContact = new Map(users.map((u) => [u.contactId, u]));
  for (const i of issues) {
    const u = userByContact.get(i.contactId);
    registry.add({
      category: i.category,
      contactId: i.contactId,
      matrikelnummer: u?.matrikelnummer,
      name: u ? `${u.firstname} ${u.lastname}` : undefined,
      subject: i.subject,
      detail: i.detail,
    });
  }

  // --- groups ---------------------------------------------------------------
  const groups: GroupRow[] = extract.mail
    .slice()
    .sort((a, b) => a.Id - b.Id)
    .map((m) => {
      const lodge = mapLodge(m.lodge);
      const code = text(m.lodge);
      const lodgeText = code === "VS" ? "VS (hela orden)" : lodge.lodge ?? code;
      return {
        sourceId: m.Id,
        name: fit(text(m.description) || `Lista ${m.Id}`, 255),
        description: `Loge: ${lodgeText || "–"}\nMigrerad från gamla sajtens e-postlista (id ${m.Id}).`,
      };
    });
  const listIds = new Set(extract.mail.map((m) => m.Id));
  const memberKeys = new Set<string>();
  const groupMembers: GroupMemberRow[] = [];
  let mailOrphans = 0;
  let mailMissingContact = 0;
  let mailMergedDuplicates = 0;
  for (const item of extract.mailItems) {
    if (!listIds.has(item.listId)) {
      mailOrphans++;
      continue;
    }
    const uid = matrikelFor(item.contId);
    if (uid === undefined) {
      mailMissingContact++;
      continue;
    }
    const key = `${item.listId}|${uid}`;
    if (memberKeys.has(key)) {
      mailMergedDuplicates++;
      continue;
    }
    memberKeys.add(key);
    groupMembers.push({ groupSourceId: item.listId, matrikelnummer: uid });
  }

  // --- events ---------------------------------------------------------------
  const datedEvents = extract.events.filter((e) => isoDay(e.dated));
  const eventMatch = matchEvents(datedEvents, extract.tEvents, options.eventToleranceDays);
  const events: EventRow[] = [
    ...datedEvents.slice().sort((a, b) => a.Id - b.Id).map(mapAccessEvent),
    ...eventMatch.unmatchedTEvents.map(mapTEvent),
  ];
  for (const m of eventMatch.matches.filter((x) => x.dayDiff > 0)) {
    const ev = datedEvents.find((e) => e.Id === m.eventId);
    const t = extract.tEvents.find((x) => x.Id === m.tEventId);
    registry.add({
      category: "event",
      subject: `events ${m.eventId} ↔ tEvents ${m.tEventId}`,
      detail: `matched ${m.dayDiff} day apart: "${text(ev?.description)}" ${isoDay(ev?.dated)} vs "${text(t?.Event_Contact)}" ${isoDay(t?.Start_Date)} (${text(ev?.lodge)}); tEvents row not imported`,
    });
  }
  for (const e of [...datedEvents.map((x) => ({ id: `events ${x.Id}`, lodge: x.lodge })), ...eventMatch.unmatchedTEvents.map((x) => ({ id: `tEvents ${x.Id}`, lodge: x.Lodge }))]) {
    if (!mapLodge(e.lodge).known) {
      registry.add({ category: "event", subject: e.id, detail: `unknown lodge "${text(e.lodge)}"; no lodges_events row` });
    }
  }
  const eventDay = new Map(datedEvents.map((e) => [e.Id, isoDay(e.dated) as string]));
  const attendance = mapAttendance(extract.eventsItems, eventDay, matrikelFor, options.cutover);

  // --- posts ----------------------------------------------------------------
  const postDates = estimatePostDates(extract.news.map((n) => n.Id), env.newsFolderDates, extract.sourceDate);
  const wStart = windowStart(options.cutover);
  const posts: PostRow[] = [];
  for (const n of extract.news.slice().sort((a, b) => a.Id - b.Id)) {
    const d = postDates.get(n.Id) as PostDate;
    const inside = inWindow(d.date, options.cutover);
    if (inside) {
      const { missingFiles, ...post } = mapPost(n, d.date, options.postsPublicum, env.postFiles);
      posts.push(post);
      if (missingFiles.length) {
        registry.add({ category: "post", subject: `news ${n.Id}`, detail: `referenced file(s) missing on the old site: ${missingFiles.join(", ")}` });
      }
      if (post.attachments.length) {
        registry.add({ category: "post", subject: `news ${n.Id}`, detail: `attachments listed by name only (no attachment field in posts): ${post.attachments.join(", ")}` });
      }
    }
    const straddles = (d.lower === null || d.lower < wStart) && d.upper >= wStart && d.method !== "attachment folder";
    if (straddles) {
      registry.add({
        category: "post",
        subject: `news ${n.Id}`,
        detail: `date uncertain (${d.lower ?? "?"} … ${d.upper}, estimated ${d.date}); ${inside ? "included" : "excluded"} — check against the window start ${wStart}`,
      });
    }
  }

  const stats: Record<string, number | string> = {
    contacts: contacts.length,
    duplicateGroups: merges.length,
    contactsMergedAway: merges.reduce((s, g) => s + g.discarded.length, 0),
    users: users.length,
    usersArchived: users.filter((u) => u.archive).length,
    matrikelPreserved: matrikel.preserved,
    matrikelReassigned: matrikel.reassigned.length,
    matrikelCollisionReassigned: matrikel.reassigned.filter((r) => r.memberno).length,
    dateOfBirthParsed: users.filter((u) => u.dateOfBirth !== PLACEHOLDERS.dateOfBirth).length,
    civicnoStored,
    legacyPasswordHashes: legacyHashes,
    emailConflicts,
    roleAdmin: users.filter((u) => u.roles.includes("Admin")).length,
    roleEditor: users.filter((u) => u.roles.includes("Editor") && !u.roles.includes("Admin")).length,
    roleMemberOnly: users.filter((u) => u.roles.length === 1).length,
    usersLodges: users.filter((u) => u.lodge).length,
    usersAllergies: users.reduce((s, u) => s + u.allergies.length, 0),
    standingList: users.filter((u) => u.standingList).length,
    usersWithNotes: users.filter((u) => u.notes).length,
    profilePhotos: photos,
    cvRows: extract.contactsCv.length,
    cvOrphans,
    cvAchievementRows: buckets.achievement.length,
    cvOfficialRows: buckets.official.length,
    cvMemberNoteRows: buckets.memberNote.length,
    cvReviewRows: buckets.review.length,
    cvExcludedRows: buckets.excluded.length,
    cvNoiseRows: buckets.noise.length,
    cvEmptyRows: buckets.empty.length,
    achievements: achievements.length,
    achievementsMembers: new Set(achievements.map((a) => a.matrikelnummer)).size,
    officials: officials.length,
    officialsCurrent: officials.filter((o) => o.unAppointedAt === null).length,
    groups: groups.length,
    groupMembers: groupMembers.length,
    mailItemsOrphanList: mailOrphans,
    mailItemsMissingContact: mailMissingContact,
    mailItemsMergedDuplicates: mailMergedDuplicates,
    accessEvents: datedEvents.length,
    tEventsVerksamhet: extract.tEvents.filter((t) => text(t.Category) === "Verksamhet").length,
    tEventsMatchedExact: eventMatch.matches.filter((m) => m.dayDiff === 0).length,
    tEventsMatchedNearDate: eventMatch.matches.filter((m) => m.dayDiff > 0).length,
    tEventsImported: eventMatch.unmatchedTEvents.length,
    accessEventsWithoutTEvent: eventMatch.unmatchedEvents.length,
    tEventsSkippedOtherCategory: extract.tEvents.filter((t) => text(t.Category) !== "Verksamhet").length,
    events: events.length,
    eventsComing: events.filter((e) => e.startDate.slice(0, 10) >= options.cutover).length,
    lodgesEvents: events.filter((e) => e.lodge).length,
    attendances: attendance.rows.length,
    attendancesPast: attendance.stats.past,
    attendancesComing: attendance.stats.coming,
    attendancesSkippedNoFlags: attendance.stats.skippedNoFlags,
    attendancesSkippedMissingContact: attendance.stats.skippedMissingContact,
    attendancesSkippedMissingEvent: attendance.stats.skippedMissingEvent,
    attendancesMergedDuplicates: attendance.stats.mergedDuplicates,
    news: extract.news.length,
    posts: posts.length,
    postsWindowStart: wStart,
    postsDatedByFolder: [...postDates.values()].filter((d) => d.method === "attachment folder").length,
    lodgesPosts: posts.reduce((s, p) => s + p.lodges.length, 0),
    registryRows: registry.entries.length,
  };
  for (const [k, v] of Object.entries(placeholderCounts)) stats[`placeholder_${k}`] = v;

  return {
    cutover: options.cutover,
    users,
    groups,
    groupMembers,
    events,
    attendances: attendance.rows,
    posts,
    achievements,
    officials,
    idMap,
    merges,
    mergeHash: mergePlanHash(merges),
    possibleDuplicates,
    eventMatch,
    attendanceStats: attendance.stats,
    postDates,
    registry,
    stats,
  };
}
