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
