/**
 * Strip metadata: the report lists what a photo says about you, the download carries none of it
 * and keeps the picture byte for byte; and the stripper itself on JPEG (orientation kept), PNG
 * text chunks and WebP EXIF/XMP chunks.
 */
import { readFileSync } from "node:fs";
import { test, expect, gen } from "../helpers.ts";
import { save, start } from "./lib.ts";
import { stripMetadata } from "../../apps/imgtool/src/lib/strip.ts";
import { readTiff } from "../../apps/imgtool/src/lib/tiff.ts";

/** Everything from the first scan (SOS) on: the compressed picture itself */
const scan = (b: Uint8Array) => {
  for (let i = 2; i < b.length - 1; i++) if (b[i] === 0xff && b[i + 1] === 0xda) return Buffer.from(b.subarray(i));
  return Buffer.alloc(0);
};
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(s);

const field = (page: import("@playwright/test").Page, name: string) =>
  page.locator(".meta-field").filter({ has: page.locator(".meta-name", { hasText: new RegExp(`^${name}`) }) });
const preset = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("group", { name: "Choose fields to remove" }).getByRole("button", { name, exact: true });

test("lists every field, grouped, with the sensitive ones marked", async ({ page }) => {
  await start(page, "/strip-metadata", gen("meta.jpg"));
  await expect(page.locator(".meta-group")).toHaveCount(7);
  const groups = await page.locator(".meta-group legend span").allInnerTexts();
  expect(groups).toEqual([
    "Location",
    "Date and time",
    "People and rights",
    "Device",
    "Editing data (XMP)",
    "Image",
    "Other",
  ]);
  await expect(field(page, "Latitude").nth(1).locator(".meta-val")).toHaveText("23, 48, 37.08");
  await expect(field(page, "Serial number").locator(".meta-val")).toHaveText("SN-48213377");
  await expect(field(page, "Artist").locator(".meta-tag")).toHaveText("Sensitive");
  await expect(field(page, "Camera model").locator(".meta-tag")).toHaveCount(0);
  await expect(field(page, "xmp:CreatorTool").locator(".meta-val")).toHaveText("Secret Editor 9");
  await expect(field(page, "Comment").locator(".meta-val")).toHaveText("taken at home");
  // Remove all: everything but the colour profile; the download is checked
  await expect(page.locator(".meta-count")).toHaveText("Removing 13 of 14 fields");
  await expect(page.locator(".meta-ok")).toHaveText("Checked: only the field you kept is left.");
  await expect(page.locator(".controls [aria-label='Save as']")).toHaveCount(0);
  const { d, b } = await save(page);
  expect(d.suggestedFilename()).toBe("meta-strip-metadata-kmra.jpg");
  for (const s of ["Exif", "KmraPhone", "Jane Example", "SN-48213377", "Secret Editor", "taken at home"])
    expect(has(b, s), s).toBe(false);
  expect(has(b, "ICC_PROFILE")).toBe(true);
  // The compressed picture is untouched
  expect(scan(b).equals(scan(readFileSync(gen("meta.jpg"))))).toBe(true);
});

test("presets, a group and a single field decide what stays", async ({ page }) => {
  await start(page, "/strip-metadata", gen("meta.jpg"));
  const count = page.locator(".meta-count");
  await preset(page, "Sensitive only").click();
  await expect(count).toHaveText("Removing 10 of 14 fields");
  await preset(page, "Unselect all").click();
  await expect(count).toHaveText("Removing 0 of 14 fields");
  await preset(page, "Select all").click();
  await expect(count).toHaveText("Removing 14 of 14 fields");
  await expect(page.locator(".meta-ok")).toHaveText("Checked: none of it is left.");
  // Keep the camera model, and the whole location group
  await field(page, "Camera model").locator("input").uncheck();
  const location = page.locator(".meta-group").filter({ has: page.locator("legend", { hasText: "Location" }) });
  await location.locator("legend input").uncheck();
  await expect(location.locator("legend small")).toHaveText("0 of 4");
  await expect(count).toHaveText("Removing 9 of 14 fields");
  await expect(page.locator(".meta-ok")).toHaveText("Checked: only the 5 fields you kept are left.");
  const { b } = await save(page);
  expect(has(b, "Model X")).toBe(true);
  expect(has(b, "KmraPhone")).toBe(false);
  expect(has(b, "SN-48213377")).toBe(false);
  expect(has(b, "Secret Editor")).toBe(false);
  // What's left is still well-formed EXIF: the kept location and model, nothing else
  const at = b.indexOf("Exif") + 6;
  const t = readTiff(new Uint8Array(b.subarray(at, at + b.readUInt16BE(at - 8) - 8)))!;
  expect(t.gps.map((e) => e.tag)).toEqual([1, 2, 3, 4]);
  expect(t.ifd0.map((e) => e.tag)).toEqual([272]);
  expect(t.exif).toEqual([]);
});

