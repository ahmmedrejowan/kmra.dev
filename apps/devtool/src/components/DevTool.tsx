import { lazy, Suspense, useMemo } from "react";
import type { Preset } from "@kmra/registry";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";
import { TOOLS } from "../tools";
import { SourceProvider } from "../lib/kit";

/** One island for every developer tool; each tool's code loads only on its own page. */
export default function DevTool({
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
      <Suspense fallback={<div className="devcard dev-loading" />}>
        {Tool && (
          <SourceProvider slug={slug}>
            <Tool preset={preset} />
          </SourceProvider>
        )}
      </Suspense>
    </LangProvider>
  );
}
