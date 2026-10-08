import type { OcrResult } from "./types";

/**
 * Output formats for OCR results. Each returns the text plus, where it makes sense, the character
 * range of every line in it (index = result.lines index), so a line on the image can be found in
 * the text and back.
 */
export type OutputFormat = "text" | "paragraphs" | "json" | "hocr";

export interface Formatted {
  text: string;
  /** [start, end) in `text` for each line, or null when lines can't be mapped */
  ranges: ([number, number] | null)[] | null;
}

export const FORMAT_EXT: Record<OutputFormat, [ext: string, mime: string]> = {
  text: ["txt", "text/plain"],
  paragraphs: ["md", "text/markdown"],
  json: ["json", "application/json"],
  hocr: ["html", "text/html"],
};

/** Plain text: the engine's own text, lines on their own line, blocks separated by a blank line */
function plain(r: OcrResult): Formatted {
  const ranges: ([number, number] | null)[] = [];
  let at = 0;
  for (const l of r.lines) {
    const i = r.text.indexOf(l.text, at);
    if (i < 0) {
      ranges.push(null);
      continue;
    }
    ranges.push([i, i + l.text.length]);
    at = i + l.text.length;
  }
  return { text: r.text, ranges };
}

// Scripts written without spaces between words
const CLOSE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

/**
 * Paragraphs: the lines of each block joined into running text (hyphenated breaks rejoined), with a
 * blank line between paragraphs. Reads well pasted into a document or a Markdown file.
 */
function paragraphs(r: OcrResult): Formatted {
  const ranges: ([number, number] | null)[] = r.lines.map(() => null);
  const paras = r.text.split(/\n{2,}/);
  let li = 0;
  let out = "";
  for (const para of paras) {
    const lines = para.split("\n").filter((s) => s.trim());
    if (!lines.length) continue;
    if (out) out += "\n\n";
    for (let j = 0; j < lines.length; j++) {
      const s = lines[j]!.trim();
      if (j > 0) {
        const prev = out.slice(-1);
        if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(s)) out = out.slice(0, -1);
        else if (!(CLOSE.test(prev) && CLOSE.test(s[0] ?? ""))) out += " ";
      }
      // Find which result line this is (same order as the engine's text)
      const hit = r.lines.findIndex((l, k) => k >= li && l.text.trim() === s);
      const start = out.length;
      out += s;
      if (hit >= 0) {
        ranges[hit] = [start, out.length];
        li = hit + 1;
      }
    }
  }
  return { text: out, ranges };
}

function json(r: OcrResult): Formatted {
  const data = {
    engine: r.engine,
    languages: r.langs,
    confidence: r.confidence,
    width: r.width,
    height: r.height,
    text: r.text,
    lines: r.lines.map((l) => ({
      text: l.text,
      confidence: l.confidence,
      box: l.box,
      words: l.words.map((w) => ({
        text: w.text,
        confidence: w.confidence,
        box: w.box,
      })),
    })),
  };
  return { text: JSON.stringify(data, null, 2), ranges: null };
}

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`,
  );
const bbox = (b: { x: number; y: number; w: number; h: number }) =>
  `bbox ${b.x} ${b.y} ${b.x + b.w} ${b.y + b.h}`;

/** hOCR (HTML with boxes), readable by hOCR tools and PDF text-layer makers */
function hocr(r: OcrResult, name: string): Formatted {
  let n = 0;
  const lines = r.lines
    .map((l, i) => {
      const words = l.words.length
        ? l.words
            .map(
              (w) =>
                `<span class="ocrx_word" id="word_1_${++n}" title="${bbox(w.box)}; x_wconf ${w.confidence}">${esc(w.text)}</span>`,
            )
            .join(" ")
        : esc(l.text);
      return `   <span class="ocr_line" id="line_1_${i + 1}" title="${bbox(l.box)}">${words}</span>`;
    })
    .join("\n");
  const text = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${esc(r.langs[0] ?? "")}">
 <head>
  <title>${esc(name)}</title>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
  <meta name="ocr-system" content="${r.engine === "photo" ? "PaddleOCR" : "Tesseract"} (kmra.dev OCRTool)" />
  <meta name="ocr-capabilities" content="ocr_page ocr_line ocrx_word" />
 </head>
 <body>
  <div class="ocr_page" id="page_1" title="image &quot;${esc(name)}&quot;; bbox 0 0 ${r.width} ${r.height}">
${lines}
  </div>
 </body>
</html>
`;
  return { text, ranges: null };
}

export function formatResult(
  r: OcrResult,
  f: OutputFormat,
  name = "image",
): Formatted {
  switch (f) {
    case "paragraphs":
      return paragraphs(r);
    case "json":
      return json(r);
    case "hocr":
      return hocr(r, name);
    default:
      return plain(r);
  }
}
