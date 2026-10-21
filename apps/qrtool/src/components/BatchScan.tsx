import { useEffect, useRef, useState } from "react";
import type { Preset } from "@kmra/registry";
import { Icon } from "@kmra/ui/components/Icon";
import { Toggle } from "@kmra/ui/components/controls";
import {
  copyText,
  DropCard,
  FileInput,
  useFiles,
} from "@kmra/ui/components/kit";
import { downloadBlob, IMAGE_ACCEPT } from "@kmra/ui/lib/files";
import type { Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useT } from "@kmra/ui/lib/i18n-react";
import {
  KIND_LABEL,
  parse,
  pixelsOf,
  readDetailed,
  toCsv,
  type Found,
} from "../lib/scan";

/**
 * Batch scanner: read every code in many images, one image at a time so the page stays
 * responsive, and list them for copying or CSV. Everything runs on this device.
 */

interface Item {
  id: number;
  name: string;
  /** waiting → done (codes may be empty) or error */
  state: "waiting" | "done" | "error";
  codes: Found[];
}

const fmtName = (format: string) =>
  format.replace(/([a-z])([A-Z])/g, "$1 $2").replace("QRCode", "QR Code");

/** Let the browser paint and handle input between images */
const pause = () => new Promise((r) => setTimeout(r, 0));

export default function BatchScan({
  lang,
}: {
  lang?: Locale;
  preset?: Preset;
}) {
  return (
    <LangProvider lang={lang}>
      <BatchScanView />
    </LangProvider>
  );
}

