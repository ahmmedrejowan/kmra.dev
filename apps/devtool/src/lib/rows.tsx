/**
 * A list of labelled results, each with its own copy button. Used where a tool gives several
 * answers at once (every hash, every case, a batch of IDs) instead of one text area.
 *
 *   <Rows rows={[{ id: "sha256", label: "SHA-256", value, on: true }]} />
 */
import type { ReactNode } from "react";
import { CopyBtn } from "@kmra/ui/components/kit";

export interface Row {
  id: string;
  label?: ReactNode;
  value: string;
  /** Highlight (the use case's pick) */
  on?: boolean;
  /** Mark as a match (e.g. a checksum) */
  match?: boolean;
  /** Small text after the value */
  note?: ReactNode;
  /** Leave out the copy button (e.g. while working) */
  noCopy?: boolean;
}

export function Rows({
  rows,
  numbered = false,
  empty,
}: {
  rows: Row[];
  /** Show 1, 2, 3… instead of labels */
  numbered?: boolean;
  /** Shown when there are no rows */
  empty?: ReactNode;
}) {
  if (!rows.length)
    return empty ? <div className="dev-rows-empty">{empty}</div> : null;
  return (
    <ol className={`dev-rows${numbered ? " numbered" : ""}`}>
      {rows.map((r, i) => (
        <li
          key={r.id}
          className={`dev-row${r.on ? " on" : ""}${r.match ? " match" : ""}`}
          data-row={r.id}
        >
          <span className="dev-row-label">{numbered ? i + 1 : r.label}</span>
          <code className="dev-row-val">{r.value}</code>
          {r.note && <span className="dev-row-note">{r.note}</span>}
          {!r.noCopy && r.value && (
            <CopyBtn text={r.value} className="btn xs dev-row-copy" />
          )}
        </li>
      ))}
    </ol>
  );
}
