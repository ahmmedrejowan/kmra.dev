/**
 * Hard inputs for the robustness tests in tests/hard: odd, huge, damaged and tricky images, PDFs
 * and code photos, all generated here (sharp from Astro, pdf-lib from pdftool, qrcode and
 * zxing-wasm from qrtool), so no third-party files are committed. Two encrypted PDFs are made
 * with pypdf once and kept in tests/fixtures/static (pdf-lib can't encrypt).
 *
 * Files land in tests/fixtures/gen/hard/; a file that already exists is kept (the big ones take a
 * few seconds), so delete the folder to regenerate.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
export const HARD = join(import.meta.dirname, "gen", "hard");
export const STATIC = join(import.meta.dirname, "static");
export const hard = (name: string) => join(HARD, name);
export const fixed = (name: string) => join(STATIC, name);

const fromApp = (app: string) =>
  createRequire(join(ROOT, "apps", app, "package.json"));
// sharp ships with Astro, so it's resolved through Astro's own dependencies
const fromAstro = createRequire(
  fromApp("imgtool").resolve("astro/package.json"),
);

type Sharp = typeof import("sharp");
type PdfLib = typeof import("pdf-lib");
type QR = {
  toBuffer(
    text: string,
    o: { errorCorrectionLevel?: string; margin?: number; scale?: number },
  ): Promise<Buffer>;
};

/** Names with spaces and non-Latin scripts. */
export const UNICODE_JPG = "ছবি ফাইল (১) নমুনা.jpg";
export const UNICODE_PNG = "café 写真 test.png";
export const UNICODE_PDF = "বাংলা নথি ফাইল.pdf";

export default async function makeHard() {
  await mkdir(HARD, { recursive: true });
  const sharp = fromAstro("sharp") as Sharp;
  await images(sharp);
  await pdfs(sharp);
  await codes(sharp);
}

async function put(
  name: string,
  make: () => Promise<Buffer | Uint8Array | string>,
) {
  const path = hard(name);
  if (existsSync(path)) return;
  await writeFile(path, await make());
}

/** A soft, photo-like RGB image (smooth gradients, a little grain). */
function photo(sharp: Sharp, w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffb37a"/><stop offset=".5" stop-color="#ff7e7e"/>
      <stop offset="1" stop-color="#3a2f8a"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w * 0.66}" cy="${h * 0.38}" r="${Math.min(w, h) * 0.12}" fill="#ffe7a8"/>
    <path d="M0 ${h} L0 ${h * 0.65} L${w * 0.2} ${h * 0.42} L${w * 0.45} ${h * 0.6} L${w * 0.7} ${h * 0.35} L${w} ${h * 0.62} L${w} ${h}Z" fill="#2a2160"/>
  </svg>`;
  return sharp(Buffer.from(svg));
}

/** An image whose top is obvious: "TOP" on a red band at the top. */
function upright(sharp: Sharp, w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="#ddeeff"/>
    <rect width="100%" height="${h / 5}" fill="#e5484d"/>
    <text x="${w / 2}" y="${h / 7}" font-size="${h / 9}" text-anchor="middle" font-family="sans-serif" fill="#fff">TOP</text>
  </svg>`;
  return sharp(Buffer.from(svg));
}

