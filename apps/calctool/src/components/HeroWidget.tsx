import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";

/** The home page's hero widget (to be built). */
export default function HeroWidget({ lang = "en" }: { lang?: Locale }) {
  return <LangProvider lang={lang}>{null}</LangProvider>;
}
