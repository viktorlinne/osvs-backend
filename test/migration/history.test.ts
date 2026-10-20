import {
  buildAchievements,
  buildOfficials,
  classifyCv,
  parseCvDate,
} from "../../scripts/migration/lib/history";
import type { ClassifiedCv, HistoryIssue } from "../../scripts/migration/lib/history";

function cv(rows: [number, string | null, string][], contactId = 1): ClassifiedCv[] {
  const b = classifyCv(rows.map(([id, dated, description]) => ({ id, dated, description, contactId })));
  return [...b.achievement, ...b.official, ...b.memberNote, ...b.review];
}

describe("migration contacts_cv dates", () => {
  it.each([
    ["2002-08-30", "2002-08-30", false, null],
    ["2006-9-1", "2006-09-01", false, null],
    ["2016-03.12", "2016-03-12", false, null],
    ["2001", "2001-01-01", true, null],
    ["2002-2004", "2002-01-01", true, { start: 2002, end: 2004 }],
    ["1989--2001", "1989-01-01", true, { start: 1989, end: 2001 }],
    ["2003-fortf", "2003-01-01", true, { start: 2003, end: null }],
    ["2004--", "2004-01-01", true, { start: 2004, end: null }],
  ])("parses %s", (raw, date, yearOnly, range) => {
    const r = parseCvDate(raw, 2026);
    expect(r).toEqual({ date, yearOnly, range, valid: true });
  });

  it("rejects unusable dates", () => {
    expect(parseCvDate("194-09-10", 2026).valid).toBe(false);
    expect(parseCvDate("", 2026).valid).toBe(false);
    expect(parseCvDate(null, 2026).valid).toBe(false);
    expect(parseCvDate("2030-01-01", 2026).valid).toBe(false);
  });
});

describe("migration achievements", () => {
  it("lets contacts_cv win, fills gaps from contacts.grade and reports conflicts", () => {
    const issues: HistoryIssue[] = [];
    const items = buildAchievements(
      1,
      cv([
        [1, "1990-05-01", "Recipierade i I:a gr."],
        [2, "1995-03-01", "II:a graden"],
        [3, "2001-01-01", "Förtjänstmedalj"],
        [4, "2010-01-01", "25 års veterantecken"],
      ]),
      "II:96",
      2026,
      issues,
    );
    expect(items.map((i) => [i.title, i.date])).toEqual([
      ["I:a Graden", "1990-05-01"],
      ["II:a Graden", "1995-03-01"],
      ["Förtjänstmedalj", "2001-01-01"],
      ["25 år Veteran", "2010-01-01"],
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toMatch(/year conflict/);
  });

  it("adds a grade-field grade with its year and registers grades without a year", () => {
    const issues: HistoryIssue[] = [];
    expect(buildAchievements(1, [], "8:23", 2026, issues)).toEqual([
      { title: "VIII:e Graden", date: "2023-01-01", source: "contacts.grade (year only)" },
    ]);
    expect(buildAchievements(1, [], "10:e", 2026, issues)).toEqual([]);
    expect(issues.map((i) => i.category)).toEqual(["grade"]);
  });

  it("keeps the earliest date when an achievement appears twice", () => {
    const issues: HistoryIssue[] = [];
    const items = buildAchievements(1, cv([[1, "2005-01-01", "Ordensring"], [2, "2001-01-01", "Ordensring"]]), "", 2026, issues);
    expect(items).toEqual([{ title: "Ordensring", date: "2001-01-01", source: "contacts_cv:1" }]);
    expect(issues).toHaveLength(1);
  });
});

describe("migration officials (tjänster)", () => {
  it("uses year ranges from the text or the dated field", () => {
    const issues: HistoryIssue[] = [];
    const rows = buildOfficials(
      1,
      100,
      cv([
        [1, "2002-08-30", "Ledande Broder (2002-2004)"],
        [2, "1989--2001", "Orator"],
        [3, "2003-fortf", "Förtroendeutskottet"],
      ]),
      "FU",
      2026,
      issues,
    );
    expect(rows.map((r) => [r.title, r.appointedAt, r.unAppointedAt])).toEqual([
      ["Ledande Broder", "2002-08-30 00:00:00", "2004-12-31 23:59:59"],
      ["Orator", "1989-01-01 00:00:00", "2001-12-31 23:59:59"],
      ["Förtroendeutskottet", "2003-01-01 00:00:00", null],
    ]);
    expect(issues).toEqual([]);
  });

  it("loads a single-date row as current only when the title is in contacts.official", () => {
    const issues: HistoryIssue[] = [];
    const rows = buildOfficials(1, 100, cv([[1, "2011-07-01", "Kurator"], [2, "2002", "Webmaster"]]), "KUR", 2026, issues);
    expect(rows).toEqual([
      { matrikelnummer: 100, title: "Kurator", appointedAt: "2011-07-01 00:00:00", unAppointedAt: null, source: "contacts_cv:1" },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].subject).toBe("Webmaster");
    expect(issues[0].detail).toMatch(/end unknown/);
  });

  it("registers current and past titles without dated evidence instead of inventing dates", () => {
    const issues: HistoryIssue[] = [];
    const rows = buildOfficials(1, 100, [], "XLM KUR", 2026, issues);
    expect(rows).toEqual([]);
    expect(issues.map((i) => i.subject).sort()).toEqual(["Kurator", "Logemästare"]);
  });
});
