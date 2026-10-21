/**
 * Generated inputs for the imgtool tests: photos drawn on a canvas in Chromium (so the encoders are
 * real browser encoders), a transparent PNG, an SVG, a JPEG with EXIF, a signature on paper and a
 * small animated GIF. Called from make.ts.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

export async function makeImgtoolFixtures(dir: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const draw = async (
      kind: "photo" | "alpha" | "signature",
      w: number,
      h: number,
      type: string,
      quality = 0.95,
    ): Promise<Buffer> => {
      const b64 = await page.evaluate(
        async ({ kind, w, h, type, quality }) => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const g = c.getContext("2d")!;
          if (kind === "photo") {
            // A busy picture (gradient, shapes, noise) so compression has real work to do
            const grad = g.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, "#1e5aa8");
            grad.addColorStop(0.5, "#e8c547");
            grad.addColorStop(1, "#b5303b");
            g.fillStyle = grad;
            g.fillRect(0, 0, w, h);
            let seed = 7;
            const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            for (let i = 0; i < 60; i++) {
              g.fillStyle = `hsla(${rnd() * 360},70%,50%,0.6)`;
              g.beginPath();
              g.arc(rnd() * w, rnd() * h, 10 + rnd() * w * 0.08, 0, 7);
              g.fill();
            }
            const img = g.getImageData(0, 0, w, h);
            for (let i = 0; i < img.data.length; i += 4) {
              const n = (rnd() - 0.5) * 50;
              img.data[i] += n;
              img.data[i + 1] += n;
              img.data[i + 2] += n;
            }
            g.putImageData(img, 0, 0);
          } else if (kind === "alpha") {
            g.fillStyle = "#e4572e";
            g.beginPath();
            g.arc(w / 2, h / 2, w / 3, 0, 7);
            g.fill();
          } else {
            g.fillStyle = "#f4f1ea";
            g.fillRect(0, 0, w, h);
            g.strokeStyle = "#1b2a6b";
            g.lineWidth = 6;
            g.lineCap = "round";
            g.beginPath();
            g.moveTo(w * 0.1, h * 0.6);
            for (let x = 0.1; x < 0.9; x += 0.02)
              g.lineTo(w * x, h * (0.5 + 0.25 * Math.sin(x * 30)));
            g.stroke();
          }
          const blob = await new Promise<Blob>((r) =>
            c.toBlob((b) => r(b!), type, quality),
          );
          const buf = new Uint8Array(await blob.arrayBuffer());
          let s = "";
          for (const x of buf) s += String.fromCharCode(x);
          return btoa(s);
        },
        { kind, w, h, type, quality },
      );
      return Buffer.from(b64, "base64");
    };

    const photo = await draw("photo", 1600, 1200, "image/jpeg");
    await writeFile(join(dir, "photo.jpg"), photo);
    await writeFile(
      join(dir, "small.jpg"),
      await draw("photo", 640, 480, "image/jpeg"),
    );
    await writeFile(
      join(dir, "photo.png"),
      await draw("photo", 800, 600, "image/png"),
    );
    await writeFile(
      join(dir, "photo.webp"),
      await draw("photo", 800, 600, "image/webp", 0.9),
    );
    await writeFile(
      join(dir, "alpha.png"),
      await draw("alpha", 400, 400, "image/png"),
    );
    await writeFile(
      join(dir, "signature.jpg"),
      await draw("signature", 900, 300, "image/jpeg", 0.9),
    );
    await writeFile(join(dir, "exif.jpg"), withExif(photo));
    await writeFile(join(dir, "meta.jpg"), withRichMeta(photo));
    await writeFile(
      join(dir, "logo.svg"),
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">` +
        `<rect width="240" height="160" rx="16" fill="#2b6cb0"/>` +
        `<circle cx="80" cy="80" r="44" fill="#f6e05e"/>` +
        `<rect x="140" y="40" width="70" height="80" fill="#fff"/></svg>`,
    );
    await writeFile(join(dir, "anim.gif"), gif(64, 48, 3));
  } finally {
    await browser.close();
  }
}

/** Insert an EXIF APP1 segment (Make, Model, Software) right after the JPEG's SOI marker. */
function withExif(jpeg: Buffer): Buffer {
  const tags: [number, string][] = [
    [0x010f, "KmraTestCam\0"],
    [0x0110, "Model T1\0"],
    [0x0131, "kmra-fixture\0"],
  ];
  // TIFF header (big-endian) + IFD0 with three ASCII entries, values stored after the IFD
  const ifdStart = 8;
  const ifdSize = 2 + tags.length * 12 + 4;
  let dataOff = ifdStart + ifdSize;
  const head = Buffer.alloc(dataOff);
  head.write("MM", 0, "latin1");
  head.writeUInt16BE(42, 2);
  head.writeUInt32BE(ifdStart, 4);
  head.writeUInt16BE(tags.length, ifdStart);
  const data: Buffer[] = [];
  tags.forEach(([tag, value], i) => {
    const e = ifdStart + 2 + i * 12;
    head.writeUInt16BE(tag, e);
    head.writeUInt16BE(2, e + 2); // ASCII
    head.writeUInt32BE(value.length, e + 4);
    head.writeUInt32BE(dataOff, e + 8);
    data.push(Buffer.from(value, "latin1"));
    dataOff += value.length;
  });
  head.writeUInt32BE(0, ifdStart + 2 + tags.length * 12);
  const tiff = Buffer.concat([head, ...data]);
  const body = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const seg = Buffer.alloc(4);
  seg.writeUInt16BE(0xffe1, 0);
  seg.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), seg, body, jpeg.subarray(2)]);
}

