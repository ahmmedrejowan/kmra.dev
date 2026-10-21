import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@kmra/ui/components/Icon";
import { Colors, Seg } from "@kmra/ui/components/controls";
import { downloadZip } from "@kmra/ui/components/kit";
import { toast } from "@kmra/ui/lib/toast";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
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
        (m
          ? m[1]!
          : `${String(i + 1).padStart(3, "0")}-${value.replace(/^https?:\/\//, "")}`
        )
          .replace(/[^\w.-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || `qr-${i + 1}`;
      // Names compared ignoring case, as most file systems (and the zip) do
      const base = name;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}`;
      used.add(name.toLowerCase());
      return { name, value };
    });
}

/** Whether a line fits in one QR code at the style's error correction */
function fits(value: string): boolean {
  try {
    QRCode.create(value, { errorCorrectionLevel: DEFAULT_STYLE.ecc });
    return true;
  } catch {
    return false;
  }
}

const SHOWN = 48;

export default function Bulk({ lang }: { lang?: Locale }) {
  return (
    <LangProvider lang={lang}>
      <BulkView />
    </LangProvider>
  );
}

function BulkView() {
  const T = useT();
  const [text, setText] = useState(
    "https://kmra.dev\nTable 1 | https://example.com/menu?table=1\nTable 2 | https://example.com/menu?table=2",
  );
  const [fg, setFg] = useState("#111111");
  const [px, setPx] = useState(1024);
  const [type, setType] = useState<"png" | "svg">("png");
  const [busy, setBusy] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const list = useMemo(() => rows(text), [text]);
  // Only lines that fit in a QR code are made; the rest are counted, not zipped
  const ok = useMemo(() => list.filter((r) => fits(r.value)), [list]);
  const tooLong = list.length - ok.length;
  const style: Style = { ...DEFAULT_STYLE, fg };
  // The sheet previews the first few dozen; the zip has them all
  const arts = useMemo(
    () =>
      list.slice(0, SHOWN).map((r) => {
        let art = "";
        try {
          art = svg(r.value, { ...DEFAULT_STYLE, fg }, null, 120);
        } catch {}
        return { r, art };
      }),
    [list, fg],
  );

  async function save() {
    setWorking(true);
    setBusy(T("Making codes…"));
    try {
      const files: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < ok.length; i++) {
        const r = ok[i]!;
        if (i % 20 === 0)
          setBusy(T("Code {i} of {n}…", { i: i + 1, n: ok.length }));
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
          // Checked beforehand, so this is rare: the zip simply has one fewer
        }
      }
      if (!files.length) {
        toast(
          T("None of the lines fit in a QR code. Shorten them and try again."),
        );
        setBusy(null);
        return;
      }
      await downloadZip(files, "qr-codes-bulk.zip");
      setBusy(null);
    } catch {
      setBusy(null);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="toolcard qrcard duo">
      <div className="controls side-l">
        <div className="ctl">
          <label htmlFor="bulk-in">{T("One link or text per line")}</label>
          <textarea
            id="bulk-in"
            className="num code-in"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          <small className="muted">
            {T("Add a file name first with “ | ”, like Table 1 | https://…")}
          </small>
        </div>
        <Colors
          label={T("Colour")}
          value={fg}
          onPick={setFg}
          list={["#111111", "#1a3d9c", "#0b6e4f", "#7a1fa2", "#c2410c"]}
        />
        <Seg<"png" | "svg">
          label={T("Format")}
          options={[
            ["png", "PNG"],
            ["svg", "SVG"],
          ]}
          value={type}
          onPick={setType}
        />
        {type === "png" && (
          <Seg<number>
            label={T("Size")}
            options={[
              [512, "512"],
              [1024, "1024"],
              [2048, "2048"],
            ]}
            value={px}
            onPick={setPx}
          />
        )}
      </div>
      <div className="stage qr-stage qr-plain bulk-stage">
        <div className="bulk-sheet">
          <p className="bulk-count">
            {ok.length === 1 ? T("1 code") : T("{n} codes", { n: ok.length })}
          </p>
          <div className="bulk-grid">
            {arts.map(({ r, art }) => (
              <figure key={r.name}>
                {art ? (
                  <div dangerouslySetInnerHTML={{ __html: art }} />
                ) : (
                  <div className="warn small">{T("Too long")}</div>
                )}
                <figcaption>{r.name}</figcaption>
              </figure>
            ))}
          </div>
          {list.length > SHOWN && (
            <p className="bulk-more">
              {T("and {n} more", { n: list.length - SHOWN })}
            </p>
          )}
        </div>
        <div className="result qr-out">
          <small>
            {ok.length === 1 ? T("1 code") : T("{n} codes", { n: ok.length })}
          </small>
          {tooLong > 0 && (
            <small className="warn bulk-long">
              {tooLong === 1
                ? T("1 line is too long for a QR code and will be skipped.")
                : T(
                    "{n} lines are too long for a QR code and will be skipped.",
                    { n: tooLong },
                  )}
            </small>
          )}
          {busy && <small>{busy}</small>}
          <div className="acts">
            <button
              type="button"
              className="btn acc"
              disabled={!ok.length || working}
              onClick={() => void save()}
            >
              <Icon name="download" />
              {T("Download {n} as zip", { n: ok.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
