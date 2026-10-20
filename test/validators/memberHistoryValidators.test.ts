import {
  DATES_CONFIRMED_MESSAGE,
  NOTE_REQUIRED_MESSAGE,
  validateAchievementEntryBody,
  validateDeleteEntryBody,
  validateOfficialEntryBody,
  isValidCalendarDate,
} from "../../src/validators/memberHistoryValidators";

describe("memberHistory validators", () => {
  const validOfficial = {
    officialId: 2,
    appointedAt: "2019-01-15",
    unappointedAt: "2021-01-15",
    datesConfirmed: true,
  };

  it("accepts a new tjänst entry without note when dates are confirmed", () => {
    const result = validateOfficialEntryBody(validOfficial, "create");
    expect(result).toEqual({
      ok: true,
      data: {
        officialId: 2,
        appointedAt: "2019-01-15",
        unappointedAt: "2021-01-15",
        note: null,
      },
    });
  });

  it("treats an empty end date as pågående (null)", () => {
    const result = validateOfficialEntryBody(
      { ...validOfficial, unappointedAt: "" },
      "create",
    );
    expect(result.ok && result.data.unappointedAt).toBeNull();
  });

  it.each([undefined, false, "true", 1])(
    "rejects a tjänst entry when datesConfirmed is %p",
    (datesConfirmed) => {
      const result = validateOfficialEntryBody(
        { ...validOfficial, datesConfirmed },
        "create",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fields?.datesConfirmed).toBe(DATES_CONFIRMED_MESSAGE);
      }
    },
  );

  it("requires a note when updating a tjänst entry", () => {
    const missing = validateOfficialEntryBody(validOfficial, "update");
    const blank = validateOfficialEntryBody(
      { ...validOfficial, note: "   " },
      "update",
    );
    for (const result of [missing, blank]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fields?.note).toBe(NOTE_REQUIRED_MESSAGE);
    }

    const ok = validateOfficialEntryBody(
      { ...validOfficial, note: " Rättat datum " },
      "update",
    );
    expect(ok.ok && ok.data.note).toBe("Rättat datum");
  });

  it("rejects an end date before the start date and invalid calendar dates", () => {
    const reversed = validateOfficialEntryBody(
      { ...validOfficial, unappointedAt: "2018-12-31" },
      "create",
    );
    expect(!reversed.ok && reversed.fields?.unappointedAt).toBe(
      "Slutdatum kan inte vara före startdatum",
    );
    expect(isValidCalendarDate("2023-02-29")).toBe(false);
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
  });

  it("requires a note when updating an achievement entry but not when creating one", () => {
    const body = { achievementId: 3, awardedAt: "2021-03-20" };
    expect(validateAchievementEntryBody(body, "create").ok).toBe(true);
    const update = validateAchievementEntryBody(body, "update");
    expect(!update.ok && update.fields?.note).toBe(NOTE_REQUIRED_MESSAGE);
  });

  it("requires a note when deleting an entry", () => {
    for (const input of [undefined, {}, { note: "" }]) {
      const result = validateDeleteEntryBody(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe("Formuläret innehåller fel");
        expect(result.fields).toEqual({ note: NOTE_REQUIRED_MESSAGE });
      }
    }
    expect(validateDeleteEntryBody({ note: "Dubblett" })).toEqual({
      ok: true,
      data: { note: "Dubblett" },
    });
  });
});
