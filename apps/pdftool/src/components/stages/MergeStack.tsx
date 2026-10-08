import { Icon } from "@kmra/ui/components/Icon";
import { formatBytes } from "@kmra/ui/lib/files";
import { num } from "@kmra/ui/lib/i18n";
import { useLang, useT } from "@kmra/ui/lib/i18n-react";
import type { PageRef } from "../../lib/ops";
import Thumb from "../Thumb";
import { refsOf, type Doc } from "./common";

/** Merge: the files as a stack of documents in join order, ending in the one PDF they become */
export default function MergeStack({
  docs,
  pages,
  onMove,
  onRemove,
  onAdd,
}: {
  docs: readonly Doc[];
  pages: readonly PageRef[];
  onMove: (key: string, by: -1 | 1) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const T = useT();
  const lang = useLang();
  return (
    <div className="merge-stack">
      <ol>
        {docs.map((d, i) => {
          const n = refsOf(pages, d.key).length;
          return (
            <li key={d.key} className="merge-doc">
              <span className="merge-n" aria-hidden="true">
                {num(lang, i + 1)}
              </span>
              <Thumb fileKey={d.key} doc={d.pdf} index={0} width={96} alt="" />
              <div className="merge-text">
                <strong title={d.file.name}>{d.file.name}</strong>
                <small>
                  {T(n === 1 ? "{n} page" : "{n} pages", { n })},{" "}
                  {formatBytes(d.file.size)}
                </small>
              </div>
              <div className="merge-acts">
                {docs.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={T("Move up")}
                      disabled={i === 0}
                      onClick={() => onMove(d.key, -1)}
                    >
                      <Icon name="down" className="ico up" />
                    </button>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={T("Move down")}
                      disabled={i === docs.length - 1}
                      onClick={() => onMove(d.key, 1)}
                    >
                      <Icon name="down" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={T("Remove {name}", { name: d.file.name })}
                  onClick={() => onRemove(d.key)}
                >
                  <Icon name="x" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className="fchip add merge-add" onClick={onAdd}>
        {T("+ Add PDFs")}
      </button>
      <div className="merge-sum">
        <Icon name="file" />
        <strong>{T("One PDF")}</strong>
        <span>
          {T(pages.length === 1 ? "{n} page" : "{n} pages", {
            n: pages.length,
          })}
        </span>
      </div>
    </div>
  );
}
