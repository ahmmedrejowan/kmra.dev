/**
 * imgtool with hard inputs: huge, tall, rotated, CMYK, 16-bit, paletted, animated, SVG, tiny,
 * empty, damaged, mislabelled and non-image files, Unicode names. Each must give a result or a
 * clear message, never a crash, a stuck "Working…" or a console error.
 */
import {
  test,
  expect,
  openTool,
  addFiles,
  download,
  bytes,
  hasLocal,
  local,
} from "../helpers.ts";
import {
  hard,
  outcome,
  toast,
  offsite,
  unzip,
  BANGLA,
  UNICODE_JPG,
  UNICODE_PNG,
} from "./util.ts";

const RESULT = {
  ok: ".tool-area .result .sz",
  warn: ".tool-area .result .warn",
  toast: ".toast",
};

/** Files every image tool should open and process. */
const GOOD: [string, RegExp][] = [
  ["huge-8000x6000.jpg", /8000 × 6000/],
  ["tall-300x12000.png", /300 × 12000/],
  ["exif-orientation-6.jpg", /400 × 600/],
  ["cmyk.jpg", /900 × 600/],
  ["progressive.jpg", /1600 × 1000/],
  ["16bit.png", /640 × 480/],
  ["palette-alpha.png", /320 × 240/],
  ["animated.gif", /240 × 120/],
  ["animated.webp", /240 × 120/],
  ["viewbox-only.svg", /× /],
  ["1x1.png", /1 × 1/],
  ["png-named.jpg", /500 × 300/],
  ["photo.avif", /800 × 500/],
  [UNICODE_JPG, /800 × 500/],
  [UNICODE_PNG, /400 × 300/],
];

for (const [name, dims] of GOOD)
  test(`compress opens ${name}`, async ({ page }) => {
    await openTool(page, "/compress");
    await addFiles(page, hard(name));
    const r = await outcome(page, RESULT, 60_000);
    expect(r, `${name}: ${r.text}`).toMatchObject({ kind: "ok" });
    await expect(page.locator(".tool-area .result")).toContainText(dims);
    const d = await download(page, () =>
      page
        .locator(".tool-area .result")
        .getByRole("button", { name: "Download", exact: true })
        .click(),
    );
    expect((await bytes(d)).length).toBeGreaterThan(50);
    expect(d.suggestedFilename()).toMatch(/-kmra\.(jpg|png|webp|avif)$/);
  });

