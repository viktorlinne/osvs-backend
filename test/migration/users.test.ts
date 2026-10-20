import {
  LEGACY_PASSWORD_PLACEHOLDER,
  allergiesForPnotes,
  assignMatrikelnummer,
  buildNotes,
  findDuplicateGroups,
  mapArchive,
  mapLodge,
  mergeContacts,
  parseBirthDate,
  parseEmail,
  rolesForAccessLevel,
} from "../../scripts/migration/lib/users";
import { contact } from "./fixtures";

describe("migration users mapping", () => {
  it("uses the shared legacy password placeholder", () => {
    expect(LEGACY_PASSWORD_PLACEHOLDER).toBe("!legacy-migrated");
  });

  it("maps Access lodge codes to seeded lodge names", () => {
    expect(mapLodge("StellaPolaris")).toEqual({ lodge: "Stella Polaris", known: true });
    expect(mapLodge("OrionDK")).toEqual({ lodge: "Orion Damklubb", known: true });
    expect(mapLodge("StamlogenDK")).toEqual({ lodge: "Stamlogen Damklubb", known: true });
    expect(mapLodge("VS")).toEqual({ lodge: null, known: true });
    expect(mapLodge("Atlantis")).toEqual({ lodge: null, known: false });
  });

  it("maps archive values and treats anything else as garbage", () => {
    expect(mapArchive("desceased").archive).toBe("Avliden");
    expect(mapArchive("retired").archive).toBe("Urgången");
    expect(mapArchive("removed").archive).toBe("Avförd");
    expect(mapArchive("")).toEqual({ archive: null, garbage: false });
    expect(mapArchive("I:a grad 080926")).toEqual({ archive: null, garbage: true });
  });

  it("maps accesslevel to cumulative roles", () => {
    expect(rolesForAccessLevel(null)).toEqual(["Member"]);
    expect(rolesForAccessLevel(0)).toEqual(["Member"]);
    expect(rolesForAccessLevel(1)).toEqual(["Member"]);
    expect(rolesForAccessLevel(2)).toEqual(["Editor", "Member"]);
    expect(rolesForAccessLevel(3)).toEqual(["Editor", "Member"]);
    expect(rolesForAccessLevel(4)).toEqual(["Admin", "Editor", "Member"]);
  });

  it.each([
    ["1944-09-04", "1944-09-04"],
    ["1944 09 04", "1944-09-04"],
    ["19440904", "1944-09-04"],
    ["1952- 04-14", "1952-04-14"],
    ["1952.07-15", "1952-07-15"],
    ["1926-04--16", "1926-04-16"],
    ["1996-0917", "1996-09-17"],
    ["510727", "1951-07-27"],
    ["48-04-23", "1948-04-23"],
    ["050101", "2005-01-01"],
  ])("parses birth date %s", (raw, expected) => {
    const r = parseBirthDate(raw, 2026);
    expect(r.dateOfBirth).toBe(expected);
    expect(r.civicno).toBeNull();
  });

  it("stores civicno only for a full personnummer", () => {
    expect(parseBirthDate("510727-1234", 2026)).toEqual({
      dateOfBirth: "1951-07-27",
      civicno: "19510727-1234",
      format: "personnummer",
    });
    expect(parseBirthDate("5107271234", 2026).civicno).toBe("19510727-1234");
  });

  it("rejects impossible or free-text birth dates", () => {
    expect(parseBirthDate("1961-02-288", 2026).format).toBe("invalid");
    expect(parseBirthDate("1961-02-30", 2026).format).toBe("invalid");
    expect(parseBirthDate("okänt", 2026).format).toBe("invalid");
    expect(parseBirthDate("", 2026).format).toBe("empty");
  });

  it("extracts the first e-mail address and keeps leftover text", () => {
    expect(parseEmail(" Kalle@Example.SE ")).toEqual({ email: "kalle@example.se", leftover: null });
    expect(parseEmail("a@b.se, c@d.se")).toEqual({ email: "a@b.se", leftover: "a@b.se, c@d.se" });
    expect(parseEmail("Brevpost.")).toEqual({ email: null, leftover: "Brevpost." });
    expect(parseEmail("")).toEqual({ email: null, leftover: null });
  });

  it("maps only unambiguous specialkost codes to allergies", () => {
    expect(allergiesForPnotes("GL")).toEqual(["Gluten"]);
    expect(allergiesForPnotes("Glutenfri")).toEqual(["Gluten"]);
    expect(allergiesForPnotes("la")).toEqual(["Laktos"]);
    expect(allergiesForPnotes("Fiskfri")).toEqual(["Fisk"]);
    expect(allergiesForPnotes("DILA")).toEqual([]);
    expect(allergiesForPnotes("Vegan")).toEqual([]);
  });

  it("merges duplicates on name + birth date, keeping the most complete row", () => {
    const a = contact({ Id: 1, email: "a@b.se", archive: "I:a grad 080926" });
    const b = contact({ Id: 2, email: "", mobile: "", archive: "retired", password: "abc", passwordSalt: "salt1234", notes: "B" });
    const c = contact({ Id: 3, civicno: "1950-01-03" }); // other birth date: not merged
    const groups = findDuplicateGroups([a, b, c], 2026);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.survivor.Id).toBe(2); // password + salt + notes + archive make it the more complete row
    expect(g.discarded.map((d) => d.Id)).toEqual([1]);
    const merged = mergeContacts(g);
    expect(merged.email).toBe("a@b.se"); // filled from the discarded row
    expect(merged.mobile).toBe("0701-234567");
    expect(merged.archive).toBe("retired");
    expect(merged.password).toBe("abc");
  });

  it("keeps unique numeric member numbers and reassigns collisions", () => {
    const r = assignMatrikelnummer([
      contact({ Id: 1, memberno: "4094" }),
      contact({ Id: 2, memberno: "0706" }),
      contact({ Id: 3, memberno: "706", archive: "desceased" }),
      contact({ Id: 4, memberno: ">400" }),
      contact({ Id: 5, memberno: "" }),
      contact({ Id: 6, memberno: "500" }),
      contact({ Id: 7, memberno: "500" }),
    ]);
    expect(r.byContact.get(1)).toBe(4094);
    expect(r.byContact.get(2)).toBe(706); // only active member of the 706 collision
    expect(r.byContact.get(3)).toBe(4095);
    expect(r.byContact.get(4)).toBe(4096);
    expect(r.byContact.get(5)).toBe(4097);
    expect(r.byContact.get(6)).toBe(4098); // two active members: nobody keeps 500
    expect(r.byContact.get(7)).toBe(4099);
    expect(r.preserved).toBe(2);
  });

  it("builds the member note from all kept sources", () => {
    const notes = buildNotes({
      notes: "Gammal anteckning",
      pnotes: "SP",
      memberNotes: [{ dated: "2001-05-01", description: "Inträde i logen" }],
      official: "TM BM",
      emailLeftover: "Brevpost.",
      phone2: "031-123",
      extra: [],
    });
    expect(notes).toBe(
      [
        "Gammal anteckning",
        "Specialkost (gamla sajten): SP",
        "Historik (gamla sajten):\n- 2001-05-01: Inträde i logen",
        "Tjänst (gamla sajten): TM BM",
        "E-post (gamla sajten): Brevpost.",
        "Telefon 2 (gamla sajten): 031-123",
      ].join("\n\n"),
    );
    expect(buildNotes({ notes: "", pnotes: null, memberNotes: [], official: null, emailLeftover: null, phone2: null, extra: [] })).toBeNull();
  });
});
