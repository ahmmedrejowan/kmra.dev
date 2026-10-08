/**
 * Cron expressions: parse (5 fields, 6 with seconds first, 7 with a year last; names, ranges,
 * steps, lists, Quartz's ? L W #, and the @daily-style macros), describe in words, and list the
 * next run times in any IANA time zone, stepping through wall-clock time in that zone so
 * daylight saving changes are handled the way cron handles them.
 */
import { partsIn } from "./time";

export type FieldId =
  "second" | "minute" | "hour" | "dom" | "month" | "dow" | "year";

/** How the day-of-week field numbers days: Unix 0–7 (0 and 7 are Sunday) or Quartz 1–7 */
export type DowMode = "unix" | "quartz";

export const FIELD_LABEL: Record<FieldId, string> = {
  second: "Second",
  minute: "Minute",
  hour: "Hour",
  dom: "Day of month",
  month: "Month",
  dow: "Day of week",
  year: "Year",
};

const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");
const DAYS = "SUN MON TUE WED THU FRI SAT".split(" ");

interface Spec {
  min: number;
  max: number;
}

function spec(id: FieldId, mode: DowMode): Spec {
  switch (id) {
    case "second":
    case "minute":
      return { min: 0, max: 59 };
    case "hour":
      return { min: 0, max: 23 };
    case "dom":
      return { min: 1, max: 31 };
    case "month":
      return { min: 1, max: 12 };
    case "dow":
      return mode === "quartz" ? { min: 1, max: 7 } : { min: 0, max: 7 };
    case "year":
      return { min: 1970, max: 2099 };
  }
}

/** Allowed values, for the breakdown table */
export function allowed(id: FieldId, mode: DowMode): string {
  const s = spec(id, mode);
  const base = `${s.min}–${s.max}`;
  if (id === "month") return `${base}, JAN–DEC`;
  if (id === "dow") return `${base}, SUN–SAT, L #`;
  if (id === "dom") return `${base}, L W ?`;
  return base;
}

export type Item =
  /** `*`, `?`, `*\/n`, `a`, `a-b`, `a-b/n`, `a/n` (values in the field's own numbering) */
  | {
      kind: "range";
      a: number;
      b: number;
      step: number;
      star: boolean;
      single: boolean;
      open: boolean;
    }
  /** Day of month: L, L-n */
  | { kind: "last"; before: number }
  /** Day of month: LW */
  | { kind: "lastWeekday" }
  /** Day of month: nW */
  | { kind: "nearestWeekday"; day: number }
  /** Day of week: nL (0 = Sunday) */
  | { kind: "lastDow"; dow: number }
  /** Day of week: n#k (0 = Sunday) */
  | { kind: "nthDow"; dow: number; n: number };

export interface Field {
  id: FieldId;
  raw: string;
  items: Item[];
  /** Plain values this field allows (normalised: day of week 0 = Sunday … 6) */
  values: Set<number>;
  /** Starts with * or is ?: the field doesn't restrict anything (for the day OR rule) */
  star: boolean;
}

export interface Cron {
  fields: Field[];
  /** Field by id (seconds and year may be missing) */
  get: Partial<Record<FieldId, Field>>;
  mode: DowMode;
  /** The macro this came from, e.g. @daily */
  macro?: string;
  /** @reboot: runs once at startup, no times */
  reboot?: boolean;
}

/** A problem with the expression; `field` says which one */
export class CronError extends Error {
  constructor(
    message: string,
    public vars: Record<string, string | number> = {},
    public field?: FieldId,
    public index?: number,
  ) {
    super(message);
  }
}

export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

/** The fields of an expression as typed (macros expanded), with their ids if the count is right */
export function splitFields(input: string): {
  tokens: string[];
  ids: FieldId[] | null;
} {
  let text = input.trim().replace(/\s+/g, " ");
  if (MACROS[text.toLowerCase()]) text = MACROS[text.toLowerCase()]!;
  const tokens = text && !text.startsWith("@") ? text.split(" ") : [];
  return { tokens, ids: layout(tokens.length) };
}

