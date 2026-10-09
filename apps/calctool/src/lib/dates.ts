import { intlLocale } from "./num";

/**
 * Calendar maths on plain dates (no time of day, no time zone): every date is a UTC midnight, so
 * daylight saving never adds or loses an hour.
 */

export interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

const DAY = 86_400_000;

/** "2026-10-09" → { y, m, d }, or null if it isn't a real date */
export function parseDate(s: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const v = { y: +m[1]!, m: +m[2]!, d: +m[3]! };
  if (v.m < 1 || v.m > 12 || v.d < 1 || v.d > daysInMonth(v.y, v.m))
    return null;
  return v;
}

export function iso(v: Ymd): string {
  return `${String(v.y).padStart(4, "0")}-${String(v.m).padStart(2, "0")}-${String(v.d).padStart(2, "0")}`;
}

/** Today in the reader's own time zone */
export function today(): Ymd {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    m - 1
  ]!;
}

/** Days since 1970-01-01 */
export function dayNum(v: Ymd): number {
  const t = new Date(0);
  t.setUTCFullYear(v.y, v.m - 1, v.d); // Date.UTC would read years 0–99 as 1900–1999
  return Math.round(t.getTime() / DAY);
}

export function fromDayNum(n: number): Ymd {
  const t = new Date(n * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(v: Ymd): number {
  return (((dayNum(v) + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

export function cmp(a: Ymd, b: Ymd): number {
  return dayNum(a) - dayNum(b);
}

/**
 * Whole years, months and days from `a` to `b` (a ≤ b), the way people count ages: the same day
 * of a later month is a whole month; short months borrow the days of the month before `b`.
 */
export function ymdDiff(
  a: Ymd,
  b: Ymd,
): { years: number; months: number; days: number } {
  let years = b.y - a.y;
  let months = b.m - a.m;
  let days = b.d - a.d;
  if (days < 0) {
    months--;
    const pm = b.m === 1 ? 12 : b.m - 1;
    const py = b.m === 1 ? b.y - 1 : b.y;
    days += daysInMonth(py, pm);
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months, days };
}

/** Add years, months and days. A day that doesn't exist (31 April) moves to the month's last day. */
export function addTo(
  v: Ymd,
  {
    years = 0,
    months = 0,
    days = 0,
  }: { years?: number; months?: number; days?: number },
): Ymd {
  let y = v.y + years;
  let m = v.m + months;
  y += Math.floor((m - 1) / 12);
  m = ((((m - 1) % 12) + 12) % 12) + 1;
  const d = Math.min(v.d, daysInMonth(y, m));
  return fromDayNum(dayNum({ y, m, d }) + days);
}

/** Monday–Friday days in [a, b) (b exclusive) */
export function workingDays(a: number, b: number): number {
  if (b <= a) return 0;
  const total = b - a;
  const weeks = Math.floor(total / 7);
  let n = weeks * 5;
  // 1970-01-01 was a Thursday (4)
  for (let d = a + weeks * 7; d < b; d++) {
    const wd = (((d + 4) % 7) + 7) % 7;
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

/** Next birthday on or after `on`. 29 February falls on 1 March in other years. */
export function nextBirthday(birth: Ymd, on: Ymd): Ymd {
  const at = (y: number): Ymd =>
    birth.m === 2 && birth.d === 29 && !isLeap(y)
      ? { y, m: 3, d: 1 }
      : { y, m: birth.m, d: birth.d };
  const b = at(on.y);
  return cmp(b, on) >= 0 ? b : at(on.y + 1);
}

/** "Saturday, 15 June 1990" in the page language */
export function longDate(v: Ymd, lang: "en" | "bn"): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dayNum(v) * DAY));
}
