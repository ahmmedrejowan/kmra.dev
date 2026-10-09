import type { Preset } from "@kmra/registry";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";

/** Placeholder until the tools are built (they stay hidden while not ready). */
export default function VidTool({
  lang,
}: {
  tool: string;
  lang?: Locale;
  preset?: Preset;
}) {
  return <LangProvider lang={lang}>{null}</LangProvider>;
}
