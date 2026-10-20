// Manual registry: every row that needs a human decision or action after the
// load. Rendered into `_reports/manual-registry.md` (personal data, gitignored).

export type RegistryCategory =
  | "merge"
  | "matrikelnummer"
  | "placeholder"
  | "email"
  | "birth-date"
  | "allergy"
  | "grade"
  | "achievement"
  | "official"
  | "cv-review"
  | "event"
  | "post"
  | "photo"
  | "lodge";

export type RegistryEntry = {
  category: RegistryCategory;
  contactId?: number;
  matrikelnummer?: number;
  name?: string;
  subject: string;
  detail: string;
};

export class Registry {
  readonly entries: RegistryEntry[] = [];

  add(entry: RegistryEntry): void {
    this.entries.push(entry);
  }

  countBy(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.entries) counts[e.category] = (counts[e.category] ?? 0) + 1;
    return counts;
  }
}

const CATEGORY_TITLES: Record<RegistryCategory, string> = {
  merge: "Duplicate merges (review before --apply)",
  matrikelnummer: "Matrikelnummer collisions / reassignments",
  placeholder: "Placeholder values written to NOT NULL columns",
  email: "E-mail conflicts and non-address e-mail text",
  "birth-date": "Birth dates that could not be parsed",
  allergy: "Specialkost codes not mapped to an allergy",
  grade: "Grade registry (contacts.grade / contacts_cv grade rows)",
  achievement: "Achievements needing review",
  official: "Tjänster needing a manual decision",
  "cv-review": "contacts_cv / official strings classified as review",
  event: "Events needing review",
  post: "Posts needing review",
  photo: "Profile photos",
  lodge: "Lodge values",
};

export function escapeCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|");
}

export function renderRegistry(registry: Registry, header: string[]): string {
  const lines = [...header, ""];
  const order = Object.keys(CATEGORY_TITLES) as RegistryCategory[];
  for (const category of order) {
    const rows = registry.entries.filter((e) => e.category === category);
    if (rows.length === 0) continue;
    lines.push(`## ${CATEGORY_TITLES[category]} (${rows.length})`, "");
    lines.push("| contacts.Id | matrikelnr | Name | Subject | Detail |", "|---|---|---|---|---|");
    for (const r of rows) {
      lines.push(
        `| ${r.contactId ?? ""} | ${r.matrikelnummer ?? ""} | ${escapeCell(r.name)} | ${escapeCell(r.subject)} | ${escapeCell(r.detail)} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
