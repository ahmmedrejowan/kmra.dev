import { BN } from "../i18n/bn";
import { BN_PDFTOOL } from "../i18n/bn-pdftool";
import { BN_QRTOOL } from "../i18n/bn-qrtool";
import { BN_DEVTOOL } from "../i18n/bn-devtool";
import { BN_OCRTOOL } from "../i18n/bn-ocrtool";
import { BN_VIDTOOL } from "../i18n/bn-vidtool";
import { BN_KMRA } from "../i18n/bn-kmra";
import { BN_AUDIOTOOL } from "../i18n/bn-audiotool";

/**
 * Languages. English lives at the root (/resize); every other language gets a path prefix
 * (/bn/resize). To add a language: add it here, add its dictionary in `src/i18n/`, add its content
 * in the registry's `locales/`, and list it in the app's `locales` in the registry.
 */
export const LOCALES = [
  { code: "en", name: "English", native: "English", og: "en_US" },
  { code: "bn", name: "Bangla", native: "বাংলা", og: "bn_BD" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";

const DICTS: Partial<Record<Locale, Record<string, string>>> = {
  bn: {
    // Hub strings first: an app's own translation of a shared word wins
    ...BN_KMRA,
    ...BN_AUDIOTOOL,
    ...BN,
    ...BN_PDFTOOL,
    ...BN_QRTOOL,
    ...BN_DEVTOOL,
    ...BN_OCRTOOL,
    ...BN_VIDTOOL,
  },
};

export function isLocale(v: unknown): v is Locale {
  return LOCALES.some((l) => l.code === v);
}

/** Normalise Astro.currentLocale (undefined on apps without i18n routing). */
export function localeOf(v: string | undefined): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** "/resize" in a language: "/resize" for English, "/bn/resize" for Bangla; "/" → "/bn". */
export function lp(locale: Locale, path = "/"): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Split "/bn/resize" into { locale: "bn", path: "/resize" }. */
export function parsePath(pathname: string): { locale: Locale; path: string } {
  const m = /^\/([a-z]{2})(\/.*|$)/.exec(pathname);
  if (m && isLocale(m[1]) && m[1] !== DEFAULT_LOCALE)
    return { locale: m[1], path: m[2] || "/" };
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/**
 * Translate an English UI string. Missing translations fall back to English, so text can be
 * translated a bit at a time. `{name}` placeholders are filled from `vars`.
 */
export function t(
  locale: Locale,
  text: string,
  vars?: Record<string, string | number>,
): string {
  let out = (locale !== DEFAULT_LOCALE && DICTS[locale]?.[text]) || text;
  if (vars)
    for (const [k, v] of Object.entries(vars))
      out = out.replaceAll(`{${k}}`, String(locale === "bn" ? bnDigits(v) : v));
  return out;
}

/** Western digits to Bangla digits (০-৯) */
export function bnDigits(v: string | number): string {
  return String(v).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]!);
}

/** Numbers in the reader's digits */
export function num(locale: Locale, v: string | number): string {
  return locale === "bn" ? bnDigits(v) : String(v);
}
