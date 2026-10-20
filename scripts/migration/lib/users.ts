// OSVS-14: contacts -> users (+ roles, lodges, allergies, notes).
// Pure functions only; no file or DB access.

import type { ArchiveValue, Contact, RoleName } from "./types";

/**
 * Unusable password placeholder for migrated users. Must equal
 * LEGACY_PASSWORD_PLACEHOLDER in src/services/legacyPassword.ts
 * (branch feat/legacy-login, OSVS-22): the auth shim rejects it like a wrong
 * password and verifies legacyPasswordHash instead.
 */
export const LEGACY_PASSWORD_PLACEHOLDER = "!legacy-migrated";

/** Placeholders for NOT NULL users columns (every use is listed in the registry). */
export const PLACEHOLDERS = {
  email: (contactId: number) => `saknas+${contactId}@osvs.invalid`,
  dateOfBirth: "1900-01-01",
  mobile: "",
  city: "",
  address: "",
  zipcode: "",
} as const;

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------

export function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Like text() but keeps line breaks (for notes). */
export function multiline(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

export function normName(value: unknown): string {
  return text(value).toLowerCase();
}

// ---------------------------------------------------------------------------
// Lodges
// ---------------------------------------------------------------------------

/** Access lodge code -> seeded `lodges.name`. `VS` is the whole order: no lodge. */
export const LODGE_NAMES: Record<string, string | null> = {
  Capella: "Capella",
  Orion: "Orion",
  Regulus: "Regulus",
  Stamlogen: "Stamlogen",
  StellaPolaris: "Stella Polaris",
  OrionDK: "Orion Damklubb",
  StamlogenDK: "Stamlogen Damklubb",
  VS: null,
};

export type LodgeMapping = { lodge: string | null; known: boolean };

export function mapLodge(raw: unknown): LodgeMapping {
  const value = text(raw);
  if (!value) return { lodge: null, known: true };
  const key = Object.keys(LODGE_NAMES).find((k) => k.toLowerCase() === value.toLowerCase());
  if (key === undefined) return { lodge: null, known: false };
  return { lodge: LODGE_NAMES[key], known: true };
}

// ---------------------------------------------------------------------------
// Archive, roles
// ---------------------------------------------------------------------------

const ARCHIVE_MAP: Record<string, Exclude<ArchiveValue, null>> = {
  desceased: "Avliden",
  deceased: "Avliden",
  retired: "Urgången",
  removed: "Avförd",
};

export type ArchiveMapping = { archive: ArchiveValue; garbage: boolean };

export function mapArchive(raw: unknown): ArchiveMapping {
  const value = text(raw).toLowerCase();
  if (!value) return { archive: null, garbage: false };
  const mapped = ARCHIVE_MAP[value];
  return mapped ? { archive: mapped, garbage: false } : { archive: null, garbage: true };
}

/** accesslevel 0/1/null -> Member, 2/3 -> Editor, 4 -> Admin (roles are cumulative, as in seed.sql). */
export function rolesForAccessLevel(level: number | null | undefined): RoleName[] {
  const n = level === null || level === undefined ? 0 : Number(level);
  if (n >= 4) return ["Admin", "Editor", "Member"];
  if (n >= 2) return ["Editor", "Member"];
  return ["Member"];
}

// ---------------------------------------------------------------------------
// Birth date / personnummer (contacts.civicno, UI label "född:")
// ---------------------------------------------------------------------------

export type BirthDateResult = {
  dateOfBirth: string | null;
  civicno: string | null;
  format: "empty" | "date" | "yymmdd" | "personnummer" | "invalid";
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Two-digit birth years: 20yy only when that makes the member at least 16 at
 * the cutover, otherwise 19yy.
 */
export function centuryFor(yy: number, cutoverYear: number): number {
  return 2000 + yy <= cutoverYear - 16 ? 2000 + yy : 1900 + yy;
}

/**
 * Parses the old "född:" field. Accepts YYYY-MM-DD, YYYY MM DD, YYYYMMDD and
 * stray separators ("1952- 04-14", "1952.07-15", "1926-04--16"), YYMMDD /
 * YY-MM-DD, and full personnummer (YYMMDD-NNNN, YYMMDDNNNN, YYYYMMDD-NNNN).
 * Only a full personnummer yields `civicno` (normalised to YYYYMMDD-NNNN).
 */
export function parseBirthDate(raw: unknown, cutoverYear: number): BirthDateResult {
  const value = text(raw);
  if (!value) return { dateOfBirth: null, civicno: null, format: "empty" };
  if (!/^[\d\s.\-+/]+$/.test(value)) return { dateOfBirth: null, civicno: null, format: "invalid" };
  const digits = value.replace(/\D/g, "");

  let y: number;
  let m: number;
  let d: number;
  let suffix: string | null = null;
  let format: BirthDateResult["format"];

  if (digits.length === 8 && /^(18|19|20)/.test(digits)) {
    [y, m, d] = [Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8))];
    format = "date";
  } else if (digits.length === 12 && /^(18|19|20)/.test(digits)) {
    [y, m, d] = [Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8))];
    suffix = digits.slice(8);
    format = "personnummer";
  } else if (digits.length === 10) {
    const yy = Number(digits.slice(0, 2));
    y = value.includes("+") ? 1900 + yy : centuryFor(yy, cutoverYear);
    [m, d] = [Number(digits.slice(2, 4)), Number(digits.slice(4, 6))];
    suffix = digits.slice(6);
    format = "personnummer";
  } else if (digits.length === 6) {
    y = centuryFor(Number(digits.slice(0, 2)), cutoverYear);
    [m, d] = [Number(digits.slice(2, 4)), Number(digits.slice(4, 6))];
    format = "yymmdd";
  } else {
    return { dateOfBirth: null, civicno: null, format: "invalid" };
  }

  if (y < 1880 || y > cutoverYear || !validDate(y, m, d)) {
    return { dateOfBirth: null, civicno: null, format: "invalid" };
  }
  const iso = `${y}-${pad2(m)}-${pad2(d)}`;
  return {
    dateOfBirth: iso,
    civicno: suffix ? `${iso.replace(/-/g, "")}-${suffix}` : null,
    format,
  };
}

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

