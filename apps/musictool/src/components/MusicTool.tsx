import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { Preset } from "@kmra/registry";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";
import { TOOLS } from "../tools";
import "../music.css";

/**
 * One island for every music tool; each tool's code loads only on its own page. Tools render in
 * the browser only: they start from the reader's saved settings, the page's URL (?bpm=) and
 * Web Audio, none of which exist at build time.
 */
export default function MusicTool({
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
  const fallback = <div className="mt-card mt-loading" />;
  return (
    <LangProvider lang={lang}>
      <Suspense fallback={fallback}>{Tool && mounted ? <Tool preset={preset} /> : fallback}</Suspense>
    </LangProvider>
  );
}