type Tag = [tag: number, type: "ascii" | "short" | "long" | "rational", value: string | number | number[]];

/** A big-endian TIFF IFD at `at` (its offset in the TIFF), values after it; sub-IFDs follow */
function ifd(tags: Tag[], at: number): Buffer {
  const size = 2 + tags.length * 12 + 4;
  const head = Buffer.alloc(size);
  head.writeUInt16BE(tags.length, 0);
  const data: Buffer[] = [];
  let off = at + size;
  tags.forEach(([tag, type, value], i) => {
    const e = 2 + i * 12;
    head.writeUInt16BE(tag, e);
    let bytes: Buffer;
    let code: number;
    let count: number;
    if (type === "ascii") {
      bytes = Buffer.from(`${value}\0`, "latin1");
      code = 2;
      count = bytes.length;
    } else if (type === "short") {
      bytes = Buffer.alloc(2);
      bytes.writeUInt16BE(value as number);
      code = 3;
      count = 1;
    } else if (type === "long") {
      bytes = Buffer.alloc(4);
      bytes.writeUInt32BE(value as number);
      code = 4;
      count = 1;
    } else {
      const v = value as number[];
      bytes = Buffer.alloc(v.length * 8);
      v.forEach((x, j) => {
        bytes.writeUInt32BE(Math.round(x * 10000), j * 8);
        bytes.writeUInt32BE(10000, j * 8 + 4);
      });
      code = 5;
      count = v.length;
    }
    head.writeUInt16BE(code, e + 2);
    head.writeUInt32BE(count, e + 4);
    if (bytes.length <= 4) bytes.copy(head, e + 8);
    else {
      head.writeUInt32BE(off, e + 8);
      data.push(bytes);
      off += bytes.length;
    }
  });
  return Buffer.concat([head, ...data]);
}

/**
 * A JPEG with the metadata a phone photo carries: GPS position, camera, date taken, software,
 * author, copyright and serial number (EXIF), editing data (XMP) and a comment. For Strip metadata.
 */