async function images(sharp: Sharp) {
  // 48 megapixels: built small and scaled up so the file stays a few MB
  await put("huge-8000x6000.jpg", async () => {
    const small = await photo(sharp, 800, 600).png().toBuffer();
    return sharp(small, { limitInputPixels: false })
      .resize(8000, 6000, { kernel: "cubic" })
      .jpeg({ quality: 80 })
      .toBuffer();
  });
  await put("tall-300x12000.png", async () => {
    const rows: string[] = [];
    for (let y = 0; y < 12000; y += 60)
      rows.push(
        `<rect x="16" y="${y + 14}" width="${120 + ((y / 60) % 7) * 20}" height="14" rx="3" fill="#71717a"/>`,
        `<rect x="16" y="${y + 34}" width="${200 - ((y / 60) % 5) * 18}" height="10" rx="3" fill="#d4d4d8"/>`,
      );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="12000"><rect width="100%" height="100%" fill="#fff"/>${rows.join("")}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  });
  // Stored sideways (600×400) with EXIF Orientation 6, so it should show as 400×600, TOP up
  await put("exif-orientation-6.jpg", async () => {
    const stored = await upright(sharp, 400, 600).rotate(-90).jpeg().toBuffer();
    return sharp(stored).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  });
  await put("cmyk.jpg", () =>
    photo(sharp, 900, 600)
      .toColourspace("cmyk")
      .jpeg({ quality: 85 })
      .toBuffer(),
  );
  await put("progressive.jpg", () =>
    photo(sharp, 1600, 1000)
      .jpeg({ quality: 85, progressive: true })
      .toBuffer(),
  );
  await put("16bit.png", () =>
    photo(sharp, 640, 480).toColourspace("rgb16").png().toBuffer(),
  );
  await put("palette-alpha.png", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
      <circle cx="120" cy="120" r="100" fill="#e5484d"/><rect x="170" y="40" width="120" height="160" fill="#3e63dd" fill-opacity=".6"/></svg>`;
    return sharp(Buffer.from(svg))
      .png({ palette: true, colours: 16 })
      .toBuffer();
  });
  const frames = async (w: number, h: number) =>
    Promise.all(
      ["#e5484d", "#30a46c", "#3e63dd", "#f5d90a"].map((c, i) =>
        sharp(
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fff"/><circle cx="${40 + i * 50}" cy="${h / 2}" r="30" fill="${c}"/></svg>`,
          ),
        )
          .png()
          .toBuffer(),
      ),
    );
  await put("animated.gif", async () =>
    sharp(await frames(240, 120), { join: { animated: true } })
      .gif({ delay: 200, loop: 0 })
      .toBuffer(),
  );
  await put("animated.webp", async () =>
    sharp(await frames(240, 120), { join: { animated: true } })
      .webp({ delay: 200, loop: 0 })
      .toBuffer(),
  );
  await put(
    "viewbox-only.svg",
    async () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#3e63dd"/><circle cx="60" cy="40" r="25" fill="#fff"/></svg>`,
  );
  await put(
    "external-href.svg",
    async () =>
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200">
  <rect width="200" height="200" fill="#30a46c"/>
  <image href="https://tracker.example.com/pixel.png" xlink:href="https://tracker.example.com/pixel2.png" width="100" height="100"/>
  <use href="https://tracker.example.com/sprite.svg#a"/>
  <style>@import url("https://tracker.example.com/x.css"); rect { fill: url(https://tracker.example.com/f.svg#p) #30a46c; }</style>
</svg>`,
  );
  // Pure noise: no JPEG quality gets this under 20 KB, not even MozJPEG's
  await put("noise-3000x2250.jpg", () =>
    sharp({
      create: {
        width: 3000,
        height: 2250,
        channels: 3,
        background: "#808080",
        noise: { type: "gaussian", mean: 128, sigma: 60 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer(),
  );
  // A small JPEG made with MozJPEG: no browser's encoder makes it smaller
  await put("tiny-mozjpeg-400x300.jpg", () =>
    sharp({
      create: { width: 400, height: 300, channels: 3, background: "#33aa77" },
    })
      .jpeg({ quality: 30, mozjpeg: true })
      .toBuffer(),
  );
  await put("1x1.png", () =>
    sharp({
      create: { width: 1, height: 1, channels: 4, background: "#e5484d" },
    })
      .png()
      .toBuffer(),
  );
  await put("zero-bytes.jpg", async () => Buffer.alloc(0));
  await put("png-named.jpg", () => photo(sharp, 500, 300).png().toBuffer());
  await put("truncated.jpg", async () => {
    const b = await photo(sharp, 1200, 800).jpeg().toBuffer();
    return b.subarray(0, Math.floor(b.length * 0.4));
  });
  await put("garbage.jpg", async () => {
    // A JPEG start marker, then noise
    const b = Buffer.alloc(20_000);
    for (let i = 0; i < b.length; i++) b[i] = (i * 7919 + 13) % 251;
    b[0] = 0xff;
    b[1] = 0xd8;
    b[2] = 0xff;
    return b;
  });
  await put(
    "notes.txt",
    async () => "This is a plain text file, not an image.\n",
  );
  await put(UNICODE_JPG, () => photo(sharp, 800, 500).jpeg().toBuffer());
  await put(UNICODE_PNG, () => photo(sharp, 400, 300).png().toBuffer());
  // HEIC can't be written here (no HEVC encoder); AVIF exercises the same "modern format" path
  await put("photo.avif", () => photo(sharp, 800, 500).avif().toBuffer());
}

async function pdfs(sharp: Sharp) {
  const lib = fromApp("pdftool")("pdf-lib") as PdfLib;
  const {
    PDFDocument,
    StandardFonts,
    PDFName,
    PDFHexString,
    PDFNumber,
    degrees,
    rgb,
  } = lib;
  const save = (d: InstanceType<typeof PDFDocument>) => d.save();

  await put("150-pages.pdf", async () => {
    const d = await PDFDocument.create();
    const font = await d.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 150; i++) {
      const p = d.addPage([595.28, 841.89]);
      p.drawText(`Page ${i} of 150`, { x: 60, y: 760, size: 28, font });
      for (let l = 0; l < 30; l++)
        p.drawText(
          `Line ${l + 1}: the quick brown fox jumps over the lazy dog.`,
          {
            x: 60,
            y: 700 - l * 20,
            size: 11,
            font,
          },
        );
    }
    return save(d);
  });
  await put("scanned.pdf", async () => {
    const d = await PDFDocument.create();
    for (let i = 0; i < 3; i++) {
      // A4 at 300 dpi, slightly grey and grainy like a scan
      const jpg = await sharp({
        create: {
          width: 2480,
          height: 3508,
          channels: 3,
          background: "#f2efe8",
          noise: { type: "gaussian", mean: 236, sigma: 10 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="2480" height="3508">${Array.from(
                { length: 60 },
                (_, l) =>
                  `<rect x="240" y="${300 + l * 50}" width="${1600 + ((l * 37) % 400)}" height="18" fill="#333"/>`,
              ).join(
                "",
              )}<text x="240" y="240" font-size="90" font-family="serif">Scanned page ${i + 1}</text></svg>`,
            ),
          },
        ])
        .jpeg({ quality: 70 })
        .toBuffer();
      const img = await d.embedJpg(jpg);
      const p = d.addPage([595.28, 841.89]);
      p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return save(d);
  });
  await put("rotated-mixed.pdf", async () => {
    const d = await PDFDocument.create();
    const font = await d.embedFont(StandardFonts.Helvetica);
    const add = (size: [number, number], label: string, rot = 0) => {
      const p = d.addPage(size);
      p.drawText(label, { x: 40, y: size[1] - 80, size: 24, font });
      p.drawRectangle({
        x: 20,
        y: 20,
        width: size[0] - 40,
        height: size[1] - 40,
        borderColor: rgb(0.9, 0.3, 0.3),
        borderWidth: 3,
      });
      if (rot) p.setRotation(degrees(rot));
    };
    add([595.28, 841.89], "A4 portrait, /Rotate 90", 90);
    add([612, 792], "US Letter");
    add([841.89, 595.28], "A4 landscape");
    add([419.53, 595.28], "A5, /Rotate 270", 270);
    add([595.28, 841.89], "A4, /Rotate 180", 180);
    return save(d);
  });
  await put("form.pdf", async () => {
    const d = await PDFDocument.create();
    const p = d.addPage([595.28, 841.89]);
    const form = d.getForm();
    const name = form.createTextField("name");
    name.setText("Rahim Uddin");
    name.addToPage(p, { x: 60, y: 700, width: 300, height: 28 });
    const agree = form.createCheckBox("agree");
    agree.check();
    agree.addToPage(p, { x: 60, y: 650, width: 20, height: 20 });
    const city = form.createDropdown("city");
    city.addOptions(["Dhaka", "Chattogram", "Sylhet"]);
    city.select("Dhaka");
    city.addToPage(p, { x: 60, y: 600, width: 200, height: 28 });
    d.addPage([595.28, 841.89]);
    return save(d);
  });
  await put("outline.pdf", async () => {
    const d = await PDFDocument.create();
    const font = await d.embedFont(StandardFonts.Helvetica);
    const pages = [1, 2, 3, 4].map((n) => {
      const p = d.addPage([595.28, 841.89]);
      p.drawText(`Chapter ${n}`, { x: 60, y: 760, size: 28, font });
      return p;
    });
    const ctx = d.context;
    const root = ctx.nextRef();
    const refs = pages.map(() => ctx.nextRef());
    pages.forEach((p, i) => {
      const item: Record<string, unknown> = {
        Title: PDFHexString.fromText(`Chapter ${i + 1} — অধ্যায় ${i + 1}`),
        Parent: root,
        Dest: ctx.obj([p.ref, PDFName.of("XYZ"), null, null, null]),
      };
      if (i > 0) item.Prev = refs[i - 1];
      if (i < pages.length - 1) item.Next = refs[i + 1];
      ctx.assign(refs[i]!, ctx.obj(item as never));
    });
    ctx.assign(
      root,
      ctx.obj({
        Type: "Outlines",
        First: refs[0]!,
        Last: refs[refs.length - 1]!,
        Count: PDFNumber.of(refs.length),
      }),
    );
    d.catalog.set(PDFName.of("Outlines"), root);
    d.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
    return save(d);
  });
  await put("bangla-metadata.pdf", async () => {
    const d = await PDFDocument.create();
    const font = await d.embedFont(StandardFonts.Helvetica);
    d.addPage([595.28, 841.89]).drawText("Metadata test", {
      x: 60,
      y: 760,
      size: 24,
      font,
    });
    d.setTitle("বাংলা শিরোনাম — 日本語 タイトル");
    d.setAuthor("রহিম উদ্দিন");
    d.setSubject("Ünïcödé subject ✓");
    d.setKeywords(["কীওয়ার্ড", "テスト"]);
    return save(d);
  });
  // pdf-lib adds a blank page to an empty document unless told not to
  await put("zero-pages.pdf", async () =>
    (await PDFDocument.create()).save({ addDefaultPage: false }),
  );
  await put("empty.pdf", async () => Buffer.alloc(0));
  await put("truncated.pdf", async () => {
    const b = await readFile(hard("150-pages.pdf"));
    return b.subarray(0, Math.floor(b.length * 0.3));
  });
  await put("not-a-pdf.pdf", () => photo(sharp, 200, 100).png().toBuffer());
  await put(UNICODE_PDF, async () => {
    const d = await PDFDocument.create();
    const font = await d.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 2; i++)
      d.addPage([595.28, 841.89]).drawText(`Unicode name ${i}`, {
        x: 60,
        y: 760,
        size: 24,
        font,
      });
    return save(d);
  });
  await put("images-for-pdf-cmyk.jpg", async () => readFile(hard("cmyk.jpg")));
}