function layout(n: number): FieldId[] | null {
  if (n === 5) return ["minute", "hour", "dom", "month", "dow"];
  if (n === 6) return ["second", "minute", "hour", "dom", "month", "dow"];
  if (n === 7)
    return ["second", "minute", "hour", "dom", "month", "dow", "year"];
  return null;
}

/** A number or a name in a field, in the field's own numbering */
function value(tok: string, id: FieldId, mode: DowMode, index: number): number {
  const up = tok.toUpperCase();
  let v: number;
  if (/^\d+$/.test(tok)) v = Number(tok);
  else if (id === "month" && MONTHS.includes(up)) v = MONTHS.indexOf(up) + 1;
  else if (id === "dow" && DAYS.includes(up))
    v = DAYS.indexOf(up) + (mode === "quartz" ? 1 : 0);
  else
    throw new CronError(
      tok === ""
        ? "{field}: a value is missing"
        : '{field}: "{value}" isn\'t a number or a name',
      { value: tok },
      id,
      index,
    );
  const s = spec(id, mode);
  if (v < s.min || v > s.max)
    throw new CronError(
      "{field}: {value} is out of range ({min}–{max})",
      { value: tok, min: s.min, max: s.max },
      id,
      index,
    );
  return v;
}

/** Day of week in the field's numbering → 0 = Sunday … 6 = Saturday */
function normDow(v: number, mode: DowMode): number {
  return mode === "quartz" ? v - 1 : v % 7;
}

function parseItem(
  part: string,
  id: FieldId,
  mode: DowMode,
  index: number,
): Item {
  const up = part.toUpperCase();
  const err = (msg: string, vars: Record<string, string | number> = {}) =>
    new CronError(msg, { value: part, ...vars }, id, index);

  if (id === "dom") {
    if (up === "L") return { kind: "last", before: 0 };
    if (up === "LW") return { kind: "lastWeekday" };
    let m = /^L-(\d+)$/.exec(up);
    if (m) {
      const n = Number(m[1]);
      if (n > 30) throw err("{field}: L-{n} goes back too far", { n });
      return { kind: "last", before: n };
    }
    m = /^(\d+)W$/.exec(up);
    if (m)
      return { kind: "nearestWeekday", day: value(m[1]!, id, mode, index) };
    if (/[LW]/.test(up))
      throw err('{field}: "{value}" isn\'t a valid L or W value');
  }
  if (id === "dow") {
    if (up === "L")
      return {
        kind: "range",
        a: 6,
        b: 6,
        step: 1,
        star: false,
        single: true,
        open: false,
      };
    let m = /^([A-Z]+|\d+)L$/.exec(up);
    if (m)
      return {
        kind: "lastDow",
        dow: normDow(value(m[1]!, id, mode, index), mode),
      };
    m = /^([A-Z]+|\d+)#(\d+)$/.exec(up);
    if (m) {
      const n = Number(m[2]);
      if (n < 1 || n > 5)
        throw err("{field}: # must be followed by 1 to 5", { n });
      return {
        kind: "nthDow",
        dow: normDow(value(m[1]!, id, mode, index), mode),
        n,
      };
    }
  }

  const s = spec(id, mode);
  const [range = "", stepTxt, extra] = part.split("/");
  if (extra !== undefined) throw err('{field}: "{value}" has more than one /');
  let step = 1;
  if (stepTxt !== undefined) {
    if (!/^\d+$/.test(stepTxt))
      throw err('{field}: the step "{step}" isn\'t a number', {
        step: stepTxt,
      });
    step = Number(stepTxt);
    if (step < 1) throw err("{field}: a step must be 1 or more");
  }
  if (range === "*" || range === "?") {
    if (range === "?" && id !== "dom" && id !== "dow")
      throw err("{field}: ? is only allowed in day of month and day of week");
    return {
      kind: "range",
      a: s.min,
      b: id === "dow" ? (mode === "quartz" ? 7 : 6) : s.max,
      step,
      star: true,
      single: false,
      open: false,
    };
  }
  const dash = range.indexOf("-", 1);
  if (dash > 0) {
    const a = value(range.slice(0, dash), id, mode, index);
    const b = value(range.slice(dash + 1), id, mode, index);
    return {
      kind: "range",
      a,
      b,
      step,
      star: false,
      single: false,
      open: false,
    };
  }
  const a = value(range, id, mode, index);
  if (stepTxt !== undefined)
    return {
      kind: "range",
      a,
      b: id === "dow" ? (mode === "quartz" ? 7 : 6) : s.max,
      step,
      star: false,
      single: false,
      open: true,
    };
  return {
    kind: "range",
    a,
    b: a,
    step: 1,
    star: false,
    single: true,
    open: false,
  };
}

