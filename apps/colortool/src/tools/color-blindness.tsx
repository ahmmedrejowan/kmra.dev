import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@kmra/ui/lib/i18n-react";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg } from "@kmra/ui/components/controls";
import { DropCard, FileInput, decode, useFiles } from "@kmra/ui/components/kit";
import { toolName } from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import type { ToolProps } from ".";
import { css, textOn, toHex, tryParse, type Rgba } from "../lib/color";
import { CVD_TYPES, simulate, type Cvd } from "../lib/cvd";
import { downloadCanvas } from "../lib/ui";

const DEFAULT = "#e63946\n#2a9d8f\n#f4a261\n#457b9d\n#8ab17d\n#6d597a";
/** Long side of the processed image; big enough to judge, light enough to stay quick */
const MAX_SIDE = 2400;

let worker: Worker | null = null;
let nextId = 1;
/** Requests waiting for the worker, so a crash can fail them all instead of hanging */
const pending = new Map<
  number,
  { res: (b: ArrayBuffer) => void; rej: (e: Error) => void }
>();
function run(buffer: ArrayBuffer, type: Cvd): Promise<ArrayBuffer> {
  if (!worker) {
    const w = new Worker(new URL("../lib/cvd.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (
      e: MessageEvent<{ id: number; buffer?: ArrayBuffer; error?: string }>,
    ) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.buffer) p.res(e.data.buffer);
      else p.rej(new Error(e.data.error ?? "simulation failed"));
    };
    const fail = () => {
      // The worker can't be trusted after this: start a fresh one next time
      w.terminate();
      if (worker === w) worker = null;
      for (const p of pending.values()) p.rej(new Error("worker failed"));
      pending.clear();
    };
    w.onerror = fail;
    w.onmessageerror = fail;
    worker = w;
  }
  const id = nextId++;
  const w = worker;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    w.postMessage({ id, buffer, type }, [buffer]);
  });
}