/* ---------- Code photos ---------- */

type Raw = { data: Buffer; w: number; h: number };

/** Warp `src` (RGB) onto a w×h canvas so its corners land on `quad` (a perspective photo). */
function perspective(
  src: Raw,
  w: number,
  h: number,
  quad: [number, number][],
  bg: number,
): Raw {
  // Homography from the unit square to the quad, then invert per pixel
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dy1 = y1 - y2,
    dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3,
    sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const hh = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1,
    b = x3 - x0 + hh * x3,
    c = x0;
  const d = y1 - y0 + g * y1,
    e = y3 - y0 + hh * y3,
    f = y0;
  // Inverse of [[a b c][d e f][g h 1]]
  const A = e - f * hh,
    B = c * hh - b,
    C = b * f - c * e;
  const D = f * g - d,
    E = a - c * g,
    F = c * d - a * f;
  const G = d * hh - e * g,
    H = b * g - a * hh,
    I = a * e - b * d;
  const out = Buffer.alloc(w * h * 3, bg);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const z = G * x + H * y + I;
      const u = (A * x + B * y + C) / z;
      const v = (D * x + E * y + F) / z;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const sxp = Math.floor(u * src.w),
        syp = Math.floor(v * src.h);
      const si = (syp * src.w + sxp) * 3,
        di = (y * w + x) * 3;
      out[di] = src.data[si]!;
      out[di + 1] = src.data[si + 1]!;
      out[di + 2] = src.data[si + 2]!;
    }
  return { data: out, w, h };
}

