import type { Locale } from "@kmra/ui/lib/i18n";

/** Bangla (০-৯) and Arabic-Indic digits to Western ones, so any keyboard works. */
export function westernDigits(s: string): string {
  return s
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * A number typed by a person: "1,250.50", " 12 ", "১২০", "−5". Empty → null; anything else that
 * isn't a number → NaN (so callers can tell "nothing yet" from "not a number").
 */
export function parseNum(raw: string): number | null {
  const s = westernDigits(raw)
    .trim()
    .replace(/[\s,_']/g, "")
    .replace(/[−–]/g, "-");
  if (!s) return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/** Intl locale for a page language: Bangla pages show Bangla digits. */
export function intlLocale(lang: Locale): string {
  return lang === "bn" ? "bn-BD" : "en-US";
}

const cache = new Map<string, Intl.NumberFormat>();
function nf(lang: Locale, o: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = lang + JSON.stringify(o);
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new Intl.NumberFormat(intlLocale(lang), o)));
  return f;
}

/** Drop floating-point noise (0.1 + 0.2) before showing a number. */
export function clean(v: number, sig = 12): number {
  if (!Number.isFinite(v) || v === 0) return v;
  return Number(v.toPrecision(sig));
}

/** Formatters for the page language. Values are rounded only here, for display. */
export function formatters(lang: Locale) {
  /** Up to `max` decimals (trailing zeros dropped) */
  const n = (v: number, max = 2, min = 0) => {
    if (!Number.isFinite(v)) return "–";
    const c = clean(v);
    const a = Math.abs(c);
    if (a !== 0 && (a >= 1e15 || a < 10 ** -Math.max(max, 6)))
      return nf(lang, {
        notation: "scientific",
        maximumFractionDigits: 6,
      }).format(c);
    return nf(lang, {
      maximumFractionDigits: max,
      minimumFractionDigits: min,
    }).format(c === 0 ? 0 : c);
  };
  return {
    lang,
    n,
    /** Money: always two decimals, no currency symbol (works for any currency) */
    money: (v: number) => n(v, 2, 2),
    /** Whole number */
    int: (v: number) => n(Math.round(v), 0),
    /** A percentage value already in percent (12.5 → "12.5%") */
    pct: (v: number, max = 2) =>
      nf(lang, { style: "percent", maximumFractionDigits: max }).format(
        clean(v) / 100,
      ),
    /** Plain digits in the page language (for counts and labels) */
    d: (v: number | string) =>
      lang === "bn"
        ? String(v).replace(/\d/g, (x) => "০১২৩৪৫৬৭৮৯"[+x]!)
        : String(v),
  };
}

export type Fmt = ReturnType<typeof formatters>;
