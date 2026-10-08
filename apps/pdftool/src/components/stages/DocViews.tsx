import { formatBytes } from "@kmra/ui/lib/files";
import { num } from "@kmra/ui/lib/i18n";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { Meta, PageRef } from "../../lib/ops";
import { Sheet } from "../Thumb";
import type { Doc } from "./common";

/* ---------- Compress: the first page beside a size gauge ---------- */

const LEVEL_NOTE = {
  light: "Light: pages redrawn at 150 dpi, sharp text",
  strong: "Strong: pages redrawn at 110 dpi, good for email",
  max: "Smallest: pages redrawn at 80 dpi, for tight upload limits",
} as const;

export function CompressView({
  doc,
  first,
  level,
  target,
  outSize,
}: {
  doc: Doc;
  first: PageRef | undefined;
  level: keyof typeof LEVEL_NOTE;
  target: number | null;
  outSize: number | undefined;
}) {
  const T = useT();
  const size = doc.file.size;
  const limit = target ? target * 1024 : 0;
  const aimPct = limit ? Math.min(100, (limit / size) * 100) : 0;
  const limitText = target
    ? target >= 1024
      ? T("{n} MB", { n: target / 1024 })
      : T("{n} KB", { n: target })
    : "";
  return (
    <div className="squeeze">
      {first && (
        <Sheet
          fileKey={doc.key}
          doc={doc.pdf}
          index={first.index}
          rotate={first.rotate}
          width={300}
          alt={T("Page {n}", { n: first.index + 1 })}
          className="squeeze-page"
        />
      )}
      <div className="gauge">
        <div className="g-row">
          <span className="g-lab">{T("Original")}</span>
          <div className="g-track">
            <i style={{ width: "100%" }} />
            {limit > 0 && (
              <span className="g-aim" style={{ left: `${aimPct}%` }} />
            )}
          </div>
          <b>{formatBytes(size)}</b>
        </div>
        <p className="g-note">
          {limit
            ? limit >= size
              ? T("Already under {size}. It's re-saved without loss.", {
                  size: limitText,
                })
              : T("Aim: under {size}", { size: limitText })
            : T(LEVEL_NOTE[level])}
        </p>
        <div className={`g-row new${outSize === undefined ? " ghost" : ""}`}>
          <span className="g-lab">{T("Compressed")}</span>
          <div className="g-track">
            {outSize !== undefined && (
              <i
                style={{
                  width: `${Math.max(2, Math.min(100, (outSize / size) * 100))}%`,
                }}
              />
            )}
          </div>
          <b>{outSize !== undefined ? formatBytes(outSize) : ""}</b>
        </div>
        <p className="g-note">
          {outSize === undefined ? (
            T("The new size shows here after you compress.")
          ) : outSize <= size ? (
            <span className="delta">
              {T("{n}% smaller", {
                n: Math.round((1 - outSize / size) * 100),
              })}
            </span>
          ) : (
            <span className="delta up">
              {T("{n}% larger", { n: Math.round((outSize / size - 1) * 100) })}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ---------- Black and white: the first page before and after ---------- */

export function GrayView({
  doc,
  first,
}: {
  doc: Doc;
  first: PageRef | undefined;
}) {
  const T = useT();
  if (!first) return null;
  const sheet = (cls: string) => (
    <Sheet
      fileKey={doc.key}
      doc={doc.pdf}
      index={first.index}
      rotate={first.rotate}
      width={360}
      alt={T("Page {n}", { n: first.index + 1 })}
      className={cls}
    />
  );
  return (
    <div className="pair">
      <figure>
        {sheet("")}
        <figcaption>{T("Original")}</figcaption>
      </figure>
      <figure>
        {sheet("gray")}
        <figcaption>{T("Black and white")}</figcaption>
      </figure>
    </div>
  );
}

/* ---------- Rotate: the first pages turning to the chosen angle ---------- */

const TURN_NAME: Record<number, string> = {
  90: "Right",
  180: "Upside down",
  270: "Left",
};

export function RotateView({
  doc,
  refs,
  turn,
}: {
  doc: Doc;
  refs: readonly PageRef[];
  turn: number;
}) {
  const T = useT();
  const lang = useLang();
  const shown = refs.slice(0, 6);
  return (
    <div className="turns">
      <p className="desk-note">
        <span className="turn-angle">{num(lang, turn)}°</span>{" "}
        {T(TURN_NAME[turn] ?? "Right")}
      </p>
      <div className="turn-grid">
        {shown.map((p) => (
          <figure key={p.id} className="turn">
            <div className="turn-hold">
              <div
                className="turn-spin"
                style={{ transform: `rotate(${turn}deg)` }}
              >
                <Sheet
                  fileKey={doc.key}
                  doc={doc.pdf}
                  index={p.index}
                  rotate={p.rotate}
                  width={220}
                  alt={T("Page {n}", { n: p.index + 1 })}
                />
              </div>
            </div>
            <figcaption>{T("Page {n}", { n: p.index + 1 })}</figcaption>
          </figure>
        ))}
      </div>
      {refs.length > shown.length && (
        <p className="desk-note">
          {T("The other {n} pages turn the same way.", {
            n: refs.length - shown.length,
          })}
        </p>
      )}
    </div>
  );
}

/* ---------- Metadata: a document properties sheet ---------- */

const FIELDS: [keyof Meta, string][] = [
  ["title", "Title"],
  ["author", "Author"],
  ["subject", "Subject"],
  ["keywords", "Keywords"],
  ["creator", "Creator"],
  ["producer", "Producer"],
];

export function MetaView({
  doc,
  first,
  meta,
  strip,
}: {
  doc: Doc;
  first: PageRef | undefined;
  meta: Meta | null;
  strip: boolean;
}) {
  const T = useT();
  const lang = useLang();
  const head = new TextDecoder().decode(doc.bytes.subarray(0, 1024));
  const version = /%PDF-(\d\.\d)/.exec(head)?.[1];
  return (
    <div className="props">
      {first && (
        <Sheet
          fileKey={doc.key}
          doc={doc.pdf}
          index={first.index}
          rotate={first.rotate}
          width={240}
          alt={T("Page {n}", { n: first.index + 1 })}
          className="props-page"
        />
      )}
      <div className="props-card">
        <h3>{T("Document properties")}</h3>
        <p className="props-file" title={doc.file.name}>
          {doc.file.name}
        </p>
        <dl>
          {FIELDS.map(([k, label]) => {
            const v = meta?.[k] ?? "";
            return (
              <div key={k} className={strip ? "gone" : ""}>
                <dt>{T(label)}</dt>
                <dd>
                  {strip ? (
                    <span className="muted">{T("Removed")}</span>
                  ) : v ? (
                    v
                  ) : (
                    <span className="muted">{T("Not set")}</span>
                  )}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>{T("Pages")}</dt>
            <dd>{num(lang, doc.pages)}</dd>
          </div>
          <div>
            <dt>{T("Size")}</dt>
            <dd>{formatBytes(doc.file.size)}</dd>
          </div>
          {version && (
            <div>
              <dt>{T("PDF version")}</dt>
              <dd>{num(lang, version)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
