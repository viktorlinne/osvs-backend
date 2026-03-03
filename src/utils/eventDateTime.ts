const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const SQL_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function isValidParts(parts: DateParts): boolean {
  if (!Number.isInteger(parts.year) || parts.year < 1000 || parts.year > 9999) {
    return false;
  }
  if (!Number.isInteger(parts.month) || parts.month < 1 || parts.month > 12) {
    return false;
  }
  if (
    !Number.isInteger(parts.day) ||
    parts.day < 1 ||
    parts.day > daysInMonth(parts.year, parts.month)
  ) {
    return false;
  }
  if (!Number.isInteger(parts.hour) || parts.hour < 0 || parts.hour > 23) {
    return false;
  }
  if (
    !Number.isInteger(parts.minute) ||
    parts.minute < 0 ||
    parts.minute > 59
  ) {
    return false;
  }
  if (
    !Number.isInteger(parts.second) ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    return false;
  }
  return true;
}

function toSqlDateTime(parts: DateParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

function parseSqlLikeInput(raw: string): string | null {
  const m = raw.match(SQL_DATE_TIME_RE);
  if (!m) return null;

  const parts: DateParts = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: m[6] ? Number(m[6]) : 0,
  };
  if (!isValidParts(parts)) return null;
  return toSqlDateTime(parts);
}

function stockholmDatePartsFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toStockholmSqlDateTime(date: Date): string {
  const parts = stockholmDatePartsFormatter().formatToParts(date);
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const p of parts) {
    values[p.type] = p.value;
  }

  const year = Number(values.year ?? "");
  const month = Number(values.month ?? "");
  const day = Number(values.day ?? "");
  const hour = Number(values.hour ?? "");
  const minute = Number(values.minute ?? "");
  const second = Number(values.second ?? "");

  const typedParts: DateParts = { year, month, day, hour, minute, second };
  if (!isValidParts(typedParts)) return "";
  return toSqlDateTime(typedParts);
}

export function normalizeEventDateTimeInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const sqlLike = parseSqlLikeInput(raw);
  if (sqlLike) return sqlLike;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const stockholm = toStockholmSqlDateTime(parsed);
  return stockholm || null;
}

export function getNowStockholmSqlDateTime(now: Date = new Date()): string {
  return toStockholmSqlDateTime(now);
}

export function compareSqlDateTime(a: string, b: string): number {
  const left = normalizeEventDateTimeInput(a);
  const right = normalizeEventDateTimeInput(b);
  if (!left || !right) return Number.NaN;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function isAtOrBeforeNowStockholm(
  eventDateTime: string,
  now: Date = new Date(),
): boolean {
  const normalized = normalizeEventDateTimeInput(eventDateTime);
  if (!normalized) return false;
  const nowSql = getNowStockholmSqlDateTime(now);
  if (!nowSql) return false;
  const cmp = compareSqlDateTime(normalized, nowSql);
  return Number.isFinite(cmp) && cmp <= 0;
}

