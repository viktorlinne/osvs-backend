import { mapAccessEvent, mapAttendance, mapTEvent, matchEvents } from "../../scripts/migration/lib/events";
import {
  estimatePostDates,
  htmlToText,
  inWindow,
  mapPost,
  oldSitePath,
  titleFromHtml,
  windowStart,
} from "../../scripts/migration/lib/posts";
import type { AccessEvent, EventItem, TEvent } from "../../scripts/migration/lib/types";

const ev = (Id: number, dated: string, lodge: string, description = "Grad I"): AccessEvent => ({
  Id, dated: `${dated}T00:00:00`, description, lodge, active: false,
});
const te = (Id: number, date: string, lodge: string, text = "Grad I", category: string | null = "Verksamhet"): TEvent => ({
  Id,
  Start_Date: `${date}T00:00:00`,
  End_Date: `${date}T00:00:00`,
  Start_Time: "1899-12-30T18:30:00",
  End_Time: "1899-12-30T21:00:00",
  Event_Contact: text,
  Link: null,
  Filename: null,
  Lodge: lodge,
  Category: category,
});
const item = (contId: number, listId: number, reserved: boolean, attended: boolean): EventItem => ({
  itemId: contId * 1000 + listId, contId, listId, labeled: false, reserved, paid: true, attended,
});

describe("migration events", () => {
  it("matches events to tEvents one-to-one on lodge and date", () => {
    const r = matchEvents(
      [ev(1, "2024-03-08", "Orion", "Grad V"), ev(2, "2024-04-01", "Capella")],
      [
        te(10, "2024-03-08", "Orion", "Styrelsemöte"),
        te(11, "2024-03-08", "Orion", "Grad V"),
        te(12, "2024-04-02", "Capella"),
        te(13, "2024-04-01", "Regulus"),
        te(14, "2024-04-01", "Capella", "Lokal", "Lokal"),
      ],
    );
    expect(r.matches).toEqual([{ eventId: 1, tEventId: 11, dayDiff: 0 }]);
    expect(r.unmatchedTEvents.map((t) => t.Id)).toEqual([10, 12, 13]);
    expect(r.unmatchedEvents.map((e) => e.Id)).toEqual([2]);
    expect(matchEvents([ev(2, "2024-04-01", "Capella")], [te(12, "2024-04-02", "Capella")], 1).matches).toHaveLength(1);
  });

  it("maps Access events and tEvents rows", () => {
    expect(mapAccessEvent(ev(5, "2026-10-30", "StellaPolaris", "III:e graden"))).toEqual({
      key: "events:5", source: "events", sourceId: 5, title: "III:e graden", description: "III:e graden",
      lodgeMeeting: true, food: true, price: 0, startDate: "2026-10-30 00:00:00", endDate: "2026-10-30 00:00:00", lodge: "Stella Polaris",
    });
    const t = mapTEvent({ ...te(7, "2017-10-27", "VS"), End_Date: "2017-10-20T00:00:00" });
    expect(t.startDate).toBe("2017-10-27 18:30:00");
    expect(t.endDate).toBe("2017-10-27 18:30:00"); // end before start collapses
    expect(t.lodge).toBeNull();
    expect(t.food).toBe(false);
  });

  it("maps attendance flags; booked meal or attendance means rsvp=1", () => {
    const days = new Map([[1, "2026-01-10"], [2, "2026-11-01"]]);
    const matrikel = (c: number) => (c === 99 ? undefined : c === 3 ? 2 : c);
    const { rows, stats } = mapAttendance(
      [
        item(1, 1, true, true), // past
        item(1, 2, true, false), // coming, meal booked
        item(2, 2, false, false), // nothing set: skipped
        item(3, 1, false, true), // contact 3 merged into 2
        item(2, 1, true, false), // same member as above: OR-ed
        item(4, 2, false, true), // coming, attended only
        item(99, 1, true, true), // unknown contact
        item(1, 77, true, true), // unknown event
      ],
      days,
      matrikel,
      "2026-10-21",
    );
    expect(rows).toEqual([
      { matrikelnummer: 1, eventKey: "events:1", rsvp: 1, bookFood: 1, attended: 1 },
      { matrikelnummer: 1, eventKey: "events:2", rsvp: 1, bookFood: 1, attended: 0 },
      { matrikelnummer: 2, eventKey: "events:1", rsvp: 1, bookFood: 1, attended: 1 },
      { matrikelnummer: 4, eventKey: "events:2", rsvp: 1, bookFood: 0, attended: 1 },
    ]);
    expect(stats).toEqual({
      skippedNoFlags: 1, skippedMissingContact: 1, skippedMissingEvent: 1, mergedDuplicates: 1, past: 2, coming: 2,
    });
  });
});