/** Plain values of a range item (wraps round when a > b, e.g. FRI-MON or 22-2) */
function expand(
  it: Item & { kind: "range" },
  id: FieldId,
  mode: DowMode,
): number[] {
  const s = spec(id, mode);
  const out: number[] = [];
  const span = it.a <= it.b ? it.b - it.a : s.max - it.a + 1 + (it.b - s.min);
  for (let k = 0; k <= span; k += it.step) {
    let v = it.a + k;
    if (v > s.max) v = v - s.max - 1 + s.min;
    out.push(id === "dow" ? normDow(v, mode) : v);
  }
  return out;
}

function parseField(
  raw: string,
  id: FieldId,
  mode: DowMode,
  index: number,
): Field {
  const parts = raw.split(",");
  const items = parts.map((p) => {
    if (!p) throw new CronError("{field}: a value is missing", {}, id, index);
    return parseItem(p, id, mode, index);
  });
  const values = new Set<number>();
  for (const it of items)
    if (it.kind === "range")
      for (const v of expand(it, id, mode)) values.add(v);
  return { id, raw, items, values, star: raw.startsWith("*") || raw === "?" };
}

export function parseCron(input: string, mode: DowMode = "unix"): Cron {
  let text = input.trim().replace(/\s+/g, " ");
  if (!text) throw new CronError("Type a cron expression");
  let macro: string | undefined;
  if (text.startsWith("@")) {
    const m = text.toLowerCase();
    if (m === "@reboot")
      return { fields: [], get: {}, mode, macro: m, reboot: true };
    if (!MACROS[m])
      throw new CronError(
        '"{value}" isn\'t a cron macro. Try @daily, @hourly, @weekly, @monthly, @yearly or @reboot.',
        { value: text },
      );
    macro = m;
    text = MACROS[m]!;
  }
  const toks = text.split(" ");
  const ids = layout(toks.length);
  if (!ids)
    throw new CronError(
      "Expected 5 fields (minute, hour, day of month, month, day of week), or 6 with seconds first. Found {n}.",
      { n: toks.length },
    );
  const fields = toks.map((t, i) => parseField(t, ids[i]!, mode, i));
  const get: Cron["get"] = {};
  for (const f of fields) get[f.id] = f;
  if (get.dom!.raw === "?" && get.dow!.raw === "?")
    throw new CronError(
      "Day of month and day of week can't both be ?",
      {},
      "dow",
      ids.indexOf("dow"),
    );
  return { fields, get, mode, macro };
}

/* ---------- matching ---------- */

function daysIn(y: number, mo: number): number {
  const t = new Date(0);
  t.setUTCFullYear(y, mo, 0);
  return t.getUTCDate();
}

function weekdayOf(y: number, mo: number, d: number): number {
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  return t.getUTCDay();
}

