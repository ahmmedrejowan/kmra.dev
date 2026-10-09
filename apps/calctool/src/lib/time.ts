/** Durations and clock times, in whole seconds. */

/**
 * A duration as people write it: "2:45", "1:30:15", "2h 45m", "90m", "45 min", "1.5h", "1.5"
 * (hours). Returns seconds, null when empty, NaN when it can't be read.
 */
export function parseDuration(raw: string): number | null {
  const s = raw
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .trim()
    .toLowerCase();
  if (!s) return null;
  let m = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s);
  if (m) return +m[1]! * 3600 + +m[2]! * 60 + +(m[3] ?? 0);
  m = /^(\d+(?:\.\d+)?|\.\d+)$/.exec(s);
  if (m) return Math.round(+m[1]! * 3600);
  // Units: 2h 45m 10s, 1d 2h, 90 min
  const re =
    /(\d+(?:\.\d+)?|\.\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])/g;
  let total = 0;
  let used = "";
  let any = false;
  for (const x of s.matchAll(re)) {
    any = true;
    used += x[0];
    const v = +x[1]!;
    const u = x[2]![0]!;
    total += v * (u === "d" ? 86400 : u === "h" ? 3600 : u === "m" ? 60 : 1);
  }
  if (!any || s.replace(/\s+/g, "") !== used.replace(/\s+/g, "")) return NaN;
  return Math.round(total);
}

/** "HH:MM" from an <input type="time"> → minutes after midnight */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1]!;
  const min = +m[2]!;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Split seconds into parts (absolute value; the caller shows the sign) */
export function parts(sec: number) {
  const a = Math.abs(sec);
  return {
    d: Math.floor(a / 86400),
    h: Math.floor((a % 86400) / 3600),
    /** Hours including whole days */
    hh: Math.floor(a / 3600),
    m: Math.floor((a % 3600) / 60),
    s: a % 60,
  };
}

/** "4:15" or "4:15:30" (hours can go past 24) */
export function hms(sec: number): string {
  const p = parts(sec);
  const sign = sec < 0 ? "−" : "";
  const mm = String(p.m).padStart(2, "0");
  return p.s
    ? `${sign}${p.hh}:${mm}:${String(p.s).padStart(2, "0")}`
    : `${sign}${p.hh}:${mm}`;
}
