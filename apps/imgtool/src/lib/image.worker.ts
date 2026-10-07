/// <reference lib="webworker" />
import { isLossy, outType, type Settings } from "./settings";
import { render, type Extras } from "./render";
import { faces, mask, type Box, type MaskModel } from "./ml";

/**
 * Decoding and encoding run here so the page stays responsive.
 * Decoded images are cached by key; nothing leaves this device.
 */
const bitmaps = new Map<string, ImageBitmap>();
/** Subject masks for background changes, by "key:model" */
const masks = new Map<string, Promise<ImageBitmap>>();
/** Faces found per image key */
const faceCache = new Map<string, Promise<Box[]>>();

function facesFor(key: string, bmp: ImageBitmap): Promise<Box[]> {
  let f = faceCache.get(key);
  if (!f) {
    f = faces(bmp);
    f.catch(() => faceCache.delete(key));
    faceCache.set(key, f);
  }
  return f;
}

function maskFor(key: string, bmp: ImageBitmap, model: MaskModel) {
  const id = `${key}:${model}`;
  let m = masks.get(id);
  if (!m) {
    m = mask(bmp, model);
    m.catch(() => masks.delete(id));
    masks.set(id, m);
  }
  return m;
}

/** Everything a render needs besides the image: logo, faces, subject mask. */
async function extrasFor(
  key: string,
  bmp: ImageBitmap,
  s: Settings,
): Promise<Extras & { found?: number }> {
  const ex: Extras & { found?: number } = { logo: await logoFor(s) };
  const needFaces = s.redact?.faces || !!s.passport || s.bg?.model === "auto";
  if (needFaces) {
    ex.faces = await facesFor(key, bmp);
    ex.found = ex.faces.length;
  }
  if (s.bg) {
    const model: MaskModel =
      s.bg.model === "auto"
        ? ex.faces!.length
          ? "person"
          : "object"
        : s.bg.model;
    ex.mask = await maskFor(key, bmp, model);
  }
  return ex;
}

export type WorkerRequest =
  | { id: number; kind: "load"; key: string; file: Blob }
  | { id: number; kind: "drop"; key: string }
  | {
      id: number;
      kind: "encode";
      key: string;
      srcType: string;
      settings: Settings;
    }
  | { id: number; kind: "sample" }
  | { id: number; kind: "faces"; key: string };

export interface EncodeResult {
  blob: Blob;
  w: number;
  h: number;
  type: string;
  q: number;
  /** Target size couldn't be reached even at the lowest quality */
  over: boolean;
  /** Faces found, when a step looked for them */
  faces?: number;
}

/** Render once, then encode; with a target size, binary-search the best quality that fits. */
async function encode(
  bmp: ImageBitmap,
  s: Settings,
  srcType: string,
  extras: Extras,
): Promise<EncodeResult> {
  const canvas = render(bmp, s, srcType, extras);
  const type = outType(srcType, s);
  const at = async (q: number) => ({
    blob: await canvas.convertToBlob({ type, quality: q / 100 }),
    w: canvas.width,
    h: canvas.height,
    type,
  });
  if (!s.target || !isLossy(type))
    return { ...(await at(s.quality)), q: s.quality, over: false };
  const limit = s.target * 1024;
  let lo = 5;
  let hi = 95;
  let best: EncodeResult | null = null;
  for (let i = 0; i < 7 && lo <= hi; i++) {
    const mid = Math.round((lo + hi) / 2);
    const r = await at(mid);
    if (r.blob.size <= limit) {
      best = { ...r, q: mid, over: false };
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best ?? { ...(await at(5)), q: 5, over: true };
}

/** Watermark logos, decoded once per file */
const logos = new Map<string, ImageBitmap>();
async function logoFor(s: Settings): Promise<ImageBitmap | null> {
  const m = s.mark;
  if (!m?.logo) return null;
  const id = `${m.logoName}:${m.logo.size}`;
  let bmp = logos.get(id);
  if (!bmp) {
    bmp = await createImageBitmap(m.logo);
    logos.set(id, bmp);
  }
  return bmp;
}

/** A grainy landscape so tools can be tried without a file. Grain makes sizes behave like a real photo. */
async function sample(): Promise<Blob> {
  const W = 2400;
  const H = 1600;
  const c = new OffscreenCanvas(W, H);
  const x = c.getContext("2d")!;
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#ffb37a");
  sky.addColorStop(0.5, "#ff7e7e");
  sky.addColorStop(1, "#7a5cff");
  x.fillStyle = sky;
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#ffe7a8";
  x.beginPath();
  x.arc(1600, 640, 190, 0, Math.PI * 2);
  x.fill();
  const ridge = (pts: [number, number][], col: string) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, H);
    for (const [a, b] of pts) x.lineTo(a, b);
    x.lineTo(W, H);
    x.fill();
  };
  ridge(
    [
      [0, 1000],
      [380, 640],
      [700, 880],
      [1100, 470],
      [1550, 900],
      [1900, 650],
      [2400, 960],
    ],
    "#3b2f7a",
  );
  ridge(
    [
      [0, 1150],
      [500, 860],
      [950, 1090],
      [1450, 800],
      [1950, 1060],
      [2400, 900],
    ],
    "#2a2160",
  );
  const lake = x.createLinearGradient(0, 1240, 0, H);
  lake.addColorStop(0, "#5a4bd1");
  lake.addColorStop(1, "#1e2a5a");
  x.fillStyle = lake;
  x.fillRect(0, 1240, W, H - 1240);
  const img = x.getImageData(0, 0, W, H);
  const p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    p[i] = p[i]! + n;
    p[i + 1] = p[i + 1]! + n;
    p[i + 2] = p[i + 2]! + n;
  }
  x.putImageData(img, 0, 0);
  return c.convertToBlob({ type: "image/jpeg", quality: 0.95 });
}

