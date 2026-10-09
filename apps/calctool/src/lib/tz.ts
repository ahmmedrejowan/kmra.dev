/**
 * Time zones through the browser's Intl API (its zone data includes daylight saving), so there's
 * no table to keep up to date.
 */

const FALLBACK = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Every zone the browser knows, plus UTC */
export function allZones(): string[] {
  try {
    const list = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (list?.length) return list.includes("UTC") ? list : ["UTC", ...list];
  } catch {
    // older browsers
  }
  return FALLBACK;
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "America/New_York" → "New York"; "America/Argentina/Buenos_Aires" → "Buenos Aires" */
export function cityName(zone: string): string {
  if (zone === "UTC") return "UTC";
  const city = (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  return RENAMED[city] ?? city;
}

/** Browsers still use some old zone names; show the city's current name */
const RENAMED: Record<string, string> = {
  Calcutta: "Kolkata",
  Saigon: "Ho Chi Minh City",
  Katmandu: "Kathmandu",
  Rangoon: "Yangon",
  Kiev: "Kyiv",
  Godthab: "Nuuk",
};

/** "America/New_York" → "America" (the region, for search) */
export function region(zone: string): string {
  return zone.includes("/") ? zone.split("/")[0]!.replace(/_/g, " ") : "";
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFmt(zone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    fmtCache.set(zone, f);
  }
  return f;
}

/** Wall-clock fields of an instant in a zone */
export function wall(zone: string, t: number) {
  const p = Object.fromEntries(
    partsFmt(zone)
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  return {
    y: +p.year!,
    m: +p.month!,
    d: +p.day!,
    h: +p.hour! % 24,
    min: +p.minute!,
    s: +p.second!,
  };
}

/** Offset of a zone from UTC at an instant, in minutes (Dhaka: +360) */
export function offsetMin(zone: string, t: number): number {
  const w = wall(zone, t);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / 60000);
}

/**
 * The instant when the clock in `zone` shows this date and time. Times skipped by a daylight
 * saving change move forward by the gap; repeated times take the first one.
 */
export function instant(
  zone: string,
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const o1 = offsetMin(zone, guess);
  let t = guess - o1 * 60000;
  const o2 = offsetMin(zone, t);
  if (o2 !== o1) {
    const t2 = guess - o2 * 60000;
    // Use whichever reading shows the requested time; if neither does, it's in a DST gap
    t = offsetMin(zone, t2) === o2 ? Math.min(t, t2) : Math.max(t, t2);
  }
  return t;
}

/** "GMT+5:30" style label */
export function offsetLabel(min: number): string {
  if (min === 0) return "UTC";
  const s = min < 0 ? "−" : "+";
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${s}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Short zone name like "EDT" or "GMT+6" in a language */
export function zoneAbbr(zone: string, t: number, locale: string): string {
  try {
    const p = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      timeZoneName: "short",
    })
      .formatToParts(new Date(t))
      .find((x) => x.type === "timeZoneName");
    return p?.value ?? "";
  } catch {
    return "";
  }
}
