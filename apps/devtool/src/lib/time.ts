/**
 * Time helpers for the timestamp converter: unit detection, wall-clock parts in any IANA time
 * zone, and the common text formats (ISO 8601, RFC 2822, ISO week).
 */

export type Unit = "s" | "ms" | "us" | "ns";
export type Parsed = { ms: number; unit: Unit | "date"; digits: number };

/** Largest time JavaScript dates can hold (±100,000,000 days) */
const MAX_MS = 8.64e15;

/** Digits → unit: up to 11 are seconds, 12–14 milliseconds, 15–17 microseconds, more nanoseconds */
export function detectUnit(digits: number): Unit {
  return digits <= 11 ? "s" : digits <= 14 ? "ms" : digits <= 17 ? "us" : "ns";
}

export function parseTime(raw: string, force: Unit | "auto"): Parsed | null {
  const t = raw.trim();
  if (!t) return null;
  const n = t.replace(/[\s_,']/g, "");
  if (/^-?\d+(\.\d+)?$/.test(n)) {
    const [int = "", frac = ""] = n.replace(/^-/, "").split(".");
    const neg = n.startsWith("-");
    const digits = int.replace(/^0+(?=\d)/, "").length;
    const unit = force === "auto" ? detectUnit(digits) : force;
    let ms: number;
    if (unit === "s" || unit === "ms")
      ms = Number(n) * (unit === "s" ? 1000 : 1);
    else {
      // Big integers lose precision as floats: divide as BigInt first
      const div = unit === "us" ? 1000n : 1_000_000n;
      const whole = BigInt(int || "0");
      const rest = Number(`0.${frac || "0"}`);
      ms = Number(whole / div) + (Number(whole % div) + rest) / Number(div);
      if (neg) ms = -ms;
    }
    return Math.abs(ms) <= MAX_MS ? { ms, unit, digits } : null;
  }
  const d = Date.parse(t);
  return Number.isNaN(d) ? null : { ms: d, unit: "date", digits: 0 };
}

export interface Parts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  /** Minutes east of UTC */
  offset: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      era: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** The wall-clock date and time in a zone, and that zone's UTC offset at the moment */
export function partsIn(ms: number, tz: string): Parts {
  const whole = Math.floor(ms / 1000) * 1000;
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(whole)) p[x.type] = x.value;
  let y = Number(p.year);
  if (p.era === "BC" || p.era === "B") y = 1 - y;
  const parts = {
    y,
    mo: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    mi: Number(p.minute),
    s: Number(p.second),
  };
  const asUtc = new Date(0);
  asUtc.setUTCFullYear(parts.y, parts.mo - 1, parts.d);
  asUtc.setUTCHours(parts.h, parts.mi, parts.s, 0);
  return { ...parts, offset: Math.round((asUtc.getTime() - whole) / 60000) };
}

/** A wall-clock time in a zone → Unix milliseconds */
export function zoneToUtc(wall: Omit<Parts, "offset">, tz: string): number {
  const base = new Date(0);
  base.setUTCFullYear(wall.y, wall.mo - 1, wall.d);
  base.setUTCHours(wall.h, wall.mi, wall.s, 0);
  let guess = base.getTime();
  for (let i = 0; i < 3; i++)
    guess = base.getTime() - partsIn(guess, tz).offset * 60000;
  return guess;
}

const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");
const year = (y: number) =>
  y < 0 ? "-" + pad(y, 6) : y > 9999 ? "+" + pad(y, 6) : pad(y, 4);

export function offsetText(min: number, colon = true) {
  const sign = min < 0 ? "-" : "+";
  return `${sign}${pad(Math.floor(Math.abs(min) / 60))}${colon ? ":" : ""}${pad(Math.abs(min) % 60)}`;
}

function fraction(ms: number) {
  const f = ((ms % 1000) + 1000) % 1000;
  return f ? "." + pad(Math.floor(f), 3) : "";
}

/** ISO 8601 in a zone, e.g. 2023-11-14T22:13:20Z or 2023-11-15T04:13:20+06:00 */
export function iso(ms: number, tz: string): string {
  const p = partsIn(ms, tz);
  const off = tz === "UTC" ? "Z" : offsetText(p.offset);
  return `${year(p.y)}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${fraction(ms)}${off}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/** Day of the week (0 = Sunday) of a calendar date */
export function weekday(p: Pick<Parts, "y" | "mo" | "d">): number {
  const d = new Date(0);
  d.setUTCFullYear(p.y, p.mo - 1, p.d);
  return d.getUTCDay();
}

/** RFC 2822 (email dates), e.g. Tue, 14 Nov 2023 22:13:20 +0000 */
export function rfc2822(ms: number, tz: string): string {
  const p = partsIn(ms, tz);
  return `${DAYS[weekday(p)]}, ${pad(p.d)} ${MONTHS[p.mo - 1]} ${year(p.y)} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)} ${offsetText(p.offset, false)}`;
}

/** ISO 8601 week: weeks start on Monday; week 1 holds the year's first Thursday */
export function isoWeek(p: Pick<Parts, "y" | "mo" | "d">): {
  week: number;
  year: number;
} {
  const d = new Date(0);
  d.setUTCFullYear(p.y, p.mo - 1, p.d);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // that week's Thursday
  const wy = d.getUTCFullYear();
  const jan1 = new Date(0);
  jan1.setUTCFullYear(wy, 0, 1);
  const week = 1 + Math.floor((d.getTime() - jan1.getTime()) / 86400000 / 7);
  return { week, year: wy };
}

/** Day of the year, 1–366 */
export function dayOfYear(p: Pick<Parts, "y" | "mo" | "d">): number {
  const a = new Date(0);
  a.setUTCFullYear(p.y, p.mo - 1, p.d);
  const b = new Date(0);
  b.setUTCFullYear(p.y, 0, 1);
  return Math.round((a.getTime() - b.getTime()) / 86400000) + 1;
}

/** "3 hours ago" / "in 2 days" in the reader's language */
export function relative(ms: number, now: number, locale?: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diff = (ms - now) / 1000;
  const a = Math.abs(diff);
  const steps: [number, Intl.RelativeTimeFormatUnit, number][] = [
    [60, "second", 1],
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [86400 * 7, "day", 86400],
    [86400 * 30.44, "week", 86400 * 7],
    [86400 * 365.25, "month", 86400 * 30.44],
    [Infinity, "year", 86400 * 365.25],
  ];
  const [, unit, size] = steps.find(([lim]) => a < lim)!;
  return rtf.format(Math.round(diff / size), unit);
}

/** The value for an <input type="datetime-local"> */
export function localInput(p: Parts): string {
  if (p.y < 1 || p.y > 9999) return "";
  return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
}