test("a photo with nothing but a colour profile says there's nothing to remove", async ({ page }) => {
  await start(page, "/strip-metadata", gen("photo.jpg"));
  await expect(page.locator(".meta-count")).toHaveText(/Removing 0 of 1 field/);
  await expect(field(page, "Colour profile")).toBeVisible();
});

test("stripper: IPTC fields go one by one", async () => {
  const { readIptc, writeIptc } = await import("../../apps/imgtool/src/lib/iptc.ts");
  const recs = [
    { record: 2, dataset: 80, data: Buffer.from("Jane Example") },
    { record: 2, dataset: 120, data: Buffer.from("At the beach") },
    { record: 2, dataset: 25, data: Buffer.from("holiday") },
  ];
  const app13 = Buffer.from(writeIptc(recs));
  expect(readIptc(new Uint8Array(app13)).map((r) => r.dataset)).toEqual([80, 120, 25]);
  const photo = readFileSync(gen("photo.jpg"));
  const seg = Buffer.concat([Buffer.from([0xff, 0xed, (app13.length + 2) >> 8, (app13.length + 2) & 0xff]), app13]);
  const input = new Uint8Array(Buffer.concat([photo.subarray(0, 2), seg, photo.subarray(2)]));
  const r = stripMetadata(input, (id) => id === "iptc:80")!;
  expect(has(r.bytes, "Jane Example")).toBe(false);
  expect(has(r.bytes, "At the beach")).toBe(true);
  expect(has(r.bytes, "holiday")).toBe(true);
  expect(r.removed).toEqual(["iptc"]);
});

test("stripper: chosen EXIF fields go, the rest stay readable", async () => {
  const input = new Uint8Array(readFileSync(gen("meta.jpg")));
  const r = stripMetadata(input, (id) => id === "gps:2" || id === "gps:4" || id === "exif:42033")!;
  expect(has(r.bytes, "SN-48213377")).toBe(false);
  expect(has(r.bytes, "KmraPhone")).toBe(true);
  expect(has(r.bytes, "Jane Example")).toBe(true);
  expect(scan(r.bytes).equals(scan(input))).toBe(true);
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
  // photo.webp is an extended WebP (VP8X + colour profile + picture): add EXIF and XMP to it
  const webp = Buffer.from(readFileSync(gen("photo.webp")));
  expect(webp.subarray(12, 16).toString()).toBe("VP8X");
  webp[20] = webp[20]! | 0x0c; // EXIF + XMP flags
  const chunk = (type: string, data: string) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, "latin1");
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, Buffer.from(data, "latin1"), Buffer.alloc(data.length & 1)]);
  };
  const body = Buffer.concat([webp.subarray(12), chunk("EXIF", "MM\0*Canon"), chunk("XMP ", "<x>Secret</x>")]);
  const input = Buffer.concat([webp.subarray(0, 12), body]);
  input.writeUInt32LE(input.length - 8, 4);
  const r = stripMetadata(new Uint8Array(input))!;
  expect(r.removed.sort()).toEqual(["exif", "xmp"]);
  const out = Buffer.from(r.bytes);
  expect(out.includes("Canon")).toBe(false);
  expect(out.includes("Secret")).toBe(false);
  // EXIF and XMP flags cleared, the colour profile flag kept
  expect(out[20]! & 0x0c).toBe(0);
  expect(out[20]! & 0x20).toBe(0x20);
  expect(out.readUInt32LE(4)).toBe(out.length - 8);
  expect(out.equals(Buffer.concat([webp.subarray(0, 20), Buffer.from([webp[20]! & ~0x0c]), webp.subarray(21)]))).toBe(true);
});