function withRichMeta(jpeg: Buffer): Buffer {
  // Lay out IFD0, then the Exif IFD, then the GPS IFD, each with its own values
  const exifTags: Tag[] = [
    [0x9003, "ascii", "2024:05:17 14:32:10"],
    [0xa431, "ascii", "SN-48213377"],
  ];
  const gpsTags: Tag[] = [
    [0x0001, "ascii", "N"],
    [0x0002, "rational", [23, 48, 37.08]],
    [0x0003, "ascii", "E"],
    [0x0004, "rational", [90, 24, 45]],
  ];
  const base: Tag[] = [
    [0x010f, "ascii", "KmraPhone"],
    [0x0110, "ascii", "Model X"],
    [0x0131, "ascii", "PhotoApp 2.1"],
    [0x013b, "ascii", "Jane Example"],
    [0x8298, "ascii", "(c) Jane Example"],
    [0x8769, "long", 0],
    [0x8825, "long", 0],
  ];
  const first = ifd(base, 8).length;
  const exifAt = 8 + first;
  const exif = ifd(exifTags, exifAt);
  const gpsAt = exifAt + exif.length;
  base[5] = [0x8769, "long", exifAt];
  base[6] = [0x8825, "long", gpsAt];
  const tiffHead = Buffer.from([0x4d, 0x4d, 0, 42, 0, 0, 0, 8]);
  const tiff = Buffer.concat([tiffHead, ifd(base, 8), exif, ifd(gpsTags, gpsAt)]);
  const segment = (marker: number, body: Buffer) => {
    const h = Buffer.alloc(4);
    h.writeUInt16BE(marker, 0);
    h.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([h, body]);
  };
  const xmp = Buffer.from(
    'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Secret Editor 9"/></rdf:RDF></x:xmpmeta>',
    "latin1",
  );
  return Buffer.concat([
    jpeg.subarray(0, 2),
    segment(0xffe1, Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff])),
    segment(0xffe1, xmp),
    segment(0xfffe, Buffer.from("taken at home", "latin1")),
    jpeg.subarray(2),
  ]);
}

/**
 * A tiny animated GIF: `frames` frames, each a different solid-ish pattern. Pixel data uses
 * "uncompressed" LZW (a clear code every 120 codes keeps the code size fixed at 8 bits).
 */
function gif(w: number, h: number, frames: number): Buffer {
  const palette = [
    [0, 0, 0],
    [230, 60, 60],
    [60, 180, 90],
    [60, 100, 230],
  ];
  const parts: Buffer[] = [];
  const minCode = 7; // 128-colour table, 8-bit codes
  const header = Buffer.alloc(13);
  header.write("GIF89a", 0, "latin1");
  header.writeUInt16LE(w, 6);
  header.writeUInt16LE(h, 8);
  header[10] = 0x80 | 0x70 | (minCode - 1); // global table, 8-bit colour, 2^7 entries
  parts.push(header);
  const table = Buffer.alloc(3 * 128);
  palette.forEach((c, i) => table.set(c, i * 3));
  parts.push(table);
  // Loop forever
  parts.push(
    Buffer.from([
      0x21,
      0xff,
      0x0b,
      ...Buffer.from("NETSCAPE2.0"),
      3,
      1,
      0,
      0,
      0,
    ]),
  );
  for (let f = 0; f < frames; f++) {
    parts.push(Buffer.from([0x21, 0xf9, 4, 0x04, 20, 0, 0, 0])); // 200 ms, keep
    const desc = Buffer.alloc(10);
    desc[0] = 0x2c;
    desc.writeUInt16LE(w, 5);
    desc.writeUInt16LE(h, 7);
    parts.push(desc);
    const clear = 1 << minCode;
    const codes: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (i % 120 === 0) codes.push(clear);
      const x = i % w;
      const y = Math.floor(i / w);
      codes.push(1 + ((Math.floor(x / 16) + Math.floor(y / 16) + f) % 3));
    }
    codes.push(clear + 1);
    const lzw = Buffer.from(codes); // 8-bit codes are whole bytes
    const blocks: Buffer[] = [Buffer.from([minCode])];
    for (let i = 0; i < lzw.length; i += 255) {
      const chunk = lzw.subarray(i, i + 255);
      blocks.push(Buffer.from([chunk.length]), chunk);
    }
    blocks.push(Buffer.from([0]));
    parts.push(...blocks);
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