export default function ColorBlindness(_: ToolProps) {
  const T = useT();
  const [source, setSource] = useState<"colors" | "image">("colors");
  const [type, setType] = useState<Cvd>("deuteranopia");
  const [text, setText] = useState(DEFAULT);
  const [img, setImg] = useState<{ name: string; data: ImageData } | null>(null);
  const [busy, setBusy] = useState(false);
  const orig = useRef<HTMLCanvasElement>(null);
  const sim = useRef<HTMLCanvasElement>(null);

  const colors = useMemo(
    () =>
      text
        .split(/\n|,(?![^(]*\))|;/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ({ s, c: tryParse(s) }))
        .filter((x): x is { s: string; c: Rgba } => !!x.c)
        .slice(0, 24),
    [text],
  );

  const files = useFiles({
    onFiles: async (list) => {
      const f = list[0]!;
      try {
        const bmp = await decode(f, MAX_SIDE);
        const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * k));
        const h = Math.max(1, Math.round(bmp.height * k));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        setImg({ name: f.name, data: g.getImageData(0, 0, w, h) });
        setSource("image");
      } catch {
        toast(T("Couldn't open that image. Try JPEG, PNG or WebP."));
      }
    },
  });

  // Draw the original and the simulation whenever the image or the type changes
  useEffect(() => {
    if (!img || source !== "image") return;
    let live = true;
    const { data } = img;
    const o = orig.current!;
    o.width = data.width;
    o.height = data.height;
    o.getContext("2d")!.putImageData(data, 0, 0);
    setBusy(true);
    run(data.data.slice().buffer, type).then((buf) => {
      if (!live) return;
      const s = sim.current!;
      s.width = data.width;
      s.height = data.height;
      s.getContext("2d")!.putImageData(
        new ImageData(new Uint8ClampedArray(buf), data.width, data.height),
        0,
        0,
      );
      s.dataset.type = type;
      s.dataset.ready = "1";
      setBusy(false);
    }, () => {
      if (!live) return;
      setBusy(false);
      toast(T("Couldn't simulate this image. Try a smaller one."));
    });
    return () => {
      live = false;
      if (sim.current) sim.current.dataset.ready = "";
    };
  }, [img, type, source]);

  const info = CVD_TYPES.find((x) => x.id === type)!;

  return (
    <div className="ct-card side-first">
      <div className="ct-side">
        <Seg
          label={T("Check")}
          options={[
            ["colors", T("Colours")],
            ["image", T("An image")],
          ]}
          value={source}
          onPick={setSource}
        />
        <div className="ct-group">
          <span className="ct-glabel">
            <span>{T("Colour vision")}</span>
          </span>
          <div className="ct-types" role="radiogroup" aria-label={T("Colour vision")}>
            {CVD_TYPES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={type === x.id}
                data-type={x.id}
                onClick={() => setType(x.id)}
              >
                <strong>{T(x.name)}</strong>
                <span>{T(x.about)}</span>
              </button>
            ))}
          </div>
        </div>
        {source === "colors" ? (
          <label className="ct-inline col">
            <span>{T("Colours, one per line")}</span>
            <textarea
              className="num mono ct-list"
              rows={7}
              value={text}
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        ) : (
          img && (
            <>
              <button type="button" className="btn sm" onClick={files.pick}>
                <Icon name="upload" />
                {T("Choose another image")}
              </button>
              <button
                type="button"
                className="btn sm ct-remove"
                onClick={() => {
                  setImg(null);
                  setBusy(false);
                }}
              >
                <Icon name="trash" />
                {T("Remove image")}
              </button>
            </>
          )
        )}
        <FileInput inputRef={files.pickRef} onFiles={files.take} multiple={false} />
      </div>

      <div className="ct-main">
        {source === "colors" ? (
          <>
            <div className="ct-cvd-head">
              <span>{T("Normal vision")}</span>
              <span>{T(info.name)}</span>
            </div>
            <div className="ct-cvd" data-count={colors.length}>
              {colors.map(({ s, c }, i) => {
                const after = simulate(c, type);
                return (
                  <div key={i} className="ct-cvd-row">
                    <span
                      className="ct-cvd-sw"
                      style={{ background: css(c), color: css(textOn(c)) }}
                    >
                      {toHex(c, false)}
                    </span>
                    <span
                      className="ct-cvd-sw sim"
                      data-hex={toHex(after, false)}
                      style={{ background: css(after), color: css(textOn(after)) }}
                    >
                      {toHex(after, false)}
                    </span>
                    <span className="sr-only">{s}</span>
                  </div>
                );
              })}
              {!colors.length && (
                <p className="ct-hint">{T("Add colours on the left, one per line.")}</p>
              )}
            </div>
            {colors.length > 0 && (
              <>
                <div className="ct-subhead">
                  <h3>{T("Every type at once")}</h3>
                </div>
                <div className="ct-matrix-wrap">
                  <table className="ct-matrix">
                    <thead>
                      <tr>
                        <th scope="col">{T("Normal")}</th>
                        {CVD_TYPES.map((x) => (
                          <th key={x.id} scope="col">
                            {T(x.name)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map(({ c }, i) => (
                        <tr key={i}>
                          <td>
                            <i style={{ background: css(c) }} title={toHex(c, false)} />
                          </td>
                          {CVD_TYPES.map((x) => {
                            const s = simulate(c, x.id);
                            return (
                              <td key={x.id}>
                                <i style={{ background: css(s) }} title={toHex(s, false)} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : img ? (
          <>
            <div className={`ct-compare${busy ? " working" : ""}`}>
              <figure>
                <canvas ref={orig} className="checker" aria-label={T("Original")} />
                <figcaption>{T("Normal vision")}</figcaption>
              </figure>
              <figure>
                <canvas ref={sim} className="checker ct-sim" aria-label={T(info.name)} />
                <figcaption>
                  {T(info.name)} · {T(info.about)}
                </figcaption>
              </figure>
            </div>
            <div className="ct-actions">
              <button
                type="button"
                className="btn sm ct-dl"
                disabled={busy}
                onClick={() =>
                  void downloadCanvas(
                    sim.current!,
                    // "photo-color-blindness-deuteranopia-kmra.png"
                    `${toolName(img.name, "color-blindness")}-${type}.png`,
                  )
                }
              >
                <Icon name="download" />
                {T("Download simulated image")}
              </button>
            </div>
          </>
        ) : (
          <DropCard
            dragging={files.dragging}
            onPick={files.pick}
            title={T("Drop an image here")}
            button={T("Choose an image")}
            formats={["JPG", "PNG", "WebP", "GIF", "SVG"]}
          />
        )}
        <p className="ct-cap">
          {T("Simulated with the Machado, Oliveira and Fernandes (2009) model in linear RGB. The -anomaly types show a medium strength (0.6).")}
        </p>
      </div>
    </div>
  );
}