function domMatch(f: Field, y: number, mo: number, d: number): boolean {
  const last = daysIn(y, mo);
  for (const it of f.items) {
    if (it.kind === "range") {
      if (f.values.has(d)) return true;
    } else if (it.kind === "last") {
      if (d === last - it.before) return true;
    } else if (it.kind === "lastWeekday") {
      let t = last;
      while (weekdayOf(y, mo, t) % 6 === 0) t--;
      if (d === t) return true;
    } else if (it.kind === "nearestWeekday") {
      // The weekday nearest that day, staying inside the month
      let t = Math.min(it.day, last);
      const wd = weekdayOf(y, mo, t);
      if (wd === 6) t = t === 1 ? 3 : t - 1;
      else if (wd === 0) t = t === last ? t - 2 : t + 1;
      if (d === t) return true;
    }
  }
  return false;
}

function dowMatch(
  f: Field,
  y: number,
  mo: number,
  d: number,
  wd: number,
): boolean {
  if (f.values.has(wd)) return true;
  for (const it of f.items) {
    if (it.kind === "lastDow" && wd === it.dow && d + 7 > daysIn(y, mo))
      return true;
    if (it.kind === "nthDow" && wd === it.dow && Math.ceil(d / 7) === it.n)
      return true;
  }
  return false;
}

/**
 * Does the cron run on this day? Standard cron rule: when both day of month and day of week are
 * restricted (neither starts with * or is ?), a day matches if EITHER matches.
 */
export function dayMatches(c: Cron, y: number, mo: number, d: number): boolean {
  const { dom, dow, month, year } = c.get;
  if (year && !year.values.has(y)) return false;
  if (!month!.values.has(mo)) return false;
  const wd = weekdayOf(y, mo, d);
  const a = domMatch(dom!, y, mo, d);
  const b = dowMatch(dow!, y, mo, d, wd);
  return dom!.star || dow!.star ? a && b : a || b;
}

/** Both day fields restricted, so the OR rule applies */
export function usesOrRule(c: Cron): boolean {
  return !!c.get.dom && !c.get.dom.star && !c.get.dow!.star;
}

/* ---------- next runs ---------- */

export interface Wall {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}
export interface Run {
  ms: number;
  wall: Wall;
  /** Zone offset at that moment, minutes east of UTC */
  offset: number;
}
/** Times that don't exist that day (clocks went forward) */
export interface Skip {
  y: number;
  mo: number;
  d: number;
  first: Wall;
  last: Wall;
  count: number;
}

const sorted = (f: Field | undefined, fallback: number[]) =>
  f ? [...f.values].sort((a, b) => a - b) : fallback;

/**
 * The next `count` run times after `from`, iterating calendar days and wall-clock times in `tz`.
 * A time that doesn't exist (clocks go forward) is skipped; a time that happens twice (clocks go
 * back) runs once, at the first occurrence. Gives up after 28 years (the calendar repeats).
 */
export function nextRuns(
  c: Cron,
  from: number,
  tz: string,
  count = 10,
): { runs: Run[]; skips: Skip[] } {
  const runs: Run[] = [];
  const skips: Skip[] = [];
  if (c.reboot) return { runs, skips };
  const secs = sorted(c.get.second, [0]);
  const mins = sorted(c.get.minute, []);
  const hours = sorted(c.get.hour, []);
  const start = partsIn(from, tz);
  const startSec = start.h * 3600 + start.mi * 60 + start.s;
  const base = new Date(0);
  base.setUTCFullYear(start.y, start.mo - 1, start.d);
  const baseMs = base.getTime();

  for (let i = 0; i < 366 * 28 && runs.length < count; i++) {
    const day = new Date(baseMs + i * 86400000);
    const y = day.getUTCFullYear();
    const mo = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    if (c.get.year && y > 2099) break;
    if (!dayMatches(c, y, mo, d)) continue;
    const noon = baseMs + i * 86400000 + 43200000;
    const offA = partsIn(noon - 86400000, tz).offset;
    const offB = partsIn(noon + 86400000, tz).offset;
    let skip: Skip | null = null;
    for (const h of hours)
      for (const mi of mins)
        for (const s of secs) {
          if (i === 0 && h * 3600 + mi * 60 + s <= startSec) continue;
          const wall = { y, mo, d, h, mi, s };
          const ms = wallToUtc(wall, tz, offA, offB);
          if (ms === null) {
            if (skip) {
              skip.last = wall;
              skip.count++;
            } else {
              skip = { y, mo, d, first: wall, last: wall, count: 1 };
              skips.push(skip);
            }
            continue;
          }
          if (ms <= from) continue;
          runs.push({ ms, wall, offset: partsIn(ms, tz).offset });
          if (runs.length >= count) return { runs, skips };
        }
  }
  return { runs, skips };
}

