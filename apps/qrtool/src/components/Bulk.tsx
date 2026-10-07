import { useMemo, useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { Colors, Seg } from "@kmra/ui/components/controls";
import { downloadZip } from "@kmra/ui/components/kit";
import { DEFAULT_STYLE, png, svg, type Style } from "../lib/qr";

/** One QR code per line, all zipped. "Name | value" (or a tab) names the file. */
interface Row {
  name: string;
  value: string;
}

function rows(text: string): Row[] {
  const used = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 1000)
    .map((line, i) => {
      const m = /^(.+?)\s*(?:\t|\s\|\s)\s*(.+)$/.exec(line);
      const value = m ? m[2]! : line;
      let name =
        (m ? m[1]! : `${String(i + 1).padStart(3, "0")}-${value}`)
          .replace(/^https?:\/\//, "")
          .replace(/[^\w.-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || `qr-${i + 1}`;
      while (used.has(name)) name += "-2";
      used.add(name);
      return { name, value };
    });
}

export default function Bulk() {
  const [text, setText] = useState(
    "https://kmra.dev\nTable 1 | https://example.com/menu?table=1\nTable 2 | https://example.com/menu?table=2",
  );
  const [fg, setFg] = useState("#111111");
  const [px, setPx] = useState(1024);
  const [type, setType] = useState<"png" | "svg">("png");
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => rows(text), [text]);
  const style: Style = { ...DEFAULT_STYLE, fg };

  async function save() {
    setBusy("Making codes…");
    try {
      const files: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < list.length; i++) {
        const r = list[i]!;
        if (i % 20 === 0) setBusy(`Code ${i + 1} of ${list.length}…`);
        try {
          files.push({
            name: `${r.name}.${type}`,
            blob:
              type === "png"
                ? await png(r.value, style, null, px)
                : new Blob([svg(r.value, style, null, px)], {
                    type: "image/svg+xml",
                  }),
          });
        } catch {
          // Too long for a QR code: skipped, reported below
        }
      }
      await downloadZip(files, "qr-codes-kmra.zip");
      setBusy(
        files.length < list.length
          ? `${list.length - files.length} lines were too long and were skipped.`
          : null,
      );
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="toolcard qrcard">
      <div className="stage qr-stage">
        <div className="bulk-grid">
          {list.slice(0, 12).map((r) => {
            let art = "";
            try {
              art = svg(r.value, style, null, 120);
            } catch {}
            return (
              <figure key={r.name}>
                {art ? (
                  <div dangerouslySetInnerHTML={{ __html: art }} />
                ) : (
                  <div className="warn small">Too long</div>
                )}
                <figcaption>{r.name}</figcaption>
              </figure>
            );
          })}
        </div>
        {list.length > 12 && (
          <p className="muted small">and {list.length - 12} more</p>
        )}
      </div>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="bulk-in">One link or text per line</label>
          <textarea
            id="bulk-in"
            className="num code-in"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          <small className="muted">
            Add a file name first with “ | ”, like Table 1 | https://…
          </small>
        </div>
        <Colors
          label="Colour"
          value={fg}
          onPick={setFg}
          list={["#111111", "#1a3d9c", "#0b6e4f", "#7a1fa2", "#c2410c"]}
        />
        <Seg<"png" | "svg">
          label="Format"
          options={[
            ["png", "PNG"],
            ["svg", "SVG"],
          ]}
          value={type}
          onPick={setType}
        />
        {type === "png" && (
          <Seg<number>
            label="Size"
            options={[
              [512, "512"],
              [1024, "1024"],
              [2048, "2048"],
            ]}
            value={px}
            onPick={setPx}
          />
        )}
        <div className="result">
          <small>
            {list.length} code{list.length === 1 ? "" : "s"}
          </small>
          {busy && <small>{busy}</small>}
          <div className="acts">
            <button
              type="button"
              className="btn acc"
              disabled={!list.length || !!busy?.endsWith("…")}
              onClick={() => void save()}
            >
              <Icon name="download" />
              Download {list.length} as zip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