/** Files no tool can open: each gets a clear message, and the drop box stays. */
const BAD: [string, RegExp][] = [
  ["zero-bytes.jpg", /couldn't be opened/],
  ["garbage.jpg", /couldn't be opened/],
  ["notes.txt", /isn't an image/],
];
for (const [name, msg] of BAD)
  test(`compress explains ${name}`, async ({ page }) => {
    await openTool(page, "/compress");
    await addFiles(page, hard(name));
    await expect(toast(page)).toContainText(msg);
    await expect(page.locator(".tool-area .result .sz")).toHaveCount(0);
  });

test("a truncated JPEG opens (as far as it goes) or is explained", async ({
  page,
}) => {
  await openTool(page, "/compress");
  await addFiles(page, hard("truncated.jpg"));
  const r = await outcome(page, RESULT);
  if (r.kind === "toast") expect(r.text).toMatch(/couldn't be opened/);
  else expect(r.kind).toBe("ok");
});

test("Bangla page explains a broken file in Bangla", async ({ page }) => {
  await openTool(page, "/bn/compress");
  await addFiles(page, hard("garbage.jpg"));
  await expect(toast(page)).toHaveText(BANGLA);
  await addFiles(page, hard("notes.txt"));
  await expect(toast(page)).toHaveText(BANGLA);
});

test("resize keeps EXIF orientation: a sideways phone photo comes out upright", async ({
  page,
}) => {
  await openTool(page, "/resize");
  await addFiles(page, hard("exif-orientation-6.jpg"));
  await expect(page.locator(".tool-area .result")).toContainText("400 × 600");
});

test("convert a 48-megapixel JPEG to WebP", async ({ page }) => {
  test.setTimeout(120_000);
  await openTool(page, "/jpg-to-webp");
  await addFiles(page, hard("huge-8000x6000.jpg"));
  const r = await outcome(page, RESULT, 90_000);
  expect(r, r.text).toMatchObject({ kind: "ok" });
  await expect(page.locator(".tool-area .result")).toContainText("WebP");
});

test("compress to 100 KB on the huge photo finishes", async ({ page }) => {
  test.setTimeout(150_000);
  await openTool(page, "/compress-to-100kb");
  await addFiles(page, hard("huge-8000x6000.jpg"));
  const r = await outcome(page, RESULT, 120_000);
  expect(["ok", "warn"]).toContain(r.kind);
  await expect(page.locator(".tool-area .result.working")).toHaveCount(0, {
    timeout: 120_000,
  });
});

test("a target size that can't be reached is explained, in Bangla too", async ({
  page,
}) => {
  await openTool(page, "/compress-to-20kb");
  await addFiles(page, hard("noise-3000x2250.jpg"));
  await expect(page.locator(".tool-area .result .warn")).toContainText(
    "Can't get under 20 KB",
    { timeout: 60_000 },
  );
  await openTool(page, "/bn/compress-to-20kb");
  await addFiles(page, hard("noise-3000x2250.jpg"));
  await expect(page.locator(".tool-area .result .warn")).toHaveText(BANGLA, {
    timeout: 60_000,
  });
});

test("crop to square on a 300×12000 screenshot", async ({ page }) => {
  await openTool(page, "/crop-to-square");
  await addFiles(page, hard("tall-300x12000.png"));
  await expect(page.locator(".tool-area .result")).toContainText("300 × 300");
});

test("SVG with only a viewBox becomes a sized PNG", async ({ page }) => {
  await openTool(page, "/svg-to-png");
  await addFiles(page, hard("viewbox-only.svg"));
  const r = await outcome(page, RESULT);
  expect(r.kind).toBe("ok");
  // 120×80 viewBox: the PNG keeps the 3:2 shape
  const txt = await page.locator(".tool-area .result").innerText();
  const m = /(\d+) × (\d+)/.exec(txt)!;
  expect(Number(m[1]) / Number(m[2])).toBeCloseTo(1.5, 1);
});

test("SVG with external links is converted without fetching anything", async ({
  page,
}) => {
  const away = offsite(page);
  await openTool(page, "/svg-to-png");
  await addFiles(page, hard("external-href.svg"));
  expect((await outcome(page, RESULT)).kind).toBe("ok");
  await page.waitForTimeout(500);
  expect(away).toEqual([]);
});

test("editor batch: good files load, bad ones are named, zip has the good ones", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await openTool(page, "/editor");
  await addFiles(page, [
    hard("progressive.jpg"),
    hard("garbage.jpg"),
    hard("16bit.png"),
    hard("cmyk.jpg"),
    hard("zero-bytes.jpg"),
    hard(UNICODE_JPG),
    hard("viewbox-only.svg"),
  ]);
  await expect(
    page.getByText("zero-bytes.jpg couldn't be opened", { exact: false }),
  ).toBeVisible();
  const d = await download(page, () =>
    page.getByRole("button", { name: "Zip of 5" }).click(),
  );
  const zip = await bytes(d);
  expect(zip.subarray(0, 2).toString()).toBe("PK");
  const names = Object.keys(unzip(zip)).sort();
  expect(names).toHaveLength(5);
  expect(names.some((n) => n.startsWith("ছবি ফাইল"))).toBe(true);
});

/* ---------- Inspect: image info and EXIF ---------- */

test("image info reads odd formats", async ({ page }) => {
  await openTool(page, "/image-info");
  await addFiles(page, [
    hard("cmyk.jpg"),
    hard("16bit.png"),
    hard("palette-alpha.png"),
    hard("exif-orientation-6.jpg"),
    hard(UNICODE_PNG),
  ]);
  await expect(page.locator(".tool-area .fchip:not(.add)")).toHaveCount(5);
  await expect(page.locator(".tool-area")).toContainText("900");
});

test("image info explains a file it can't read", async ({ page }) => {
  await openTool(page, "/image-info");
  await addFiles(page, hard("garbage.jpg"));
  await expect(toast(page)).toContainText("couldn't be opened");
});

test("EXIF viewer shows the orientation of a rotated phone photo", async ({
  page,
}) => {
  await openTool(page, "/exif");
  await addFiles(page, hard("exif-orientation-6.jpg"));
  await expect(page.locator(".tool-area")).toContainText(/Orientation/i);
});

/* ---------- Base64, GIF frames, favicon ---------- */

test("Base64 encodes a 1×1 PNG and an SVG", async ({ page }) => {
  await openTool(page, "/base64");
  await addFiles(page, hard("1x1.png"));
  await expect(page.locator(".tool-area textarea").first()).toHaveValue(
    /^data:image\/png;base64,/,
  );
  await addFiles(page, hard("viewbox-only.svg"));
  await expect(page.locator(".tool-area textarea").first()).toHaveValue(
    /^data:image\/svg\+xml;base64,/,
  );
});

test("Base64 explains a non-image", async ({ page }) => {
  await openTool(page, "/base64");
  await addFiles(page, hard("notes.txt"));
  await expect(toast(page)).toContainText("isn't an image");
});

test("GIF frames splits an animated GIF into 4 frames", async ({ page }) => {
  await openTool(page, "/gif-frames");
  await addFiles(page, hard("animated.gif"));
  await expect(page.locator(".tool-area")).toContainText(/4 frames/);
});

test("GIF frames explains a damaged GIF and a non-GIF", async ({ page }) => {
  await openTool(page, "/gif-frames");
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles({
      name: "broken.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("GIF89a\x10\x00\x10\x00garbage-garbage"),
    });
  await expect(toast(page)).toContainText("couldn't be read");
  await addFiles(page, hard("animated.webp"));
  await expect(toast(page)).toContainText(/isn't a GIF|frames/);
});

for (const name of [
  "1x1.png",
  "tall-300x12000.png",
  "viewbox-only.svg",
  "cmyk.jpg",
])
  test(`favicon from ${name}`, async ({ page }) => {
    await openTool(page, "/favicon");
    await addFiles(page, hard(name));
    const btn = page
      .locator(".tool-area")
      .getByRole("button", { name: /Download/ })
      .first();
    await expect(btn).toBeEnabled();
    const d = await download(page, () => btn.click());
    expect((await bytes(d)).length).toBeGreaterThan(100);
  });

test("favicon explains a broken file", async ({ page }) => {
  await openTool(page, "/favicon");
  await addFiles(page, hard("garbage.jpg"));
  await expect(toast(page)).toContainText("couldn't be opened");
});

test("HEIC to JPG with a real iPhone photo", async ({ page }) => {
  test.skip(!hasLocal("sample.heic"), "needs tests/fixtures/local/sample.heic");
  test.setTimeout(120_000);
  await openTool(page, "/heic-to-jpg");
  await addFiles(page, local("sample.heic"));
  const r = await outcome(page, RESULT, 90_000);
  expect(r, r.text).toMatchObject({ kind: "ok" });
  await expect(page.locator(".tool-area .result")).toContainText("JPEG");
});

/* ---------- Other standalone tools with an SVG that has no size ---------- */

for (const [path, ready] of [
  ["/palette", /#[0-9a-f]{6}/i],
  ["/split", /Download/],
  ["/collage", /Download/],
] as const)
  test(`${path} opens an SVG with only a viewBox, and explains a broken file`, async ({
    page,
  }) => {
    await openTool(page, path);
    await addFiles(page, hard("viewbox-only.svg"));
    await expect(page.locator(".tool-area")).toContainText(ready);
    await expect(page.locator(".toast")).toHaveCount(0);
    await openTool(page, path);
    await addFiles(page, hard("garbage.jpg"));
    await expect(toast(page)).toContainText("couldn't be opened");
  });

/* ---------- Every pipeline tool on the extremes: 1×1 and 300×12000 ---------- */

const PIPELINE = [
  "resize",
  "convert",
  "strip-metadata",
  "crop",
  "rotate",
  "adjust",
  "filters",
  "add-text",
  "watermark",
  "border",
  "extend-canvas",
  "beautify",
  "blur",
  "signature",
  "face-blur",
  "passport-photo",
  "white-background",
];
for (const tool of PIPELINE)
  for (const name of ["1x1.png", "tall-300x12000.png"])
    test(`${tool} handles ${name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await openTool(page, `/${tool}`);
      await addFiles(page, hard(name));
      const r = await outcome(page, RESULT, 90_000);
      expect(r.kind, r.text).not.toBe("toast");
      await expect(page.locator(".tool-area .result.working")).toHaveCount(0, {
        timeout: 90_000,
      });
    });

for (const [tool, name] of [
  ["face-blur", "huge-8000x6000.jpg"],
  ["remove-bg", "huge-8000x6000.jpg"],
  ["remove-bg", "16bit.png"],
  ["passport-photo", "exif-orientation-6.jpg"],
] as const)
  test(`${tool} on ${name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await openTool(page, `/${tool}`);
    await addFiles(page, hard(name));
    const r = await outcome(page, RESULT, 150_000);
    expect(r.kind, r.text).not.toBe("toast");
    await expect(page.locator(".tool-area .result.working")).toHaveCount(0, {
      timeout: 150_000,
    });
    await expect(page.locator(".tool-area .result .sz")).toBeVisible();
  });
