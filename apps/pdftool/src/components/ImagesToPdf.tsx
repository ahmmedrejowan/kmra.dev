import { useState } from "react";
import { Icon } from "@kmra/ui/components/Icon";
import { Seg } from "@kmra/ui/components/controls";
import { DropCard, FileInput, useFiles } from "@kmra/ui/components/kit";
import {
  downloadBlob,
  formatBytes,
  IMAGE_ACCEPT,
  isImageFile,
} from "@kmra/ui/lib/files";
import { toast } from "@kmra/ui/lib/toast";
import { num, type Locale } from "@kmra/ui/lib/i18n";
import { LangProvider, useLang, useT } from "@kmra/ui/lib/i18n-react";
import { imagesToPdf, save, type ImageOpts } from "../lib/ops";

/** Photos and scans into one PDF, in the order you choose. */
interface Pic {
  key: string;
  file: File;
  url: string;
  rotate: number;
}

/** Image as JPEG (or PNG when it has transparency), rotated, at most `max` px on the long side */
async function prepare(p: Pic, quality: number, max: number) {
  const bmp = await createImageBitmap(p.file, {
    imageOrientation: "from-image",
  });
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s);
  const h = Math.round(bmp.height * s);
  const turned = p.rotate % 180 !== 0;
  const c = document.createElement("canvas");
  c.width = turned ? h : w;
  c.height = turned ? w : h;
  const x = c.getContext("2d")!;
  x.translate(c.width / 2, c.height / 2);
  x.rotate((p.rotate * Math.PI) / 180);
  x.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close();
  const png = p.file.type === "image/png" && quality >= 0.95;
  const blob = await new Promise<Blob>((r) =>
    c.toBlob((b) => r(b!), png ? "image/png" : "image/jpeg", quality),
  );
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    type: (png ? "png" : "jpg") as "png" | "jpg",
    w: c.width,
    h: c.height,
  };
}

/** Island entry: sets the interface language for everything inside. */
export default function ImagesToPdf(props: { lang?: Locale }) {
  return (
    <LangProvider lang={props.lang}>
      <ImagesToPdfView />
    </LangProvider>
  );
}

