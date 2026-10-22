import {
  formatRegistrationClosesAtSv,
  getRegistrationClosesAt,
  isRegistrationClosedStockholm,
} from "../../src/utils/eventDateTime";

describe("getRegistrationClosesAt", () => {
  it.each([
    // Monday meeting closes the evening before.
    ["2026-11-09 18:30:00", "2026-11-08 21:00:00"],
    // Sunday meeting closes the previous Sunday, not the same day.
    ["2026-11-08 12:00:00", "2026-11-01 21:00:00"],
    // Other weekdays close on the Sunday of the same week.
    ["2026-11-11 18:00:00", "2026-11-08 21:00:00"],
    ["2026-11-14 18:00:00", "2026-11-08 21:00:00"],
    // Month and year boundaries.
    ["2027-01-02 18:00:00", "2026-12-27 21:00:00"],
    ["2026-03-02 18:00:00", "2026-03-01 21:00:00"],
    // A meeting just after midnight on Monday still closes Sunday 21:00.
    ["2026-11-09 00:30:00", "2026-11-08 21:00:00"],
    // ISO input is accepted like other event date inputs.
    ["2026-11-09T18:30", "2026-11-08 21:00:00"],
  ])("start %s closes at %s", (startDate, expected) => {
    expect(getRegistrationClosesAt(startDate)).toBe(expected);
  });

  it("returns null for an unparseable start date", () => {
    expect(getRegistrationClosesAt("")).toBeNull();
    expect(getRegistrationClosesAt("not a date")).toBeNull();
  });
});

describe("isRegistrationClosedStockholm", () => {
  it("closes at 21:00 Stockholm on a winter-time (CET, UTC+1) Sunday", () => {
    const start = "2026-11-09 18:30:00";
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-11-08T19:59:59Z")),
    ).toBe(false);
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-11-08T20:00:00Z")),
    ).toBe(true);
  });

  it("closes at 21:00 Stockholm on a summer-time (CEST, UTC+2) Sunday", () => {
    const start = "2026-06-15 18:30:00";
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-06-14T18:59:59Z")),
    ).toBe(false);
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-06-14T19:00:00Z")),
    ).toBe(true);
  });

  it("uses summer time when the cutoff Sunday is the spring DST switch", () => {
    // Clocks go forward 02:00 -> 03:00 on Sunday 2026-03-29.
    const start = "2026-03-30 18:30:00";
    expect(getRegistrationClosesAt(start)).toBe("2026-03-29 21:00:00");
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-03-29T18:59:59Z")),
    ).toBe(false);
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-03-29T19:00:00Z")),
    ).toBe(true);
  });

  it("uses winter time when the cutoff Sunday is the autumn DST switch", () => {
    // Clocks go back 03:00 -> 02:00 on Sunday 2026-10-25.
    const start = "2026-10-28 18:30:00";
    expect(getRegistrationClosesAt(start)).toBe("2026-10-25 21:00:00");
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-10-25T19:59:59Z")),
    ).toBe(false);
    expect(
      isRegistrationClosedStockholm(start, new Date("2026-10-25T20:00:00Z")),
    ).toBe(true);
  });

  it("is closed after the meeting has started", () => {
    expect(
      isRegistrationClosedStockholm(
        "2026-11-09 18:30:00",
        new Date("2026-11-09T18:00:00Z"),
      ),
    ).toBe(true);
  });

  it("does not block on an unparseable start date", () => {
    expect(isRegistrationClosedStockholm("not a date")).toBe(false);
  });
});

describe("formatRegistrationClosesAtSv", () => {
  it("formats the cutoff in Swedish", () => {
    expect(formatRegistrationClosesAtSv("2026-11-08 21:00:00")).toBe(
      "söndag 8 november kl. 21:00",
    );
  });
});
