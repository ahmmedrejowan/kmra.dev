import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { Preset } from "@kmra/registry";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";
import { TOOLS } from "../tools";
import "../calc.css";

/**
 * Tools that start from today's date, the clock or the reader's time zone. They render only in
 * the browser: the build machine's "now" would never match the reader's.
 */
const CLIENT_ONLY = new Set(["age", "date-difference", "time-zones"]);

/** One island for every tool; each tool's code loads only on its own page. */
export default function CalcTool({
  slug,
  preset,
  lang,
}: {
  slug: string;
  preset?: Preset;
  lang?: Locale;
}) {
  const Tool = useMemo(() => (TOOLS[slug] ? lazy(TOOLS[slug]) : null), [slug]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fallback = <div className="calc-card calc-loading" />;
  return (
    <LangProvider lang={lang}>
      <Suspense fallback={fallback}>
        {Tool && (mounted || !CLIENT_ONLY.has(slug)) ? (
          <Tool preset={preset} />
        ) : (
          fallback
        )}
      </Suspense>
    </LangProvider>
  );
}
