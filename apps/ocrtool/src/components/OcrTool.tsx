import { lazy, Suspense } from "react";
import type { Preset } from "@kmra/registry";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider } from "@kmra/ui/lib/i18n-react";

/**
 * The OCR tools' island: picks the tool by slug and loads only that tool's code (the PDF tools
 * bring pdf.js, the image tools the OCR engines, each when first used).
 */
const TOOLS: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<{ preset?: Preset }>>
> = {
  "image-to-text": lazy(() => import("./ImageToText")),
  "batch-ocr": lazy(() => import("./BatchOcr")),
  "pdf-to-text": lazy(() => import("./PdfToText")),
  "searchable-pdf": lazy(() => import("./SearchablePdf")),
};

export default function OcrTool({
  tool,
  lang,
  preset,
}: {
  tool: string;
  lang?: Locale;
  preset?: Preset;
}) {
  const Tool = TOOLS[tool];
  return (
    <LangProvider lang={lang}>
      {Tool && (
        <Suspense
          fallback={<div className="devcard dev-loading" aria-busy="true" />}
        >
          <Tool preset={preset} />
        </Suspense>
      )}
    </LangProvider>
  );
}
