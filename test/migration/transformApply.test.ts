import fs from "fs";
import path from "path";
import { transform } from "../../scripts/migration/lib/transform";
import {
  assertApplySafetyGate,
  assertMergesApproved,
  selectLookupSeedStatements,
} from "../../scripts/migration/lib/apply";
import { splitSqlStatements } from "../../src/db/migrateUtils";
import { contact, emptyExtract } from "./fixtures";

const OPTIONS = { cutover: "2026-10-21", postsPublicum: false, eventToleranceDays: 0 };

function plan() {
  const extract = emptyExtract({
    contacts: [
      contact({ Id: 1, memberno: "4001", email: "same@x.se", accesslevel: 4, password: "h", passwordSalt: "s", plist: true, pnotes: "GL", link: "1.jpg", grade: "3:20" }),
      contact({ Id: 2, memberno: "4002", email: "", civicno: "1950-01-02", mobile: "" }), // duplicate of 1
      contact({ Id: 3, firstname: "Bertil", memberno: "", email: "SAME@x.se", civicno: "", archive: "desceased", lodge: "StamlogenDK" }),
    ],
    contactsCv: [
      { Id: 1, dated: "2001-01-01", description: "I:a graden", listId: 2 },
      { Id: 2, dated: "2010-01-01", description: "Inträde i logen", listId: 1 },
      { Id: 3, dated: "2010-01-01", description: "något helt annat", listId: 1 },
      { Id: 4, dated: "2010-01-01", description: "I:a graden", listId: 404 },
    ],
    events: [{ Id: 1, dated: "2026-11-01T00:00:00", description: "Grad I", lodge: "Orion", active: true }],
    eventsItems: [
      { itemId: 1, contId: 2, listId: 1, labeled: false, reserved: true, paid: false, attended: false },
      { itemId: 2, contId: 3, listId: 1, labeled: false, reserved: false, paid: false, attended: false },
    ],
    mail: [{ Id: 7, description: " Alla ", lodge: "VS" }],
    mailItems: [
      { itemId: 1, contId: 2, listId: 7 },
      { itemId: 2, contId: 1, listId: 7 },
      { itemId: 3, contId: 3, listId: 99 },
    ],
    news: [{ Id: 50, message: "<b>Hej</b>", page: 1, col: 1, row: 0, share: false, lodge: "Orion" }],
  });
  return transform(extract, OPTIONS, {
    newsFolderDates: new Map([[50, "2026-05-01"]]),
    photoExists: (f) => f === "1.jpg",
  });
}

describe("migration transform (fixture end-to-end)", () => {
  it("builds users with merges, placeholders and preserved member numbers", () => {
    const p = plan();
    expect(p.merges).toHaveLength(1);
    expect(p.users).toHaveLength(2);
    const anders = p.users.find((u) => u.contactId === 1);
    const bertil = p.users.find((u) => u.contactId === 3);
    expect(anders).toMatchObject({
      matrikelnummer: 4001,
      email: "same@x.se",
      passwordHash: "!legacy-migrated",
      legacyPasswordHash: "h",
      legacyPasswordSalt: "s",
      roles: ["Admin", "Editor", "Member"],
      lodge: "Orion",
      allergies: ["Gluten"],
      standingList: true,
      photoFile: "1.jpg",
      dateOfBirth: "1950-01-02",
    });
    expect(anders?.notes).toContain("Specialkost (gamla sajten): GL");
    expect(anders?.notes).toContain("- 2010-01-01: Inträde i logen");
    // Bertil shares the address with an active member: placeholder + note.
    expect(bertil).toMatchObject({
      matrikelnummer: 4002,
      email: "saknas+3@osvs.invalid",
      archive: "Avliden",
      lodge: "Stamlogen Damklubb",
      dateOfBirth: "1900-01-01",
      passwordHash: "!legacy-migrated",
      legacyPasswordHash: null,
    });
    expect(bertil?.notes).toContain("delad med matrikelnummer 4001");
    expect(p.idMap.find((r) => r.contactId === 2)).toMatchObject({ survivorContactId: 1, matrikelnummer: 4001 });
  });

  it("follows merges into history, groups and attendance", () => {
    const p = plan();
    expect(p.achievements.map((a) => [a.matrikelnummer, a.title, a.awardedAt])).toEqual([
      [4001, "I:a Graden", "2001-01-01 00:00:00"],
      [4001, "III:e Graden", "2020-01-01 00:00:00"],
    ]);
    expect(p.groups).toEqual([{ sourceId: 7, name: "Alla", description: "Loge: VS (hela orden)\nMigrerad från gamla sajtens e-postlista (id 7)." }]);
    expect(p.groupMembers).toEqual([{ groupSourceId: 7, matrikelnummer: 4001 }]);
    expect(p.attendances).toEqual([{ matrikelnummer: 4001, eventKey: "events:1", rsvp: 1, bookFood: 1, attended: 0 }]);
    expect(p.posts.map((x) => x.sourceId)).toEqual([50]);
    expect(p.stats.cvOrphans).toBe(1);
    expect(p.registry.entries.some((e) => e.category === "cv-review")).toBe(true);
    expect(p.registry.entries.filter((e) => e.category === "placeholder").map((e) => e.subject).sort()).toEqual(["dateOfBirth", "email"]);
  });
});

describe("migration apply gates", () => {
  it("only allows _dev/_test databases unless overridden", () => {
    expect(() => assertApplySafetyGate("osvs_dev", {})).not.toThrow();
    expect(() => assertApplySafetyGate("osvs_test", {})).not.toThrow();
    expect(() => assertApplySafetyGate("osvs", {})).toThrow(/_dev or _test/);
    expect(() => assertApplySafetyGate("osvs", { MIGRATE_ALLOW_ANY_DB: "true" })).not.toThrow();
    expect(() => assertApplySafetyGate("osvs_dev", { NODE_ENV: "production" })).toThrow(/production/);
    expect(() => assertApplySafetyGate("osvs", { NODE_ENV: "production", MIGRATE_ALLOW_PRODUCTION: "true" })).not.toThrow();
  });

  it("requires the reviewed merge hash when merges exist", () => {
    const p = plan();
    expect(() => assertMergesApproved(p, null)).toThrow(/--approve-merges=/);
    expect(() => assertMergesApproved(p, "000000000000")).toThrow(/does not match/);
    expect(() => assertMergesApproved(p, p.mergeHash)).not.toThrow();
    expect(() => assertMergesApproved({ merges: [], mergeHash: "x" }, null)).not.toThrow();
  });

  it("selects only lookup inserts from seed.sql, including the Damklubb lodges", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../../src/db/seed/seed.sql"), "utf8");
    const selected = selectLookupSeedStatements(splitSqlStatements(sql));
    expect(selected.map((s) => s.match(/INTO\s+`(\w+)`/)?.[1])).toEqual(["roles", "achievements", "officials", "allergies", "lodges"]);
    const lodges = selected[4];
    expect(lodges).toContain("'Orion Damklubb'");
    expect(lodges).toContain("'Stamlogen Damklubb'");
  });
});
