/**
 * Generated inputs for the pdftool and qrtool tests (called from make.ts). Everything is made in
 * Node: PDFs with pdf-lib, PNGs with a tiny encoder, QR codes with the `qrcode` package (the same
 * libraries the apps depend on, resolved from their node_modules).
 *
 *   text6.pdf      6 A4 pages, "Page N" plus one fruit word per page (WORDS), Title metadata
 *   landscape2.pdf 2 landscape pages ("Wide one", "Wide two")
 *   heavy.pdf      2 A4 pages of colourful noisy pictures (~1.5 MB), for compress / grayscale
 *   photo-wide.png, photo-tall.png   gradient pictures for Image to PDF
 *   qr-link.png, qr-text.png         QR codes (QR_LINK, QR_TEXT) for the scanners and checkers
 */
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

const ROOT = join(import.meta.dirname, "..", "..");
const pdfReq = createRequire(join(ROOT, "apps", "pdftool", "package.json"));
const qrReq = createRequire(join(ROOT, "apps", "qrtool", "package.json"));

/** One word per page of text6.pdf, so page order can be checked from extracted text */
export const WORDS = ["Apple", "Banana", "Cherry", "Damson", "Elder", "Fig"];
export const QR_LINK = "https://kmra.dev/scan-test?id=42";
export const QR_TEXT = "Hello from the kmra test suite";

/** RGBA pixels → PNG (no filtering; fine for test images) */
export function png(
  w: number,
  h: number,
  px: (x: number, y: number) => [number, number, number, number?],
): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = px(x, y);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Deterministic pseudo-random numbers */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export async function makeDocFixtures(dir: string) {
  const { PDFDocument, StandardFonts, rgb } = pdfReq(
    "pdf-lib",
  ) as typeof import("pdf-lib");

  // 6-page text PDF
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.setTitle("Fixture text document");
    doc.setAuthor("kmra tests");
    WORDS.forEach((word, i) => {
      const p = doc.addPage([595.28, 841.89]);
      p.drawText(`Page ${i + 1}`, { x: 60, y: 760, size: 28, font });
      p.drawText(`${word} is the word on this page`, {
        x: 60,
        y: 700,
        size: 18,
        font,
        color: rgb(0.1, 0.1, 0.4),
      });
    });
    await writeFile(join(dir, "text6.pdf"), await doc.save());
  }

  // 2 landscape pages
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const t of ["Wide one", "Wide two"]) {
      const p = doc.addPage([841.89, 595.28]);
      p.drawText(t, { x: 60, y: 500, size: 32, font });
    }
    await writeFile(join(dir, "landscape2.pdf"), await doc.save());
  }

  // Picture-heavy PDF: colourful noise compresses badly as PNG, well as JPEG
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let n = 0; n < 2; n++) {
      const r = rng(7 + n);
      const w = 620;
      const h = 877;
      const img = await doc.embedPng(
        png(w, h, (x, y) => {
          const k = r() * 60 - 30;
          return [
            Math.max(0, Math.min(255, 220 * (x / w) + k)),
            Math.max(0, Math.min(255, 60 + k)),
            Math.max(0, Math.min(255, 220 * (y / h) + k)),
          ];
        }),
      );
      const p = doc.addPage([595.28, 841.89]);
      p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
      p.drawText(`Heavy page ${n + 1}`, { x: 60, y: 760, size: 28, font });
    }
    await writeFile(join(dir, "heavy.pdf"), await doc.save());
  }

  // Pictures for Image to PDF
  await writeFile(
    join(dir, "photo-wide.png"),
    png(600, 400, (x, y) => [(x * 255) / 600, 120, (y * 255) / 400]),
  );
  await writeFile(
    join(dir, "photo-tall.png"),
    png(300, 450, (x, y) => [40, (y * 255) / 450, (x * 255) / 300]),
  );

  // QR codes
  const QRCode = qrReq("qrcode") as typeof import("qrcode");
  await writeFile(
    join(dir, "qr-link.png"),
    await QRCode.toBuffer(QR_LINK, { type: "png", scale: 12, margin: 4 }),
  );
  await writeFile(
    join(dir, "qr-text.png"),
    await QRCode.toBuffer(QR_TEXT, { type: "png", scale: 12, margin: 4 }),
  );
}
