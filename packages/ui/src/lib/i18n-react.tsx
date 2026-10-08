import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, lp, t, type Locale } from "./i18n";

/**
 * Language for React islands. The page passes `lang` to the island's root, which wraps its tree
 * in <LangProvider>; anything inside calls useT() for text and useLang() for links.
 */
const Ctx = createContext<Locale>(DEFAULT_LOCALE);

export function LangProvider({
  lang = DEFAULT_LOCALE,
  children,
}: {
  lang?: Locale;
  children: ReactNode;
}) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useLang(): Locale {
  return useContext(Ctx);
}

/** t() bound to the current language */
export function useT() {
  const lang = useContext(Ctx);
  return (text: string, vars?: Record<string, string | number>) =>
    t(lang, text, vars);
}

/** Path in the current language */
export function useLp() {
  const lang = useContext(Ctx);
  return (path: string) => lp(lang, path);
}