const EMAIL_RE = /[^\s,;<>"'()[\]]+@[^\s,;<>"'()[\]]+\.[a-z]{2,}/gi;

export type EmailResult = { email: string | null; leftover: string | null };

/**
 * Extracts the first address from contacts.email. Anything else in the field
 * (a second address, "Brevpost.", "ED.") is returned as `leftover` so the
 * loader can keep it in the member note.
 */
export function parseEmail(raw: unknown): EmailResult {
  const value = text(raw);
  if (!value) return { email: null, leftover: null };
  const first = (value.match(EMAIL_RE) ?? [])[0];
  if (first === undefined) return { email: null, leftover: value };
  const email = first.replace(/[.]+$/, "").toLowerCase();
  const rest = value.replace(first, "").replace(/[\s,;]+/g, " ").trim();
  return { email, leftover: rest ? value : null };
}

// ---------------------------------------------------------------------------
// Specialkost (contacts.pnotes)
// ---------------------------------------------------------------------------

/**
 * Unambiguous pnotes codes -> seeded `allergies.title`. Everything else (SP,
 * DI, Vegan, Svampfritt, combined codes such as "DILA" or "Fi/sk") lives only
 * in the member note.
 */
export const PNOTES_ALLERGIES: Record<string, string> = {
  gl: "Gluten",
  glutenfri: "Gluten",
  la: "Laktos",
  fiskfri: "Fisk",
};

export function allergiesForPnotes(raw: unknown): string[] {
  const key = text(raw).toLowerCase();
  const title = PNOTES_ALLERGIES[key];
  return title ? [title] : [];
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

/** Columns counted for "most complete row". */
const COMPLETENESS_FIELDS: (keyof Contact)[] = [
  "lastname", "firstname", "address", "zipcode", "city", "phone1", "phone2", "mobile",
  "email", "civicno", "grade", "official", "pnotes", "memberno", "notes", "link",
  "archive", "lodge", "userId", "password", "passwordSalt",
];

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || text(value) === "";
}

export function completeness(contact: Contact): number {
  let n = 0;
  for (const f of COMPLETENESS_FIELDS) if (!isBlank(contact[f])) n++;
  if (contact.accesslevel !== null && contact.accesslevel !== undefined) n++;
  if (contact.plist) n++;
  return n;
}

function isActive(contact: Contact): boolean {
  return mapArchive(contact.archive).archive === null;
}

/** Survivor order: most complete, then active, then has a legacy hash, then newest Id. */
export function compareSurvivor(a: Contact, b: Contact): number {
  return (
    completeness(b) - completeness(a) ||
    Number(isActive(b)) - Number(isActive(a)) ||
    Number(!isBlank(b.password)) - Number(!isBlank(a.password)) ||
    b.Id - a.Id
  );
}

export type DuplicateGroup = {
  key: string;
  survivor: Contact;
  discarded: Contact[];
};

/** Duplicates = same firstname + lastname + parsed birth date (contacts without a parseable date never merge). */
export function findDuplicateGroups(contacts: Contact[], cutoverYear: number): DuplicateGroup[] {
  const byKey = new Map<string, Contact[]>();
  for (const c of contacts) {
    const dob = parseBirthDate(c.civicno, cutoverYear).dateOfBirth;
    if (!dob) continue;
    const key = `${normName(c.firstname)}|${normName(c.lastname)}|${dob}`;
    const list = byKey.get(key) ?? [];
    list.push(c);
    byKey.set(key, list);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(compareSurvivor);
    groups.push({ key, survivor: sorted[0], discarded: sorted.slice(1) });
  }
  return groups.sort((a, b) => a.survivor.Id - b.survivor.Id);
}

/** Same name but no merge (different or missing birth date): reported, never merged. */
export function findPossibleDuplicates(contacts: Contact[], merged: Set<number>): Contact[][] {
  const byName = new Map<string, Contact[]>();
  for (const c of contacts) {
    const key = `${normName(c.firstname)}|${normName(c.lastname)}`;
    const list = byName.get(key) ?? [];
    list.push(c);
    byName.set(key, list);
  }
  return [...byName.values()].filter(
    (list) => list.length > 1 && list.filter((c) => !merged.has(c.Id)).length > 1,
  );
}

/**
 * Merged contact = the survivor, with blank fields filled from the discarded
 * rows (in survivor order). A garbage archive value counts as blank. The
 * legacy password and salt are taken together from one row.
 */
export function mergeContacts(group: DuplicateGroup): Contact {
  const merged: Contact = { ...group.survivor };
  const donors = [...group.discarded].sort(compareSurvivor);
  const fields = Object.keys(merged) as (keyof Contact)[];
  for (const donor of donors) {
    for (const f of fields) {
      if (f === "Id" || f === "password" || f === "passwordSalt" || f === "plist") continue;
      if (f === "archive") {
        if (mapArchive(merged.archive).archive === null && mapArchive(donor.archive).archive !== null) {
          merged.archive = donor.archive;
        }
        continue;
      }
      if (isBlank(merged[f]) && !isBlank(donor[f])) {
        (merged as Record<string, unknown>)[f] = donor[f];
      }
    }
    if (isBlank(merged.password) && !isBlank(donor.password)) {
      merged.password = donor.password;
      merged.passwordSalt = donor.passwordSalt;
    }
    if (!merged.plist && donor.plist) merged.plist = true;
  }
  // Notes from every row are kept (deduplicated).
  const notes = [group.survivor, ...donors]
    .map((c) => multiline(c.notes))
    .filter((n, i, all) => n && all.indexOf(n) === i);
  merged.notes = notes.join("\n\n") || null;
  return merged;
}

/** Field differences between survivor and discarded rows, for the merge report. */
export function mergeDifferences(group: DuplicateGroup): string[] {
  const out: string[] = [];
  const fields: (keyof Contact)[] = [
    "lodge", "archive", "memberno", "email", "accesslevel", "grade", "official", "address", "mobile",
  ];
  for (const f of fields) {
    const values = [group.survivor, ...group.discarded].map((c) => text(c[f]));
    const distinct = [...new Set(values.filter(Boolean))];
    if (distinct.length > 1) out.push(`${f}: ${distinct.join(" / ")}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matrikelnummer
// ---------------------------------------------------------------------------

export type MatrikelResult = {
  byContact: Map<number, number>;
  preserved: number;
  reassigned: { contactId: number; memberno: string; reason: string; matrikelnummer: number }[];
};

export function parseMemberno(raw: unknown): number | null {
  const value = text(raw);
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n > 0 && n <= 2147483647 ? n : null;
}

/**
 * Keeps contacts.memberno as users.matrikelnummer when it is numeric and
 * unique among the surviving contacts. In a collision group the number goes to
 * the only active member when exactly one is active; everyone else, and
 * contacts without a usable number, get new numbers after the highest kept
 * one, in contacts.Id order.
 */
export function assignMatrikelnummer(contacts: Contact[]): MatrikelResult {
  const byNumber = new Map<number, Contact[]>();
  for (const c of contacts) {
    const n = parseMemberno(c.memberno);
    if (n === null) continue;
    const list = byNumber.get(n) ?? [];
    list.push(c);
    byNumber.set(n, list);
  }
  const byContact = new Map<number, number>();
  const pending: { contact: Contact; reason: string }[] = [];
  for (const [n, list] of byNumber) {
    if (list.length === 1) {
      byContact.set(list[0].Id, n);
      continue;
    }
    const active = list.filter(isActive);
    const keeper = active.length === 1 ? active[0] : null;
    for (const c of list) {
      if (keeper && c.Id === keeper.Id) byContact.set(c.Id, n);
      else {
        pending.push({
          contact: c,
          reason: keeper
            ? `memberno ${n} shared by ${list.length} contacts; kept by the only active one (contacts.Id ${keeper.Id})`
            : `memberno ${n} shared by ${list.length} contacts (${active.length} active); nobody keeps it`,
        });
      }
    }
  }
  for (const c of contacts) {
    if (parseMemberno(c.memberno) === null) {
      pending.push({ contact: c, reason: text(c.memberno) ? `memberno "${text(c.memberno)}" is not numeric` : "no memberno" });
    }
  }
  const preserved = byContact.size;
  let next = Math.max(0, ...byContact.values()) + 1;
  const reassigned: MatrikelResult["reassigned"] = [];
  for (const p of pending.sort((a, b) => a.contact.Id - b.contact.Id)) {
    byContact.set(p.contact.Id, next);
    reassigned.push({ contactId: p.contact.Id, memberno: text(p.contact.memberno), reason: p.reason, matrikelnummer: next });
    next++;
  }
  return { byContact, preserved, reassigned };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export type NoteInput = {
  notes: string | null;
  pnotes: string | null;
  memberNotes: { dated: string | null; description: string }[];
  official: string | null;
  emailLeftover: string | null;
  phone2: string | null;
  extra: string[];
};

/** users.notes: original notes + Specialkost + contacts_cv member notes + Tjänst + other kept text. */
export function buildNotes(input: NoteInput): string | null {
  const parts: string[] = [];
  const notes = multiline(input.notes);
  if (notes) parts.push(notes);
  const pnotes = text(input.pnotes);
  if (pnotes) parts.push(`Specialkost (gamla sajten): ${pnotes}`);
  if (input.memberNotes.length) {
    const lines = input.memberNotes.map((n) => `- ${text(n.dated) || "odaterat"}: ${text(n.description)}`);
    parts.push(["Historik (gamla sajten):", ...lines].join("\n"));
  }
  const official = text(input.official);
  if (official) parts.push(`Tjänst (gamla sajten): ${official}`);
  const leftover = text(input.emailLeftover);
  if (leftover) parts.push(`E-post (gamla sajten): ${leftover}`);
  const phone2 = text(input.phone2);
  if (phone2) parts.push(`Telefon 2 (gamla sajten): ${phone2}`);
  for (const e of input.extra) if (text(e)) parts.push(e);
  return parts.length ? parts.join("\n\n") : null;
}

/** Truncates to a column length (counting UTF-16 units, same as MySQL for BMP text). */
export function fit(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