/** HEIF/HEIC files start with an "ftyp" box naming a HEIF brand. */
async function isHeif(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const text = String.fromCharCode(...head);
  return (
    text.slice(4, 8) === "ftyp" &&
    /heic|heix|hevc|heim|heis|mif1|msf1|avci/.test(text.slice(8))
  );
}

/** Decode a HEIC/HEIF file with libheif (loaded only when needed, about 2 MB). */
async function decodeHeif(file: Blob): Promise<ImageBitmap> {
  // The bundle's default export is a factory that sets up the WebAssembly module
  const mod = (await import("libheif-js/libheif-wasm/libheif-bundle.mjs")) as {
    default: () => {
      HeifDecoder: new () => { decode(buf: Uint8Array): HeifImage[] };
      ready?: Promise<unknown>;
    };
  };
  const libheif = mod.default();
  if (libheif.ready) await libheif.ready;
  const images = new libheif.HeifDecoder().decode(
    new Uint8Array(await file.arrayBuffer()),
  );
  const image = images[0];
  if (!image) throw new Error("No image found in this HEIC file");
  const w = image.get_width();
  const h = image.get_height();
  const pixels = new ImageData(w, h);
  await new Promise<void>((resolve, reject) =>
    image.display(pixels, (out) =>
      out ? resolve() : reject(new Error("Couldn't decode this HEIC file")),
    ),
  );
  return createImageBitmap(pixels);
}

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(target: ImageData, done: (out: ImageData | null) => void): void;
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    if (data.kind === "load") {
      let bmp: ImageBitmap;
      let preview: Blob | undefined;
      try {
        bmp = await createImageBitmap(data.file, {
          imageOrientation: "from-image",
        });
      } catch (err) {
        // Most browsers can't decode HEIC/HEIF (iPhone photos); decode those with libheif.
        if (!(await isHeif(data.file))) throw err;
        bmp = await decodeHeif(data.file);
        // The browser can't show the original either, so send back a preview it can display.
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        c.getContext("2d")!.drawImage(bmp, 0, 0);
        preview = await c.convertToBlob({ type: "image/jpeg", quality: 0.9 });
      }
      bitmaps.set(data.key, bmp);
      self.postMessage({
        id: data.id,
        ok: true,
        value: { w: bmp.width, h: bmp.height, preview },
      });
    } else if (data.kind === "drop") {
      bitmaps.get(data.key)?.close();
      bitmaps.delete(data.key);
      for (const [id, m] of masks)
        if (id.startsWith(`${data.key}:`)) {
          void m.then((b) => b.close()).catch(() => {});
          masks.delete(id);
        }
      faceCache.delete(data.key);
      self.postMessage({ id: data.id, ok: true });
    } else if (data.kind === "encode") {
      const bmp = bitmaps.get(data.key);
      if (!bmp) throw new Error("Image is no longer loaded");
      self.postMessage({
        id: data.id,
        ok: true,
        value: await (async () => {
          const ex = await extrasFor(data.key, bmp, data.settings);
          const r = await encode(bmp, data.settings, data.srcType, ex);
          return ex.found === undefined ? r : { ...r, faces: ex.found };
        })(),
      });
    } else if (data.kind === "faces") {
      const bmp = bitmaps.get(data.key);
      if (!bmp) throw new Error("Image is no longer loaded");
      self.postMessage({
        id: data.id,
        ok: true,
        value: await facesFor(data.key, bmp),
      });
    } else if (data.kind === "sample") {
      self.postMessage({ id: data.id, ok: true, value: await sample() });
    }
  } catch (err) {
    self.postMessage({
      id: data.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
