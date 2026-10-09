import { lazy, Suspense, useMemo } from "react";
import type { Preset } from "@kmra/registry";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";
import { TOOLS } from "../tools";
import "../color.css";

/** One island for every tool; each tool's code loads only on its own page. */
export default function ColorTool({
  slug,
  preset,
  lang,
}: {
  slug: string;
  preset?: Preset;
  lang?: Locale;
}) {
  const Tool = useMemo(() => (TOOLS[slug] ? lazy(TOOLS[slug]) : null), [slug]);
  return (
    <LangProvider lang={lang}>
      <Suspense fallback={<div className="ct-card ct-loading" />}>
        {Tool && <Tool preset={preset} />}
      </Suspense>
    </LangProvider>
  );
}