function ImagesToPdfView() {
  const T = useT();
  const lang = useLang();
  const [pics, setPics] = useState<Pic[]>([]);
  const [o, setO] = useState<ImageOpts>({
    paper: "a4",
    orientation: "auto",
    margin: 0,
  });
  const [q, setQ] = useState<"high" | "medium" | "small">("high");
  const [busy, setBusy] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const add = (files: File[]) =>
    setPics((p) => [
      ...p,
      ...files.map((file) => ({
        key: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        rotate: 0,
      })),
    ]);
  const { dragging, pickRef, pick, take } = useFiles({
    onFiles: add,
    accept: isImageFile,
  });

  function drop(target: string) {
    if (!dragKey || dragKey === target) return;
    setPics((ps) => {
      const from = ps.findIndex((p) => p.key === dragKey);
      const to = ps.findIndex((p) => p.key === target);
      const next = ps.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m!);
      return next;
    });
    setDragKey(null);
  }

  async function make() {
    setBusy(T("Preparing…"));
    try {
      const [quality, max] = {
        high: [0.92, 3000],
        medium: [0.8, 2000],
        small: [0.65, 1400],
      }[q] as [number, number];
      const images = [];
      for (let i = 0; i < pics.length; i++) {
        setBusy(T("Image {n} of {t}…", { n: i + 1, t: pics.length }));
        try {
          images.push(await prepare(pics[i]!, quality, max));
        } catch {
          toast(
            T("{name} couldn't be read and was skipped.", {
              name: pics[i]!.file.name,
            }),
          );
        }
      }
      if (!images.length) return;
      const blob = await save(await imagesToPdf(images, o));
      downloadBlob(
        blob,
        images.length > 1
          ? "images-kmra.pdf"
          : `${pics[0]!.file.name.replace(/\.[^.]+$/, "")}.pdf`,
      );
      toast(
        T("Saved a {n}-page PDF, {size}.", {
          n: images.length,
          size: formatBytes(blob.size),
        }),
      );
    } finally {
      setBusy(null);
    }
  }

  const input = (
    <FileInput inputRef={pickRef} onFiles={take} accept={IMAGE_ACCEPT} />
  );
  if (!pics.length)
    return (
      <>
        <DropCard
          dragging={dragging}
          onPick={pick}
          title={T("Drop photos or scans")}
          button={T("Choose images")}
          formats={["JPG", "PNG", "WebP", "GIF"]}
        />
        {input}
      </>
    );

  const put = (p: Partial<ImageOpts>) => setO((v) => ({ ...v, ...p }));
  return (
    <>
      <div className="toolcard pdfcard">
        <div className={`stage pdf-stage${dragging ? " over" : ""}`}>
          <div className="page-grid">
            {pics.map((p, i) => (
              <div
                key={p.key}
                className="pg"
                draggable
                onDragStart={() => setDragKey(p.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(p.key)}
              >
                <div className={`thumb paper ${o.paper}`}>
                  <img
                    src={p.url}
                    alt={p.file.name}
                    style={{ transform: `rotate(${p.rotate}deg)` }}
                    draggable={false}
                  />
                </div>
                <div className="pg-bar">
                  <span>{num(lang, i + 1)}</span>
                  <span className="pg-acts">
                    <button
                      type="button"
                      aria-label={T("Rotate")}
                      title={T("Rotate")}
                      onClick={() =>
                        setPics((l) =>
                          l.map((x) =>
                            x.key === p.key
                              ? { ...x, rotate: (x.rotate + 90) % 360 }
                              : x,
                          ),
                        )
                      }
                    >
                      <Icon name="rotateRight" />
                    </button>
                    <button
                      type="button"
                      aria-label={T("Remove")}
                      title={T("Remove")}
                      onClick={() =>
                        setPics((l) => l.filter((x) => x.key !== p.key))
                      }
                    >
                      <Icon name="x" />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="filebar">
            <button type="button" className="fchip add" onClick={pick}>
              {T("+ Add images")}
            </button>
          </div>
        </div>
        <div className="controls">
          <p className="muted small">
            {T("Drag images to change the order. Each image becomes one page.")}
          </p>
          <Seg<ImageOpts["paper"]>
            label={T("Page size")}
            options={[
              ["a4", "A4"],
              ["letter", "Letter"],
              ["legal", "Legal"],
              ["fit", T("Same as image")],
            ]}
            value={o.paper}
            onPick={(v) => put({ paper: v })}
          />
          {o.paper !== "fit" && (
            <Seg<ImageOpts["orientation"]>
              label={T("Orientation")}
              options={[
                ["auto", T("Auto")],
                ["portrait", T("Portrait")],
                ["landscape", T("Landscape")],
              ]}
              value={o.orientation}
              onPick={(v) => put({ orientation: v })}
            />
          )}
          <Seg<number>
            label={T("Margin")}
            options={[
              [0, T("None")],
              [18, T("Small")],
              [40, T("Large")],
            ]}
            value={o.margin}
            onPick={(v) => put({ margin: v })}
          />
          <Seg<typeof q>
            label={T("Image quality")}
            options={[
              ["high", T("High")],
              ["medium", T("Medium")],
              ["small", T("Small file")],
            ]}
            value={q}
            onPick={setQ}
          />
          <div className="result">
            <small>
              {T(pics.length > 1 ? "{n} images" : "{n} image", {
                n: pics.length,
              })}
              , {formatBytes(pics.reduce((a, p) => a + p.file.size, 0))}
            </small>
            {busy && <small>{busy}</small>}
            <div className="acts">
              <button
                type="button"
                className="btn acc"
                disabled={!!busy}
                onClick={() => void make()}
              >
                <Icon name="download" />
                {T(busy ? "Working…" : "Make PDF and download")}
              </button>
            </div>
          </div>
        </div>
      </div>
      {input}
    </>
  );
}