/** Wall-clock time in a zone → the earliest instant showing it, or null if it doesn't exist */
function wallToUtc(
  w: Wall,
  tz: string,
  offA: number,
  offB: number,
): number | null {
  const t = new Date(0);
  t.setUTCFullYear(w.y, w.mo - 1, w.d);
  t.setUTCHours(w.h, w.mi, w.s, 0);
  const base = t.getTime();
  if (offA === offB) return base - offA * 60000;
  const hits = [offA, offB]
    .map((o) => base - o * 60000)
    .filter((ms) => {
      const p = partsIn(ms, tz);
      return p.h === w.h && p.mi === w.mi && p.s === w.s && p.d === w.d;
    });
  return hits.length ? Math.min(...hits) : null;
}

/* ---------- words ---------- */

export type Tr = (s: string, vars?: Record<string, string | number>) => string;

export interface Words {
  t: Tr;
  /** "15th" in English; the plain number elsewhere */
  nth: (n: number) => string;
  month: (n: number) => string;
  day: (n: number) => string;
}

export function englishNth(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

const UNIT: Record<FieldId, string> = {
  second: "second",
  minute: "minute",
  hour: "hour",
  dom: "day of the month",
  month: "month",
  dow: "day of the week",
  year: "year",
};

const pad = (n: number) => String(n).padStart(2, "0");

function list(w: Words, xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return w.t("{a} and {b}", { a: xs.slice(0, -1).join(", "), b: xs.at(-1)! });
}

function name(w: Words, id: FieldId, mode: DowMode, v: number): string {
  if (id === "month") return w.month(v);
  if (id === "dow") return w.day(normDow(v, mode));
  return String(v);
}

/** One field in words, e.g. "every 15th minute", "every hour from 9 through 17", "Monday through Friday" */
export function fieldWords(f: Field, mode: DowMode, w: Words): string {
  const unit = w.t(UNIT[f.id]);
  const named = f.id === "month" || f.id === "dow";
  const singles: string[] = [];
  const phrases: string[] = [];
  const nm = (v: number) => name(w, f.id, mode, v);
  for (const it of f.items) {
    switch (it.kind) {
      case "range":
        if (it.single) singles.push(nm(it.a));
        else if (it.star)
          phrases.push(
            it.step === 1
              ? w.t("every {unit}", { unit })
              : w.t("every {nth} {unit}", { unit, nth: w.nth(it.step) }),
          );
        else if (it.step === 1)
          phrases.push(
            named
              ? w.t("{a} through {b}", { a: nm(it.a), b: nm(it.b) })
              : w.t("every {unit} from {a} through {b}", {
                  unit,
                  a: nm(it.a),
                  b: nm(it.b),
                }),
          );
        else
          phrases.push(
            w.t("every {nth} {unit} from {a} through {b}", {
              unit,
              nth: w.nth(it.step),
              a: nm(it.a),
              b: nm(it.b),
            }),
          );
        break;
      case "last":
        phrases.push(
          it.before
            ? w.t("{n} days before the last day of the month", { n: it.before })
            : w.t("the last day of the month"),
        );
        break;
      case "lastWeekday":
        phrases.push(w.t("the last weekday of the month"));
        break;
      case "nearestWeekday":
        phrases.push(
          w.t("the weekday nearest day {n} of the month", { n: it.day }),
        );
        break;
      case "lastDow":
        phrases.push(
          w.t("the last {day} of the month", { day: w.day(it.dow) }),
        );
        break;
      case "nthDow":
        phrases.push(
          w.t("the {nth} {day} of the month", {
            nth: w.nth(it.n),
            day: w.day(it.dow),
          }),
        );
        break;
    }
  }
  if (singles.length)
    phrases.unshift(
      named || f.id === "year"
        ? list(w, singles)
        : f.id === "dom"
          ? w.t("day {list} of the month", { list: list(w, singles) })
          : w.t("{unit} {list}", { unit, list: list(w, singles) }),
    );
  return list(w, phrases);
}

const isSingles = (f: Field | undefined) =>
  !!f && f.items.every((i) => i.kind === "range" && i.single);
const isEvery = (f: Field | undefined) =>
  !!f &&
  f.items.length === 1 &&
  f.items[0]!.kind === "range" &&
  f.items[0]!.star &&
  f.items[0]!.step === 1;

/** The whole expression in one sentence */
export function describe(c: Cron, w: Words): string {
  if (c.reboot)
    return w.t("Once, when the cron service starts (usually at boot).");
  const { second, minute, hour, dom, dow, month, year } = c.get;
  const mode = c.mode;
  const parts: string[] = [];

  // Time of day
  const sec0 = !second || second.raw === "0";
  if (
    (sec0 || isSingles(second)) &&
    isSingles(minute) &&
    isSingles(hour) &&
    minute!.values.size * hour!.values.size * (second?.values.size ?? 1) <= 6
  ) {
    const times: string[] = [];
    for (const h of sorted(hour, []))
      for (const m of sorted(minute, []))
        for (const s of sorted(second, [0]))
          times.push(`${pad(h)}:${pad(m)}${sec0 ? "" : ":" + pad(s)}`);
    parts.push(w.t("At {what}", { what: list(w, times) }));
  } else {
    const bits: string[] = [];
    if (!sec0) bits.push(fieldWords(second!, mode, w));
    if (sec0 || !isEvery(minute) || !isEvery(hour))
      bits.push(fieldWords(minute!, mode, w));
    if (!isEvery(hour)) bits.push(fieldWords(hour!, mode, w));
    let what = bits[0]!;
    for (const b of bits.slice(1)) what = w.t("{a} past {b}", { a: what, b });
    parts.push(w.t("At {what}", { what }));
  }

  // Days
  const domW =
    (dom!.star && isEvery(dom)) || dom!.raw === "?"
      ? null
      : fieldWords(dom!, mode, w);
  const dowW =
    (dow!.star && isEvery(dow)) || dow!.raw === "?"
      ? null
      : fieldWords(dow!, mode, w);
  if (domW && dowW)
    parts.push(
      usesOrRule(c)
        ? w.t("on {a} or on {b}", { a: domW, b: dowW })
        : w.t("on {a}, but only if it's {b}", { a: domW, b: dowW }),
    );
  else if (domW || dowW)
    parts.push(w.t("on {what}", { what: (domW ?? dowW)! }));

  if (!isEvery(month))
    parts.push(w.t("in {what}", { what: fieldWords(month!, mode, w) }));
  if (year && !isEvery(year))
    parts.push(w.t("in {what}", { what: fieldWords(year, mode, w) }));
  return w.t("{sentence}.", { sentence: parts.join(" ") });
}

/** Plain values a field allows, for the breakdown table ("0, 15, 30, 45") */
export function fieldValues(f: Field, w: Words): string {
  const vs = [...f.values].sort((a, b) => a - b);
  const label = (v: number) =>
    f.id === "month" ? w.month(v) : f.id === "dow" ? w.day(v) : String(v);
  const shown = vs.slice(0, 20).map(label).join(", ");
  return vs.length > 20 ? `${shown} … (${vs.length})` : shown;
}
