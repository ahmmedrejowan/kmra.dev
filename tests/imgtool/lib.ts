/** Shared helpers for the imgtool tests: reading image headers and zips in node, pixel stats in the page. */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import type { Page, Download } from "@playwright/test";
import { expect, download, bytes, openTool, addFiles } from "../helpers.ts";

export type Kind = "png" | "jpeg" | "webp" | "gif" | "ico" | "zip" | "avif" | "bmp" | "tiff" | "unknown";

/** File type from magic bytes. */
export function kind(b: Buffer): Kind {
  if (b.subarray(1, 4).toString("latin1") === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "webp";
  if (b.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
  if (b.readUInt32BE(0) === 0x00000100) return "ico";
  if (b.subarray(4, 12).toString("latin1") === "ftypavif") return "avif";
  if (b.subarray(0, 2).toString("latin1") === "BM") return "bmp";
  if (b.subarray(0, 4).toString("latin1") === "II*\0") return "tiff";
  if (b.readUInt32LE(0) === 0x04034b50) return "zip";
  return "unknown";
}

/** Type and pixel size read from the file header (PNG, JPEG, WebP, GIF). */
export function info(b: Buffer): { type: Kind; w: number; h: number } {
  const type = kind(b);
  if (type === "png")
    return { type, w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (type === "gif")
    return { type, w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (type === "bmp")
    return { type, w: b.readInt32LE(18), h: Math.abs(b.readInt32LE(22)) };
  if (type === "tiff") {
    // ImageWidth (256) and ImageLength (257) from the first IFD
    const ifd = b.readUInt32LE(4);
    const n = b.readUInt16LE(ifd);
    let w = 0;
    let h = 0;
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      const tag = b.readUInt16LE(e);
      const val = b.readUInt16LE(e + 2) === 3 ? b.readUInt16LE(e + 8) : b.readUInt32LE(e + 8);
      if (tag === 256) w = val;
      if (tag === 257) h = val;
    }
    return { type, w, h };
  }
  if (type === "avif") {
    // The "ispe" box holds the image size
    const at = b.indexOf("ispe");
    return at > 0 ? { type, w: b.readUInt32BE(at + 8), h: b.readUInt32BE(at + 12) } : { type, w: 0, h: 0 };
  }
  if (type === "ico") {
    // One entry: a 0 byte means 256
    return { type, w: b[6] || 256, h: b[7] || 256 };
  }
  if (type === "webp") {
    const chunk = b.subarray(12, 16).toString("latin1");
    if (chunk === "VP8 ")
      return {
        type,
        w: b.readUInt16LE(26) & 0x3fff,
        h: b.readUInt16LE(28) & 0x3fff,
      };
    if (chunk === "VP8L") {
      const v = b.readUInt32LE(21);
      return { type, w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X")
      return { type, w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  if (type === "jpeg") {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { type, w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return { type, w: 0, h: 0 };
}

/** True when a JPEG carries an EXIF APP1 segment. */
export function hasExif(b: Buffer): boolean {
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m === 0xda) return false; // start of scan: no more metadata
    const len = b.readUInt16BE(i + 2);
    if (m === 0xe1 && b.subarray(i + 4, i + 8).toString("latin1") === "Exif")
      return true;
    i += 2 + len;
  }
  return false;
}

/** Entries of a zip file (stored or deflated), read from its central directory. */
export function unzip(b: Buffer): { name: string; data: Buffer }[] {
  let eocd = b.length - 22;
  while (eocd >= 0 && b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip");
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const out: { name: string; data: Buffer }[] = [];
  for (let n = 0; n < count; n++) {
    const method = b.readUInt16LE(p + 10);
    const size = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28);
    const extra = b.readUInt16LE(p + 30);
    const comment = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const start =
      local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const raw = b.subarray(start, start + size);
    out.push({
      name,
      data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw),
    });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

export type Region = [x0: number, y0: number, x1: number, y1: number];
export type Stats = {
  w: number;
  h: number;
  /** Mean R, G, B, A (0–255) */
  mean: [number, number, number, number];
  /** Share of pixels with alpha < 16 / alpha > 240 */
  transparent: number;
  opaque: number;
  /** Mean of |R−G| + |G−B|: about 0 for a greyscale image */
  colour: number;
};

/** Decode an image in the page (the browser's own decoder) and measure a region of it. */
export async function stats(
  page: Page,
  b: Buffer,
  region: Region = [0, 0, 1, 1],
): Promise<Stats> {
  return page.evaluate(
    async ({ b64, region }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([arr]));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext("2d")!;
      g.drawImage(bmp, 0, 0);
      const [x0, y0, x1, y1] = region;
      const x = Math.floor(x0 * bmp.width);
      const y = Math.floor(y0 * bmp.height);
      const w = Math.max(1, Math.floor((x1 - x0) * bmp.width));
      const h = Math.max(1, Math.floor((y1 - y0) * bmp.height));
      const d = g.getImageData(x, y, w, h).data;
      const sum = [0, 0, 0, 0];
      let tr = 0;
      let op = 0;
      let col = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        for (let k = 0; k < 4; k++) sum[k] += d[i + k];
        if (d[i + 3] < 16) tr++;
        if (d[i + 3] > 240) op++;
        col += Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2]);
      }
      return {
        w: bmp.width,
        h: bmp.height,
        mean: sum.map((s) => s / n) as [number, number, number, number],
        transparent: tr / n,
        opaque: op / n,
        colour: col / n,
      };
    },
    { b64: b.toString("base64"), region },
  );
}

/** Mean absolute RGB difference (0–255) between two same-sized images, inside a region. */
export async function diff(
  page: Page,
  a: Buffer,
  b: Buffer,
  region: Region = [0, 0, 1, 1],
): Promise<number> {
  return page.evaluate(
    async ({ a64, b64, region }) => {
      const load = async (s: string) => {
        const bin = atob(s);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const bmp = await createImageBitmap(new Blob([arr]));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext("2d")!;
        g.drawImage(bmp, 0, 0);
        const [x0, y0, x1, y1] = region;
        return g.getImageData(
          Math.floor(x0 * bmp.width),
          Math.floor(y0 * bmp.height),
          Math.max(1, Math.floor((x1 - x0) * bmp.width)),
          Math.max(1, Math.floor((y1 - y0) * bmp.height)),
        ).data;
      };
      const [da, db] = await Promise.all([load(a64), load(b64)]);
      if (da.length !== db.length) throw new Error("images differ in size");
      let s = 0;
      for (let i = 0; i < da.length; i += 4)
        s +=
          (Math.abs(da[i] - db[i]) +
            Math.abs(da[i + 1] - db[i + 1]) +
            Math.abs(da[i + 2] - db[i + 2])) /
          3;
      return s / (da.length / 4);
    },
    { a64: a.toString("base64"), b64: b.toString("base64"), region },
  );
}

export const file = (path: string) => readFileSync(path);

/** The simple-mode result panel of an ImageTool page. */
export const resultPanel = (page: Page) => page.locator(".tool-area .result");

/**
 * Wait until the preview is up to date (not processing, download enabled), optionally check the
 * result summary, then click the main download button and return the file.
 */
export async function save(
  page: Page,
  opts: { summary?: RegExp; button?: string | RegExp; timeout?: number } = {},
): Promise<{ d: Download; b: Buffer }> {
  const panel = resultPanel(page);
  const t = { timeout: opts.timeout };
  await expect(panel).not.toHaveClass(/working/, t);
  if (opts.summary) await expect(panel).toContainText(opts.summary, t);
  const btn = panel.getByRole("button", {
    name: opts.button ?? "Download",
    exact: true,
  });
  await expect(btn).toBeEnabled();
  const d = await download(page, () => btn.click());
  return { d, b: await bytes(d) };
}

/** Open a tool, add files and wait for the first result. */
export async function start(
  page: Page,
  path: string,
  files: string | string[],
  timeout?: number,
) {
  await openTool(page, path);
  await addFiles(page, files);
  await expect(resultPanel(page)).toContainText(/\d+ × \d+, (JPEG|PNG|WebP)/, {
    timeout,
  });
}

/** onnxruntime-web prints model-graph warnings ("W:onnxruntime ... Initializer ... appears in graph
 * inputs") through console.error while loading the bundled models; they are not failures. */
export const ORT_WARNINGS = /W:onnxruntime/;