describe("migration posts", () => {
  it("dates posts by attachment folders and id interpolation", () => {
    const folders = new Map([
      [5, "2024-05-21"], // re-upload into an old folder: not an anchor
      [10, "2016-02-20"],
      [20, "2025-01-01"],
      [30, "2025-03-01"],
    ]);
    const d = estimatePostDates([1, 5, 10, 20, 25, 30, 40], folders, "2025-04-10");
    expect(d.get(1)).toMatchObject({ date: "2016-02-20", method: "before first anchor" });
    expect(d.get(5)).toMatchObject({ method: "before first anchor", folderDate: "2024-05-21" });
    expect(d.get(20)).toMatchObject({ date: "2025-01-01", method: "attachment folder" });
    expect(d.get(25)).toMatchObject({ date: "2025-01-30", method: "id interpolation", lower: "2025-01-01", upper: "2025-03-01" });
    expect(d.get(40)).toMatchObject({ method: "id interpolation", lower: "2025-03-01", upper: "2025-04-10" });
  });

  it("uses the 12 months before the cutover", () => {
    expect(windowStart("2026-10-21")).toBe("2025-10-21");
    expect(inWindow("2025-10-21", "2026-10-21")).toBe(true);
    expect(inWindow("2025-10-20", "2026-10-21")).toBe(false);
    expect(inWindow("2026-10-21", "2026-10-21")).toBe(false);
  });

  it("derives a title and keeps the HTML as-is", () => {
    expect(titleFromHtml("<div><b>2026-04-24</b></div><div>Regulus</div><div>Grad I</div>", "Regulus")).toBe(
      "2026-04-24 – Regulus – Grad I",
    );
    expect(titleFromHtml("<img src=\"x.jpg\" />", "Capella")).toBe("Nyhet – Capella");
    const html = "<b>Capellas nya bröder &amp; gäster</b>";
    const p = mapPost({ Id: 9, message: html, page: 1, col: 1, row: 0, share: false, lodge: "Capella" }, "2026-01-02", false);
    expect(p).toEqual({
      sourceId: 9, title: "Capellas nya bröder & gäster", description: "Capellas nya bröder & gäster", publicum: false,
      createdAt: "2026-01-02 12:00:00", lodges: ["Capella"], picture: null, attachments: [], missingFiles: [],
    });
    const shared = mapPost({ Id: 9, message: html, page: 1, col: 1, row: 0, share: true, lodge: "Capella" }, "2026-01-02", true);
    expect(shared.lodges).toHaveLength(7);
    expect(shared.publicum).toBe(true);
  });
});

describe("post HTML conversion", () => {
  it("turns old-site HTML into plain text with line breaks", () => {
    const html =
      "<h1>Rubrik</h1><p>F&ouml;rsta stycket<br />rad tv&aring; &rdquo;citat&rdquo;</p>" +
      "<ul><li>Ett</li><li>Tv&#229;</li></ul><div><img src=\"../db/news/1/a.jpg\" /></div>" +
      "<a href=\"javascript:winopen_blank('../db/news/1/prog.pdf')\">Program</a> " +
      "<a href=\"https://example.org/x\">Extern</a>";
    expect(htmlToText(html)).toBe(
      "Rubrik\n\nFörsta stycket\nrad två ”citat”\n\n• Ett\n• Två\n\nProgram Extern (https://example.org/x)",
    );
  });

  it("normalises old-site references", () => {
    expect(oldSitePath("../db/news/929/H%C3%B6gtid 1.jpg")).toBe("db/news/929/Högtid 1.jpg");
    expect(oldSitePath("javascript:winopen_blank('../DRead/news/5/x.pdf')")).toBe("DRead/news/5/x.pdf");
    expect(oldSitePath("http://www.osvs.se/news/bild.jpg")).toBe("news/bild.jpg");
    expect(oldSitePath("https://example.org/x.jpg")).toBeNull();
    expect(oldSitePath("mailto:a@b.se")).toBeNull();
  });

  it("picks the first existing image as picture and lists other files", () => {
    const files = new Set(["db/news/7/poster.jpg", "db/news/7/prog.pdf", "db/news/7/extra.jpg"]);
    const p = mapPost(
      {
        Id: 7,
        message:
          "<img src=\"../db/news/7/gone.jpg\"><img src=\"../db/news/7/poster.jpg\">Text " +
          "<a href=\"javascript:winopen_blank('../db/news/7/prog.pdf')\">Program</a>",
        page: 1, col: 1, row: 0, share: false, lodge: "Orion",
      },
      "2026-03-01",
      false,
      { exists: (r) => files.has(r), folderFiles: () => ["db/news/7/extra.jpg"] },
    );
    expect(p.picture).toEqual({ kind: "file", path: "db/news/7/poster.jpg", name: "poster.jpg" });
    expect(p.attachments).toEqual(["prog.pdf"]);
    expect(p.missingFiles).toEqual(["db/news/7/gone.jpg"]);
    expect(p.description).toBe("Text Program\n\nBilagor på gamla webbplatsen: prog.pdf");
  });

  it("falls back to an image in the post folder and to inline data images", () => {
    const folder = mapPost(
      { Id: 8, message: "Bara text", page: 1, col: 1, row: 0, share: false, lodge: "Orion" },
      "2026-03-01",
      false,
      { exists: () => true, folderFiles: () => ["db/news/8/a.pdf", "db/news/8/b.png"] },
    );
    expect(folder.picture).toEqual({ kind: "file", path: "db/news/8/b.png", name: "b.png" });
    const inline = mapPost(
      { Id: 9, message: "<img src=\"data:image/png;base64,iVBORw0K\">", page: 1, col: 1, row: 0, share: false, lodge: null },
      "2026-03-01",
      false,
    );
    expect(inline.picture).toEqual({ kind: "data", contentType: "image/png", base64: "iVBORw0K", name: "inline-9" });
  });
});
