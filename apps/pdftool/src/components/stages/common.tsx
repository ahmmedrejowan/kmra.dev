import type { PDFDocumentProxy } from "pdfjs-dist";
import { Icon } from "@kmra/ui/components/Icon";
import { formatBytes } from "@kmra/ui/lib/files";
import { useT } from "@kmra/ui/lib/i18n-react";
import type { PageRef } from "../../lib/ops";

/** An opened PDF */
export interface Doc {
  key: string;
  file: File;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  pages: number;
}

/** The pages of one file, in their current order (Advanced can reorder, rotate and delete) */
export const refsOf = (pages: readonly PageRef[], key: string) =>
  pages.filter((p) => p.file === key);

/** [1,2,3,5] (0-based) → "2-4, 6" */
export function formatRanges(indices: readonly number[]): string {
  const s = [...new Set(indices)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[i]!;
    let b = a;
    while (s[i + 1] === b + 1) b = s[++i]!;
    out.push(a === b ? `${a + 1}` : `${a + 1}-${b + 1}`);
  }
  return out.join(", ");
}

/** The open files above a per-file workspace: pick which one to look at, remove one, add more */
export function DocBar({
  docs,
  active,
  onActive,
  onRemove,
  onAdd,
}: {
  docs: readonly Doc[];
  active: string;
  onActive: (key: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const T = useT();
  return (
    <div className="desk-bar">
      {docs.map((d) => (
        <span
          key={d.key}
          className={`desk-doc${d.key === active && docs.length > 1 ? " on" : ""}`}
        >
          <button
            type="button"
            className="desk-doc-pick"
            aria-pressed={docs.length > 1 ? d.key === active : undefined}
            onClick={() => onActive(d.key)}
            title={d.file.name}
          >
            <Icon name="file" />
            <span className="nm">{d.file.name}</span>
            <small>
              {T(d.pages > 1 ? "{n} pages" : "{n} page", { n: d.pages })},{" "}
              {formatBytes(d.file.size)}
            </small>
          </button>
          <button
            type="button"
            className="desk-doc-x"
            aria-label={T("Remove {name}", { name: d.file.name })}
            onClick={() => onRemove(d.key)}
          >
            <Icon name="x" />
          </button>
        </span>
      ))}
      <button type="button" className="fchip add" onClick={onAdd}>
        {T("+ Add another PDF")}
      </button>
    </div>
  );
}
