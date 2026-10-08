import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { EngineId } from "../lib/ocr/types";
import { effectiveEngine } from "../lib/ocr";
import { cachedLangs } from "../lib/ocr/document";
import { thumbnail } from "../lib/pdf";
import {
  EngineBar,
  LangPicker,
  useOcrSettings,
  useStageText,
  type EngineChoice,
} from "./OcrSettings";

/**
 * Pieces shared by the two PDF tools (PDF to text, Searchable PDF): OCR settings (the image tools'
 * picker and engine bar from ./OcrSettings), the page rail with a status badge per page, and the
 * progress line.
 */

/** PDF pages are scans and documents: Auto reads them with the document engine. */
export const engineFor = (e: EngineChoice): EngineId =>
  e === "auto" ? "document" : e;

/**
 * The image tools' OCR settings (languages remembered on this device, engine), plus the languages
 * already downloaded and a key that changes whenever a setting that affects OCR changes.
 */
export function usePdfOcrSettings(preset?: Preset) {
  const s = useOcrSettings(preset);
  const [cached, setCached] = useState<Set<string>>(new Set());
  const refreshCached = () => void cachedLangs().then(setCached);
  useEffect(refreshCached, []);
  const key = `${effectiveEngine(engineFor(s.engine), s.langs)}:${s.langs.join("+")}`;
  return { ...s, cached, refreshCached, key };
}
export type PdfOcrSettings = ReturnType<typeof usePdfOcrSettings>;

/** Languages + engine, for the options bar and the empty drop card */
export function OcrOptions({ s }: { s: PdfOcrSettings }) {
  return (
    <>
      <LangPicker
        value={s.langs}
        onChange={s.setLangs}
        recent={s.recent}
        cached={s.cached}
      />
      <EngineBar value={s.engine} onPick={s.setEngine} />
    </>
  );
}

/** What's happening on the page being read: "Page 2 of 5 · Reading text… 40%" */
export interface Stage {
  status: string;
  p: number;
  missing: string[];
}

/** Rendered thumbnails, made when a page scrolls into view, one at a time */
export function useThumbs(doc: PDFDocumentProxy | null) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const queue = useRef<number[]>([]);
  const busy = useRef(false);
  const asked = useRef(new Set<number>());
  const urls = useRef<string[]>([]);
  const docRef = useRef(doc);

  useEffect(() => {
    docRef.current = doc;
    queue.current = [];
    asked.current = new Set();
    setThumbs({});
    return () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    };
  }, [doc]);

  const pump = async () => {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length) {
      const i = queue.current.shift()!;
      const d = docRef.current;
      if (!d) break;
      try {
        const t = await thumbnail(d, i + 1);
        if (docRef.current !== d) {
          URL.revokeObjectURL(t.url);
          break;
        }
        urls.current.push(t.url);
        setThumbs((m) => ({ ...m, [i]: t.url }));
      } catch {
        /* a page that can't be drawn keeps its placeholder */
      }
    }
    busy.current = false;
  };
  const request = (i: number) => {
    if (asked.current.has(i)) return;
    asked.current.add(i);
    queue.current.push(i);
    void pump();
  };
  return { thumbs, request };
}

/** One page in the rail: picture, number and a status badge. Asks for its picture when visible. */
export function PageThumb({
  index,
  thumb,
  selected,
  dim,
  badge,
  tone,
  onSelect,
  onVisible,
  ratio,
}: {
  index: number;
  thumb?: string;
  selected: boolean;
  dim?: boolean;
  badge: ReactNode;
  tone?: "acc" | "muted" | "warn" | "busy";
  onSelect: () => void;
  onVisible?: () => void;
  ratio?: number;
}) {
  const T = useT();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onVisible || thumb) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          onVisible();
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumb]);
  return (
    <button
      ref={ref}
      type="button"
      className={`op-thumb${dim ? " dim" : ""}`}
      aria-pressed={selected}
      aria-label={T("Page {n}", { n: index + 1 })}
      onClick={onSelect}
    >
      <span
        className="op-pic"
        style={ratio ? { aspectRatio: ratio } : undefined}
      >
        {thumb ? <img src={thumb} alt="" /> : null}
      </span>
      <span className="op-meta">
        <span className="op-num">{index + 1}</span>
        <span className={`op-badge ${tone ?? "muted"}`}>{badge}</span>
      </span>
    </button>
  );
}

/** Overall progress line under the bar while pages are read */
export function RunLine({
  done,
  total,
  page,
  stage,
  onStop,
}: {
  done: number;
  total: number;
  /** 0-based page being read */
  page: number | null;
  stage: Stage | null;
  onStop: () => void;
}) {
  const T = useT();
  const stageText = useStageText();
  const n = Math.min(done + 1, total);
  return (
    <div className="op-run" role="status">
      <span className="op-spin" aria-hidden="true" />
      <span className="op-run-text">
        {total > 1
          ? T("Page {p} ({n} of {t})", { p: (page ?? 0) + 1, n, t: total })
          : T("Page {n}", { n: (page ?? 0) + 1 })}
        {stage && (
          <span className="muted">
            {" "}
            · {stageText(stage.status, stage.p, stage.missing)}
          </span>
        )}
      </span>
      <span className="op-track" aria-hidden="true">
        <i
          style={{
            width: `${total ? ((done + (stage?.status === "Reading text" ? stage.p : 0)) / total) * 100 : 0}%`,
          }}
        />
      </span>
      <button type="button" className="btn sm" onClick={onStop}>
        <Icon name="x" />
        {T("Stop")}
      </button>
    </div>
  );
}