function BatchScanView() {
  const T = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [running, setRunning] = useState(false);
  // The queue lives in refs so files added mid-run join the same loop
  const list = useRef<Item[]>([]);
  const files = useRef(new Map<number, File>());
  const nextId = useRef(1);
  const runningRef = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function add(picked: File[]) {
    for (const f of picked) {
      const id = nextId.current++;
      files.current.set(id, f);
      list.current.push({ id, name: f.name, state: "waiting", codes: [] });
    }
    setItems([...list.current]);
    void run();
  }

  async function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    let last = performance.now();
    try {
      for (;;) {
        const i = list.current.findIndex((x) => x.state === "waiting");
        if (i < 0 || !alive.current) break;
        const item = list.current[i]!;
        const file = files.current.get(item.id);
        let next: Item;
        try {
          if (!file) throw new Error("gone");
          const { pixels } = await pixelsOf(file, 3000);
          const found = await readDetailed(pixels, { max: 16 });
          next = {
            ...item,
            state: "done",
            codes: found.map((f) => ({ text: f.text, format: f.format })),
          };
        } catch {
          next = { ...item, state: "error" };
        }
        // Done with the file: let it be freed
        files.current.delete(item.id);
        // Find it again by id: it may have been removed (or others before it) meanwhile
        const at = list.current.findIndex((x) => x.id === item.id);
        if (at >= 0) list.current[at] = next;
        // Redraw the table at most a few times a second
        const now = performance.now();
        if (now - last > 250) {
          last = now;
          setItems([...list.current]);
        }
        await pause();
      }
    } finally {
      runningRef.current = false;
      if (alive.current) {
        setItems([...list.current]);
        setRunning(false);
      }
    }
  }

  /** Take one image (and its codes) off the list */
  function remove(id: number) {
    list.current = list.current.filter((x) => x.id !== id);
    files.current.delete(id);
    setItems([...list.current]);
  }

  function clear() {
    list.current = [];
    files.current.clear();
    setItems([]);
  }

  const { dragging, pickRef, pick, take } = useFiles({ onFiles: add });

  const done = items.filter((x) => x.state !== "waiting").length;
  const codes = items.flatMap((x) => x.codes);
  const failed = items.filter(
    (x) => x.state === "error" || (x.state === "done" && !x.codes.length),
  ).length;

  // One row per code; images without a code get one row saying so
  const rows = items.flatMap((x) =>
    x.state === "done" && x.codes.length
      ? x.codes.map((c, k) => ({ item: x, code: c as Found | null, k }))
      : [{ item: x, code: null as Found | null, k: 0 }],
  );
  const shown = onlyFailed
    ? rows.filter((r) => !r.code && r.item.state !== "waiting")
    : rows;

  const typeOf = (text: string) => T(KIND_LABEL[parse(text).kind] ?? "Text");
  const status = (it: Item) =>
    it.state === "waiting"
      ? T("Waiting…")
      : it.state === "error"
        ? T("Couldn't open this image")
        : T("No code found");

  function saveCsv() {
    const data = [
      [T("File"), T("Format"), T("Type"), T("Content")],
      ...rows
        .filter((r) => r.item.state !== "waiting")
        .map((r) =>
          r.code
            ? [
                r.item.name,
                fmtName(r.code.format),
                typeOf(r.code.text),
                r.code.text,
              ]
            : [r.item.name, "", "", status(r.item)],
        ),
    ];
    downloadBlob(
      new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" }),
      "scanned-codes.csv",
    );
  }

  const input = (
    <FileInput inputRef={pickRef} onFiles={take} accept={IMAGE_ACCEPT} />
  );

  if (!items.length)
    return (
      <>
        <DropCard
          title={T("Drop images with codes")}
          dragging={dragging}
          onPick={pick}
        />
        {input}
      </>
    );

  return (
    <div className="toolcard qrcard wide-panel bs-card">
      <div className={`stage bs-stage${dragging ? " over" : ""}`}>
        <div className="bs-wrap">
          <table className="bs-table">
            <thead>
              <tr>
                <th>{T("File")}</th>
                <th>{T("Format")}</th>
                <th>{T("Content")}</th>
                <th>{T("Type")}</th>
                <th>
                  <span className="sr-only">{T("Copy")}</span>
                </th>
                <th style={{ width: 46 }}>
                  <span className="sr-only">{T("Remove")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ item, code, k }) => (
                <tr
                  key={`${item.id}-${k}`}
                  className={
                    code ? "" : item.state === "waiting" ? "wait" : "miss"
                  }
                >
                  <td className="bs-file" title={item.name}>
                    {item.name}
                  </td>
                  {code ? (
                    <>
                      <td>{fmtName(code.format)}</td>
                      <td className="bs-text" title={code.text}>
                        {code.text}
                      </td>
                      <td>{typeOf(code.text)}</td>
                      <td>
                        <button
                          type="button"
                          className="iconbtn bs-copy"
                          aria-label={T("Copy")}
                          title={T("Copy")}
                          onClick={() =>
                            void copyText(
                              code.text,
                              T("Copied"),
                              T(
                                "Couldn't copy. Select the text and copy it yourself.",
                              ),
                            )
                          }
                        >
                          <Icon name="copy" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="bs-status">
                      {status(item)}
                    </td>
                  )}
                  <td>
                    {k === 0 && (
                      <button
                        type="button"
                        className="iconbtn bs-copy bs-remove"
                        aria-label={T("Remove {name}").replace(
                          "{name}",
                          item.name,
                        )}
                        title={T("Remove")}
                        onClick={() => remove(item.id)}
                      >
                        <Icon name="x" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <p className="muted small bs-empty">
              {items.some((x) => x.state === "waiting")
                ? T("No image without a code so far. Still reading…")
                : T("Every image had a code.")}
            </p>
          )}
        </div>
      </div>
      <div className="controls">
        <div className="ctl" aria-live="polite">
          {running ? (
            <>
              <span className="lbl">
                {T("Reading {i} of {n}…", { i: done + 1, n: items.length })}
              </span>
              <progress max={items.length} value={done} className="bs-prog" />
            </>
          ) : (
            <span className="lbl">
              {T(items.length === 1 ? "{n} image" : "{n} images", {
                n: items.length,
              })}
              ,{" "}
              {T(codes.length === 1 ? "{n} code" : "{n} codes", {
                n: codes.length,
              })}
            </span>
          )}
          {failed > 0 && (
            <small className="warn">
              {failed === 1
                ? T("1 image without a code")
                : T("{n} images without a code", { n: failed })}
            </small>
          )}
        </div>
        <Toggle
          label={T("Only images without a code")}
          on={onlyFailed}
          onChange={setOnlyFailed}
        />
        <button type="button" className="btn sm" onClick={pick}>
          <Icon name="plus" />
          {T("Add images")}
        </button>
        <div className="result">
          <div className="acts">
            <button
              type="button"
              className="btn acc"
              disabled={!codes.length}
              onClick={() =>
                void copyText(
                  codes.map((c) => c.text.replace(/\r?\n/g, " ")).join("\n"),
                  T("{n} codes copied", { n: codes.length }),
                  T("Couldn't copy. Select the text and copy it yourself."),
                )
              }
            >
              <Icon name="copy" />
              {T("Copy all codes")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!done}
              onClick={saveCsv}
            >
              <Icon name="download" />
              {T("Download CSV")}
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={running}
              onClick={clear}
            >
              <Icon name="trash" />
              {T("Clear list")}
            </button>
          </div>
          <small>
            {T(
              "One code per line when copied. The CSV opens in Excel and Google Sheets.",
            )}
          </small>
        </div>
      </div>
      {input}
    </div>
  );
}