export const QR_TEXT = {
  photo: "https://kmra.dev/photo-test",
  inverted: "INVERTED-42",
  tiny: "TINY",
  logo: "https://kmra.dev/logo-test",
  damaged: "https://kmra.dev/damaged-test",
  multi: ["MULTI-ONE", "MULTI-TWO", "MULTI-THREE"],
  datamatrix: "KMRA-DM-2026",
  pdf417: "KMRA TICKET 2026 SEAT 12A",
  webp: "WEBP-SCREENSHOT",
  avif: "AVIF-SCREENSHOT",
  svg: "SVG-CODE",
  big: "https://kmra.dev/big-photo",
} as const;

async function codes(sharp: Sharp) {
  const req = fromApp("qrtool");
  const QRCode = req("qrcode") as QR;
  const qr = (text: string, ecc = "M", scale = 10, margin = 4) =>
    QRCode.toBuffer(text, { errorCorrectionLevel: ecc, margin, scale });
  const raw = async (s: ReturnType<Sharp>): Promise<Raw> => {
    const { data, info } = await s
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
  };
  const fromRaw = (r: Raw) =>
    sharp(r.data, { raw: { width: r.w, height: r.h, channels: 3 } });

  // Photo of a printed code: tilted in perspective, turned ~30°, dim, low contrast, soft, JPEG-y
  await put("qr-photo.jpg", async () => {
    const code = await raw(sharp(await qr(QR_TEXT.photo, "M", 12)));
    // The sheet of paper fills the quad; the desk around it is mid grey
    const warped = perspective(
      code,
      900,
      900,
      [
        [250, 200],
        [650, 250],
        [640, 650],
        [260, 700],
      ],
      0x78,
    );
    return fromRaw(warped)
      .rotate(30, { background: "#6e655b" })
      .linear(0.55, 40)
      .modulate({ brightness: 0.7 })
      .blur(1.1)
      .jpeg({ quality: 35 })
      .toBuffer();
  });
  await put("qr-inverted.png", async () =>
    sharp(await qr(QR_TEXT.inverted))
      .negate({ alpha: false })
      .png()
      .toBuffer(),
  );
  // One pixel per module: the code itself is 21 px
  await put("qr-tiny-21px.png", () => qr(QR_TEXT.tiny, "L", 1, 2));
  await put("qr-logo.png", async () => {
    const base = await qr(QR_TEXT.logo, "H", 10, 4);
    const m = await sharp(base).metadata();
    const s = Math.round(m.width! * 0.22);
    const logo = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s / 5}" fill="#fff"/><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.36}" fill="#e5484d"/><text x="${s / 2}" y="${s * 0.62}" font-size="${s * 0.34}" text-anchor="middle" font-family="sans-serif" fill="#fff">K</text></svg>`,
    );
    return sharp(base)
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toBuffer();
  });
  await put("qr-multi.png", async () => {
    const parts = await Promise.all(QR_TEXT.multi.map((t) => qr(t, "M", 8)));
    const sizes = await Promise.all(parts.map((p) => sharp(p).metadata()));
    const w = sizes.reduce((a, m) => a + m.width! + 60, 60);
    return sharp({
      create: { width: w, height: 400, channels: 3, background: "#ffffff" },
    })
      .composite(
        parts.map((p, i) => ({
          input: p,
          left: 60 + sizes.slice(0, i).reduce((a, m) => a + m.width! + 60, 0),
          top: 40 + i * 30,
        })),
      )
      .png()
      .toBuffer();
  });
  await put("qr-damaged.png", async () => {
    const base = await qr(QR_TEXT.damaged, "H", 10, 4);
    const m = await sharp(base).metadata();
    const W = m.width!;
    // Scratches and a stain away from the finder patterns (about 10% of the symbol)
    const marks = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">
      <rect x="${W * 0.42}" y="${W * 0.55}" width="${W * 0.16}" height="${W * 0.14}" fill="#000"/>
      <rect x="${W * 0.62}" y="${W * 0.62}" width="${W * 0.12}" height="${W * 0.1}" fill="#fff"/>
      <line x1="${W * 0.3}" y1="${W * 0.8}" x2="${W * 0.75}" y2="${W * 0.4}" stroke="#fff" stroke-width="${W * 0.015}"/>
    </svg>`;
    return sharp(base)
      .composite([{ input: Buffer.from(marks) }])
      .png()
      .toBuffer();
  });
  const zx = await import(req.resolve("zxing-wasm/writer"));
  await zx.prepareZXingModule({
    overrides: {
      wasmBinary: await readFile(
        req.resolve("zxing-wasm/writer/zxing_writer.wasm"),
      ),
    },
    fireImmediately: true,
  });
  const symbol = async (text: string, format: string) => {
    const r = await zx.writeBarcode(text, { format, scale: 6 });
    if (r.error || !r.image) throw new Error(`zxing writer: ${r.error}`);
    return Buffer.from(await r.image.arrayBuffer());
  };
  // A photo of a 2D code: on paper, a slight turn, a little blur, JPEG
  const photoOf = async (png: Buffer) =>
    sharp(png)
      .extend({
        top: 60,
        bottom: 60,
        left: 60,
        right: 60,
        background: "#ffffff",
      })
      .flatten({ background: "#ffffff" })
      .rotate(7, { background: "#9a9085" })
      .linear(0.8, 20)
      .blur(0.7)
      .jpeg({ quality: 55 })
      .toBuffer();
  await put("datamatrix-photo.jpg", async () =>
    photoOf(await symbol(QR_TEXT.datamatrix, "DataMatrix")),
  );
  await put("pdf417-photo.jpg", async () =>
    photoOf(await symbol(QR_TEXT.pdf417, "PDF417")),
  );
  await put("no-code.jpg", () => photo(sharp, 900, 600).jpeg().toBuffer());
  // Screenshots saved as WebP / AVIF, and the generator's own SVG (viewBox only)
  await put("qr-webp.webp", async () =>
    sharp(await qr(QR_TEXT.webp))
      .webp()
      .toBuffer(),
  );
  await put("qr-avif.avif", async () =>
    sharp(await qr(QR_TEXT.avif))
      .avif()
      .toBuffer(),
  );
  await put("qr-svg.svg", async () =>
    (
      QRCode as unknown as { toString(t: string, o: object): Promise<string> }
    ).toString(QR_TEXT.svg, {
      type: "svg",
      margin: 4,
    }),
  );
  // A small code in a 24-megapixel photo
  await put("qr-in-big-photo.jpg", async () => {
    const code = await qr(QR_TEXT.big, "M", 8);
    const small = await photo(sharp, 600, 400).png().toBuffer();
    return sharp(await sharp(small).resize(6000, 4000).png().toBuffer(), {
      limitInputPixels: false,
    })
      .composite([{ input: code, left: 3900, top: 1500 }])
      .jpeg({ quality: 85 })
      .toBuffer();
  });
}
