/**
 * Strip metadata: the report lists what a photo says about you, the download carries none of it
 * and keeps the picture byte for byte; and the stripper itself on JPEG (orientation kept), PNG
 * text chunks and WebP EXIF/XMP chunks.
 */
import { readFileSync } from "node:fs";
import { test, expect, gen } from "../helpers.ts";
import { save, start } from "./lib.ts";
import { stripMetadata } from "../../apps/imgtool/src/lib/strip.ts";

/** Everything from the first scan (SOS) on: the compressed picture itself */
const scan = (b: Uint8Array) => {
  for (let i = 2; i < b.length - 1; i++) if (b[i] === 0xff && b[i + 1] === 0xda) return Buffer.from(b.subarray(i));
  return Buffer.alloc(0);
};
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(s);

test("lists the hidden data, then downloads the same picture without it", async ({ page }) => {
  await start(page, "/strip-metadata", gen("meta.jpg"));
  const report = page.locator(".meta-report");
  await expect(report.locator(".meta-rows li")).toHaveCount(7);
  const rows = await report.locator(".meta-rows li").allInnerTexts();
  const text = rows.map((r) => r.replace(/\s+/g, " ").trim());
  // Private details first: location, serial number, author
  expect(text.slice(0, 3)).toEqual(["Location 23.81030, 90.41250", "Serial number SN-48213377", "Author Jane Example"]);
  expect(text).toContain("Camera KmraPhone Model X");
  expect(text).toContain("Copyright (c) Jane Example");
  expect(text).toContain("Software PhotoApp 2.1");
  expect(text.find((t) => t.startsWith("Taken"))).toMatch(/2024/);
  // The download, checked by the page and here
  await expect(page.locator(".meta-ok")).toHaveText("Checked: none of it is left.");
  await expect(page.locator(".meta-done")).toContainText("Cut out without re-compressing");
  await expect(page.locator(".meta-done")).toContainText("Removed: Camera data (EXIF), Editing history (XMP), Comment");
  // No format choice in Simple mode
  await expect(page.locator(".controls [aria-label='Save as']")).toHaveCount(0);
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toBe("meta-strip-metadata-kmra.jpg");
  for (const s of ["Exif", "KmraPhone", "Jane Example", "SN-48213377", "Secret Editor", "taken at home"])
    expect(has(b, s), s).toBe(false);
  // The compressed picture is untouched
  expect(scan(b).equals(scan(readFileSync(gen("meta.jpg"))))).toBe(true);
});

test("a photo with no hidden data says so", async ({ page }) => {
  await start(page, "/strip-metadata", gen("photo.jpg"));
  await expect(page.locator(".meta-report")).toContainText("No location, camera or date found.");
  await expect(page.locator(".meta-ok")).toBeVisible();
});

test("stripper: a turned JPEG keeps only its orientation", () => {
  const photo = readFileSync(gen("photo.jpg"));
  const exif = Buffer.from([
    ...Buffer.from("Exif\0\0", "latin1"),
    0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8,
    0, 2,
    0x01, 0x0f, 0, 2, 0, 0, 0, 6, 0, 0, 0, 38, // Make → "Canon"
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, // Orientation 6
    0, 0, 0, 0,
    ...Buffer.from("Canon\0", "latin1"),
  ]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]), exif]);
  const input = Buffer.concat([photo.subarray(0, 2), app1, photo.subarray(2)]);
  const r = stripMetadata(new Uint8Array(input))!;
  expect(r.orientation).toBe(6);
  expect(r.removed).toEqual(["exif"]);
  expect(has(r.bytes, "Canon")).toBe(false);
  // A fresh EXIF block holding only Orientation = 6
  const at = Buffer.from(r.bytes).indexOf("Exif");
  expect(at).toBeGreaterThan(0);
  expect([...r.bytes.subarray(at + 6 + 10, at + 6 + 20)]).toEqual([0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6]);
  expect(scan(r.bytes).equals(scan(input))).toBe(true);
});

test("stripper: PNG text and EXIF chunks go, the picture chunks stay", () => {
  const png = readFileSync(gen("photo.png"));
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  };
  // Insert after IHDR (8 signature + 25 IHDR)
  const input = Buffer.concat([
    png.subarray(0, 33),
    chunk("tEXt", Buffer.from("Author\0Jane", "latin1")),
    chunk("eXIf", Buffer.from("MM\0*secret", "latin1")),
    chunk("tIME", Buffer.alloc(7)),
    png.subarray(33),
  ]);
  const r = stripMetadata(new Uint8Array(input))!;
  expect(r.removed.sort()).toEqual(["exif", "text", "time"]);
  expect(Buffer.from(r.bytes).equals(png)).toBe(true);
});

test("stripper: WebP EXIF and XMP chunks go and the header says so", () => {
  const webp = readFileSync(gen("photo.webp"));
  // Wrap the picture in an extended (VP8X) file with EXIF and XMP chunks
  const body = webp.subarray(12);
  const vp8x = Buffer.alloc(18);
  vp8x.write("VP8X", 0, "latin1");
  vp8x.writeUInt32LE(10, 4);
  vp8x[8] = 0x0c; // EXIF + XMP flags
  const w = 800 - 1;
  const h = 600 - 1;
  vp8x.writeUIntLE(w, 12, 3);
  vp8x.writeUIntLE(h, 15, 3);
  const chunk = (type: string, data: string) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, "latin1");
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, Buffer.from(data, "latin1"), Buffer.alloc(data.length & 1)]);
  };
  const chunks = Buffer.concat([vp8x, body, chunk("EXIF", "MM\0*Canon"), chunk("XMP ", "<x>Secret</x>")]);
  const riff = Buffer.alloc(12);
  riff.write("RIFF", 0, "latin1");
  riff.writeUInt32LE(4 + chunks.length, 4);
  riff.write("WEBP", 8, "latin1");
  const r = stripMetadata(new Uint8Array(Buffer.concat([riff, chunks])))!;
  expect(r.removed.sort()).toEqual(["exif", "xmp"]);
  const out = Buffer.from(r.bytes);
  expect(out.includes("Canon")).toBe(false);
  expect(out.includes("Secret")).toBe(false);
  expect(out[20]! & 0x0c).toBe(0);
  expect(out.readUInt32LE(4)).toBe(out.length - 8);
});
