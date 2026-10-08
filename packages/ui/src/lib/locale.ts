import { appUrl, getApp, type App, type AppId } from "@kmra/registry";
import { LOCALES, lp, localeOf, parsePath, type Locale } from "./i18n";

/** What Astro components need from `Astro` */
interface AstroLike {
  currentLocale?: string;
  url: URL;
}

/** Path without ".html" and trailing slash, as Vercel serves it */
function cleanPath(url: URL): string {
  return (
    url.pathname.replace(/(index)?\.html$/, "").replace(/(.)\/$/, "$1") || "/"
  );
}

/** The page's language (from Astro's i18n routing, or the URL on apps without it) */
export function pageLocale(astro: AstroLike): Locale {
  return astro.currentLocale
    ? localeOf(astro.currentLocale)
    : parsePath(cleanPath(astro.url)).locale;
}

/** This page in every language the app has: for the language menu and hreflang links. */
export function langLinks(astro: AstroLike, app: App) {
  const current = pageLocale(astro);
  const { path } = parsePath(cleanPath(astro.url));
  const codes = app.locales ?? ["en"];
  return LOCALES.filter((l) => codes.includes(l.code)).map((l) => ({
    code: l.code,
    name: l.name,
    native: l.native,
    href: lp(l.code, path),
    current: l.code === current,
  }));
}

/** Link to a page in any app, staying in the reader's language when the target has it. */
export function appLink(
  current: AppId,
  locale: Locale,
  target: AppId,
  path = "/",
  dev = false,
): string {
  const has = (getApp(target).locales ?? ["en"]).includes(locale);
  const p = has ? lp(locale, path) : path;
  return current === target ? p : appUrl(target, p, dev);
}
