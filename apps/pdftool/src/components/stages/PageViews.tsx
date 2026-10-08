import { useRef } from "react";
import { num } from "@kmra/ui/lib/i18n";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { PageRef } from "../../lib/ops";
import Thumb, { Sheet } from "../Thumb";
import { formatRanges, type Doc } from "./common";

type Parse = (text: string, max: number) => number[][] | null;

/** One page in a strip */
function StripPage({
  doc,
  p,
  className = "",
  label,
  onClick,
  pressed,
}: {
  doc: Doc;
  p: PageRef;
  className?: string;
  label?: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  const T = useT();
  const lang = useLang();
  const face = (
    <Thumb
      fileKey={doc.key}
      doc={doc.pdf}
      index={p.index}
      rotate={p.rotate}
      width={120}
      alt={T("Page {n}", { n: p.index + 1 })}
    />
  );
  return (
    <div className={`sp ${className}`}>
      {onClick ? (
        <button
          type="button"
          className="sp-face"
          aria-pressed={pressed}
          aria-label={T("Page {n}", { n: p.index + 1 })}
          onClick={onClick}
        >
          {face}
        </button>
      ) : (
        <div className="sp-face">{face}</div>
      )}
      <small>{label ?? num(lang, p.index + 1)}</small>
    </div>
  );
}

/* ---------- Split: pages grouped into the files they become ---------- */

export function SplitView({
  doc,
  refs,
  mode,
  ranges,
  picked,
  onPick,
  parse,
}: {
  doc: Doc;
  refs: readonly PageRef[];
  mode: "each" | "ranges" | "extract";
  ranges: string;
  picked: ReadonlySet<string>;
  onPick: (id: string) => void;
  parse: Parse;
}) {
  const T = useT();
  // Same rules as the split itself (PdfTool's runFor)
  let runs: PageRef[][] = [];
  let hint = "";
  const chosen = refs.filter((p) => picked.has(p.id));
  const extract =
    mode === "extract" ||
    (mode === "ranges" && chosen.length > 0 && !ranges.trim());
  if (mode === "each") runs = refs.map((p) => [p]);
  else if (extract) {
    const fromText = parse(ranges, doc.pages)?.flat();
    const one = chosen.length
      ? chosen
      : fromText
        ? refs.filter((p) => fromText.includes(p.index))
        : [];
    if (one.length) runs = [one];
    else hint = T("Click pages or type them to pick what goes in the new PDF.");
  } else {
    const groups = parse(ranges, doc.pages);
    if (groups)
      runs = groups
        .map((g) =>
          refs
            .filter((p) => g.includes(p.index))
            .sort((a, b) => g.indexOf(a.index) - g.indexOf(b.index)),
        )
        .filter((r) => r.length);
    else
      hint = ranges.trim()
        ? T("Type page ranges like 1-3, 4-6.")
        : T("Type ranges to see how the pages split.");
  }
  const inRun = new Set(runs.flat().map((p) => p.id));
  const left = refs.filter((p) => !inRun.has(p.id));
  const clickable = mode === "extract";
  return (
    <div className="split-view">
      <p className="desk-note">
        {runs.length
          ? T(runs.length === 1 ? "Makes {n} PDF" : "Makes {n} PDFs", {
              n: runs.length,
            })
          : hint}
      </p>
      <div className="strip">
        {runs.map((r, i) => (
          <div key={i} className={`run c${i % 6}`}>
            <div className="run-pages">
              {r.map((p) => (
                <StripPage
                  key={p.id}
                  doc={doc}
                  p={p}
                  onClick={clickable ? () => onPick(p.id) : undefined}
                  pressed={clickable ? picked.has(p.id) : undefined}
                />
              ))}
            </div>
            <span className="run-lab">{T("File {n}", { n: i + 1 })}</span>
          </div>
        ))}
        {left.length > 0 && (
          <div className={`run left${runs.length ? "" : " plain"}`}>
            <div className="run-pages">
              {left.map((p) => (
                <StripPage
                  key={p.id}
                  doc={doc}
                  p={p}
                  onClick={clickable ? () => onPick(p.id) : undefined}
                  pressed={clickable ? false : undefined}
                />
              ))}
            </div>
            {runs.length > 0 && (
              <span className="run-lab">{T("Not included")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Remove pages: removed pages crossed out, click to toggle ---------- */

export function RemoveView({
  doc,
  refs,
  ranges,
  picked,
  onPick,
  onRanges,
  parse,
}: {
  doc: Doc;
  refs: readonly PageRef[];
  ranges: string;
  picked: ReadonlySet<string>;
  onPick: (id: string) => void;
  onRanges: (text: string) => void;
  parse: Parse;
}) {
  const T = useT();
  const fromText = parse(ranges, doc.pages)?.flat() ?? [];
  const gone = (p: PageRef) => picked.has(p.id) || fromText.includes(p.index);
  const removed = refs.filter(gone).length;
  function toggle(p: PageRef) {
    // A page removed by the typed list comes back by taking it out of the list
    if (fromText.includes(p.index)) {
      onRanges(formatRanges(fromText.filter((i) => i !== p.index)));
      if (picked.has(p.id)) onPick(p.id);
    } else onPick(p.id);
  }
  return (
    <div className="split-view">
      <p className="desk-note">
        {T("Click pages to remove them.")}{" "}
        {T("{k} kept, {r} removed", { k: refs.length - removed, r: removed })}
      </p>
      <div className="strip flat">
        {refs.map((p) => (
          <StripPage
            key={p.id}
            doc={doc}
            p={p}
            className={gone(p) ? "out" : ""}
            label={gone(p) ? T("Removed") : undefined}
            pressed={gone(p)}
            onClick={() => toggle(p)}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- To images: pages as photo prints ---------- */

export function PrintsView({
  doc,
  refs,
  ext,
  dpi,
  picked,
  onPick,
}: {
  doc: Doc;
  refs: readonly PageRef[];
  ext: string;
  dpi: number;
  picked: ReadonlySet<string>;
  onPick: (id: string) => void;
}) {
  const T = useT();
  const lang = useLang();
  const n = refs.filter((p) => picked.has(p.id)).length;
  return (
    <div className="split-view">
      <p className="desk-note">
        {n
          ? T(n === 1 ? "{n} page picked" : "{n} pages picked", { n })
          : T("Every page is saved. Tick pages to save only those.")}
      </p>
      <div className="prints">
        {refs.map((p) => {
          const on = picked.has(p.id);
          return (
            <label key={p.id} className={`print${on ? " on" : ""}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => onPick(p.id)}
                aria-label={T("Page {n}", { n: p.index + 1 })}
              />
              <Thumb
                fileKey={doc.key}
                doc={doc.pdf}
                index={p.index}
                rotate={p.rotate}
                width={160}
                alt=""
              />
              <span className="print-foot">
                <span>{num(lang, p.index + 1)}</span>
                <span className="badge">{ext}</span>
                <span className="badge">{T("{n} dpi", { n: dpi })}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- To text: page rail and the text on paper ---------- */

export function ReadView({
  doc,
  refs,
  texts,
}: {
  doc: Doc;
  refs: readonly PageRef[];
  texts: string[] | undefined;
}) {
  const T = useT();
  const lang = useLang();
  const paper = useRef<HTMLDivElement>(null);
  function go(i: number) {
    const box = paper.current;
    const el = box?.querySelector<HTMLElement>(`[data-pg="${i}"]`);
    if (box && el) box.scrollTop = el.offsetTop - 12;
  }
  const first = refs[0];
  return (
    <div className="reader">
      <div className="reader-rail" aria-label={T("Pages")}>
        {refs.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(i)}
            disabled={!texts}
            aria-label={T("Page {n}", { n: p.index + 1 })}
          >
            <Thumb
              fileKey={doc.key}
              doc={doc.pdf}
              index={p.index}
              rotate={p.rotate}
              width={90}
              alt=""
            />
            <small>{num(lang, p.index + 1)}</small>
          </button>
        ))}
      </div>
      {texts ? (
        <div
          className="reader-paper"
          ref={paper}
          tabIndex={0}
          aria-label={T("Extracted text")}
        >
          {texts.map((t, i) => (
            <section key={i} data-pg={i}>
              <h4>{T("Page {n}", { n: (refs[i]?.index ?? i) + 1 })}</h4>
              {t.trim() ? (
                <p>{t}</p>
              ) : (
                <p className="muted">{T("No text on this page.")}</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="reader-wait">
          {first && (
            <Sheet
              fileKey={doc.key}
              doc={doc.pdf}
              index={first.index}
              rotate={first.rotate}
              width={300}
              alt={T("Page {n}", { n: first.index + 1 })}
            />
          )}
          <p className="desk-note">
            {T("Extract the text to read it here, page by page.")}
          </p>
        </div>
      )}
    </div>
  );
}
