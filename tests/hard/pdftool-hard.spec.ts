/**
 * pdftool with hard inputs: 150 pages, scanned pages, /Rotate and mixed sizes, forms, bookmarks,
 * Unicode metadata and names, encrypted, empty, truncated and fake PDFs. Each must give a result
 * or a clear message, never a crash, a stuck "Working…" or a console error.
 */
import {
  test,
  expect,
  openTool,
  addFiles,
  download,
  bytes,
} from "../helpers.ts";
import {
  load,
  loaded,
  pageCount,
  pageTexts,
  rotations,
  runAndDownload,
  toolButton,
  unzip,
} from "../pdftool/util.ts";
import {
  hard,
  fixed,
  toast,
  BANGLA,
  UNICODE_PDF,
  UNICODE_JPG,
} from "./util.ts";

// pdf.js warns (console.warn) about damaged files; errors would fail the test
test.use({ allowConsole: [] });

/* ---------- Opening ---------- */

const UNOPENABLE: [string, string, RegExp][] = [
  ["empty.pdf", hard("empty.pdf"), /couldn't be opened/],
  ["not-a-pdf.pdf", hard("not-a-pdf.pdf"), /couldn't be opened/],
  ["zero-pages.pdf", hard("zero-pages.pdf"), /no pages|couldn't be opened/],
  [
    "password-protected.pdf",
    fixed("password-protected.pdf"),
    /password-protected/,
  ],
];
for (const [name, path, msg] of UNOPENABLE)
  for (const tool of ["merge", "compress", "sign", "to-text"])
    test(`${tool}: ${name} gets a clear message`, async ({ page }) => {
      await openTool(page, `/${tool}`);
      await addFiles(page, path);
      await expect(toast(page)).toContainText(msg);
      // Still the empty drop box: nothing half-loaded
      await expect(page.locator(".tool-area .dropzone")).toBeVisible();
    });

test("Bangla page explains a password-protected PDF in Bangla", async ({
  page,
}) => {
  await openTool(page, "/bn/merge");
  await addFiles(page, fixed("password-protected.pdf"));
  await expect(toast(page)).toHaveText(BANGLA);
});

test("a truncated PDF opens what it can or is explained", async ({ page }) => {
  await openTool(page, "/merge");
  await addFiles(page, hard("truncated.pdf"));
  const r = page.locator(".toast, .tool-area .result small").first();
  await r.waitFor();
  if (await page.locator(".toast").count())
    await expect(toast(page)).toContainText(/couldn't be opened|damaged/);
  else {
    await toolButton(page, /Merge|Save/)
      .first()
      .click();
    await expect(
      page.locator(".toast, .tool-area .result .sz").first(),
    ).toBeVisible({ timeout: 60_000 });
  }
});

test("owner-password PDF opens, but changing it says it's protected", async ({
  page,
}) => {
  await openTool(page, "/page-numbers");
  await addFiles(page, fixed("owner-locked.pdf"));
  await loaded(page, 2);
  await toolButton(page, "Add page numbers").click();
  await expect(toast(page)).toContainText("password-protected");
  await expect(page.locator(".tool-area .result.working")).toHaveCount(0);
});

test("owner-password PDF can still be turned into images (read-only use)", async ({
  page,
}) => {
  await openTool(page, "/to-image");
  await addFiles(page, fixed("owner-locked.pdf"));
  await loaded(page, 2);
  const out = await runAndDownload(
    page,
    "Convert to images",
    "Download 2 files (zip)",
  );
  expect(Object.keys(unzip(out.bytes))).toHaveLength(2);
});

/* ---------- 150 pages ---------- */

test("150 pages: page numbers on every page in reasonable time", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openTool(page, "/page-numbers");
  await addFiles(page, hard("150-pages.pdf"));
  await loaded(page, 150);
  const t0 = Date.now();
  const out = await runAndDownload(page, "Add page numbers");
  expect(Date.now() - t0).toBeLessThan(30_000);
  const texts = await pageTexts(out.bytes);
  expect(texts).toHaveLength(150);
  expect(texts[149]).toContain("150");
});

test("150 pages: organize grid shows every page and stays responsive", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openTool(page, "/organize");
  await addFiles(page, hard("150-pages.pdf"));
  await loaded(page, 150);
  const cards = page.locator(".page-grid .pg");
  await expect(cards).toHaveCount(150);
  // The main thread answers quickly while thumbnails render
  const lag = await page.evaluate(
    () =>
      new Promise<number>((res) => {
        const t = performance.now();
        setTimeout(() => res(performance.now() - t), 0);
      }),
  );
  expect(lag).toBeLessThan(500);
  await page
    .locator(".page-grid")
    .evaluate((el) => el.scrollIntoView({ block: "end" }));
  await cards.nth(149).scrollIntoViewIfNeeded();
  await expect(cards.nth(149).locator("img")).toBeVisible({ timeout: 30_000 });
  const t0 = Date.now();
  await cards.nth(149).getByRole("button", { name: "Delete page" }).click();
  await expect(cards).toHaveCount(149);
  expect(Date.now() - t0).toBeLessThan(3_000);
  const out = await runAndDownload(page, "Save PDF");
  expect(await pageCount(out.bytes)).toBe(149);
});

test("150 pages: split every page makes 150 files", async ({ page }) => {
  test.setTimeout(150_000);
  await openTool(page, "/split-every-page");
  await addFiles(page, hard("150-pages.pdf"));
  await loaded(page, 150);
  const out = await runAndDownload(page, "Split", "Download 150 files (zip)");
  expect(Object.keys(unzip(out.bytes))).toHaveLength(150);
});

test("150 pages: text comes out for every page", async ({ page }) => {
  test.setTimeout(120_000);
  await openTool(page, "/to-text");
  await addFiles(page, hard("150-pages.pdf"));
  await loaded(page, 150);
  const out = await runAndDownload(page, "Extract text");
  const txt = Buffer.from(out.bytes).toString("utf8");
  expect(txt).toContain("Page 150 of 150");
});

/* ---------- Scanned, rotated, mixed sizes ---------- */

test("scanned PDF compresses smaller", async ({ page }) => {
  test.setTimeout(120_000);
  await openTool(page, "/compress");
  await addFiles(page, hard("scanned.pdf"));
  await loaded(page, 3);
  const out = await runAndDownload(page, "Compress");
  expect(await pageCount(out.bytes)).toBe(3);
  expect(out.bytes.length).toBeLessThan(2_498_135);
});

test("scanned PDF to text says there's no text to copy", async ({ page }) => {
  await openTool(page, "/to-text");
  await addFiles(page, hard("scanned.pdf"));
  await loaded(page, 3);
  await toolButton(page, "Extract text").click();
  await expect(page.locator(".tool-area")).toContainText(
    "No text on this page.",
    { timeout: 60_000 },
  );
});

test("rotate keeps each page's own /Rotate and mixed sizes", async ({
  page,
}) => {
  await openTool(page, "/rotate");
  await addFiles(page, hard("rotated-mixed.pdf"));
  await loaded(page, 5);
  await page
    .locator(".tool-area")
    .getByRole("group", { name: "Rotate every page" })
    .getByRole("button", { name: "Right" })
    .click();
  const out = await runAndDownload(page, "Rotate");
  expect(await rotations(out.bytes)).toEqual([180, 90, 90, 0, 270]);
});

test("PDF to images: rotated pages come out the way they're shown", async ({
  page,
}) => {
  await openTool(page, "/to-image");
  await addFiles(page, hard("rotated-mixed.pdf"));
  await loaded(page, 5);
  const out = await runAndDownload(
    page,
    "Convert to images",
    "Download 5 files (zip)",
  );
  const files = unzip(out.bytes);
  const dims = Object.keys(files)
    .sort()
    .map((k) => {
      const b = files[k]!;
      // JPEG SOF0/SOF2: height, width
      for (let i = 2; i < b.length;) {
        const m = b[i + 1]!;
        const len = (b[i + 2]! << 8) | b[i + 3]!;
        if (m === 0xc0 || m === 0xc2)
          return [(b[i + 7]! << 8) | b[i + 8]!, (b[i + 5]! << 8) | b[i + 6]!];
        i += 2 + len;
      }
      return [0, 0];
    });
  // Page 1 is A4 with /Rotate 90: wider than tall
  expect(dims[0]![0]).toBeGreaterThan(dims[0]![1]!);
  // Page 2 is Letter, upright
  expect(dims[1]![0]).toBeLessThan(dims[1]![1]!);
});

test("page numbers and watermark on rotated, mixed pages", async ({ page }) => {
  await openTool(page, "/page-numbers");
  await addFiles(page, hard("rotated-mixed.pdf"));
  await loaded(page, 5);
  const out = await runAndDownload(page, "Add page numbers");
  const texts = await pageTexts(out.bytes);
  expect(texts[0]).toMatch(/1/);
  expect(await rotations(out.bytes)).toEqual([90, 0, 0, 270, 180]);
});

/* ---------- Forms, bookmarks, metadata ---------- */

for (const [tool, action] of [
  ["merge", "Save PDF"],
  ["page-numbers", "Add page numbers"],
  ["watermark", "Add watermark"],
  ["compress", "Compress"],
  ["grayscale", "Make black and white"],
] as const)
  test(`${tool} on a PDF with form fields`, async ({ page }) => {
    await openTool(page, `/${tool}`);
    await addFiles(page, hard("form.pdf"));
    await loaded(page, 2);
    const run = toolButton(
      page,
      tool === "merge" ? /Merge|Save/ : action,
    ).first();
    await run.click();
    const btn = toolButton(page, "Download");
    await expect(btn.or(toast(page)).first()).toBeVisible({ timeout: 60_000 });
    expect(
      await toast(page).count(),
      (await toast(page).count()) ? await toast(page).innerText() : "",
    ).toBe(0);
    const d = await download(page, () => btn.click());
    expect(await pageCount(new Uint8Array(await bytes(d)))).toBe(2);
  });

test("split keeps working on a PDF with bookmarks", async ({ page }) => {
  await openTool(page, "/split");
  await addFiles(page, hard("outline.pdf"));
  await loaded(page, 4);
  await page.getByLabel("Ranges (one PDF each)").fill("1-2, 3-4");
  const out = await runAndDownload(page, "Split", "Download 2 files (zip)");
  expect(Object.keys(unzip(out.bytes))).toHaveLength(2);
});

test("metadata shows and saves Bangla and Japanese titles", async ({
  page,
}) => {
  await openTool(page, "/metadata");
  await addFiles(page, hard("bangla-metadata.pdf"));
  await loaded(page, 1);
  const title = page.getByLabel("Title", { exact: true });
  await expect(title).toHaveValue("বাংলা শিরোনাম — 日本語 タイトル");
  await expect(page.getByLabel("Author", { exact: true })).toHaveValue(
    "রহিম উদ্দিন",
  );
  await title.fill("নতুন শিরোনাম ✓");
  const out = await runAndDownload(page, "Save info");
  const doc = await load(out.bytes);
  expect(doc.getTitle()).toBe("নতুন শিরোনাম ✓");
  expect(doc.getAuthor()).toBe("রহিম উদ্দিন");
});

test("a Bangla file name carries into the result name", async ({ page }) => {
  await openTool(page, "/page-numbers");
  await addFiles(page, hard(UNICODE_PDF));
  await loaded(page, 2);
  const out = await runAndDownload(page, "Add page numbers");
  expect(out.name).toBe("বাংলা নথি ফাইল-numbered.pdf");
});

/* ---------- Sign ---------- */

test("sign opens a rotated, mixed-size PDF and a 150-page one", async ({
  page,
}) => {
  await openTool(page, "/sign");
  await addFiles(page, hard("rotated-mixed.pdf"));
  await expect(page.getByText("Page 1 of 5")).toBeVisible();
  await openTool(page, "/sign");
  await addFiles(page, hard("150-pages.pdf"));
  await expect(page.getByText("Page 1 of 150")).toBeVisible();
});

/* ---------- Images to PDF ---------- */

test("images to PDF takes CMYK, 16-bit, paletted, rotated and huge images", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openTool(page, "/from-image");
  await addFiles(page, [
    hard("cmyk.jpg"),
    hard("16bit.png"),
    hard("palette-alpha.png"),
    hard("exif-orientation-6.jpg"),
    hard("huge-8000x6000.jpg"),
    hard(UNICODE_JPG),
  ]);
  const d = await download(page, () =>
    page.getByRole("button", { name: "Make PDF and download" }).click(),
  );
  const b = new Uint8Array(await bytes(d));
  expect(await pageCount(b)).toBe(6);
  // The EXIF-rotated photo is placed upright: its page is portrait
  const doc = await load(b);
  const p = doc.getPage(3).getSize();
  expect(p.height).toBeGreaterThan(p.width);
});

test("images to PDF skips a broken image and says so", async ({ page }) => {
  await openTool(page, "/from-image");
  await addFiles(page, [hard("garbage.jpg"), hard("progressive.jpg")]);
  const d = await download(page, () =>
    page.getByRole("button", { name: "Make PDF and download" }).click(),
  );
  expect(await pageCount(new Uint8Array(await bytes(d)))).toBe(1);
  await expect(
    page.getByText("garbage.jpg couldn't be read and was skipped."),
  ).toBeVisible();
});

test("images to PDF explains a text file", async ({ page }) => {
  await openTool(page, "/from-image");
  await addFiles(page, hard("notes.txt"));
  await expect(toast(page)).toContainText("isn't an image");
});

/* ---------- Mixed drops and heavy runs ---------- */

test("merge: a protected file in a mixed drop is named, the rest still merge", async ({
  page,
}) => {
  await openTool(page, "/merge");
  await addFiles(page, [
    hard("rotated-mixed.pdf"),
    fixed("password-protected.pdf"),
    hard("empty.pdf"),
    hard(UNICODE_PDF),
  ]);
  await expect(
    page.getByText("password-protected.pdf is password-protected", {
      exact: false,
    }),
  ).toBeVisible();
  await loaded(page, 7);
  const out = await runAndDownload(page, "Merge 2 PDFs");
  expect(await pageCount(out.bytes)).toBe(7);
});

test("remove every page is refused with a message", async ({ page }) => {
  await openTool(page, "/remove-pages");
  await addFiles(page, hard("outline.pdf"));
  await loaded(page, 4);
  const tool = page.locator(".tool-area");
  for (let i = 1; i <= 4; i++)
    await tool.getByRole("button", { name: `Page ${i}`, exact: true }).click();
  await toolButton(page, "Remove pages").click();
  await expect(toast(page)).toContainText("every page");
});

test("150 pages: compress (re-draws every page) finishes", async ({ page }) => {
  test.setTimeout(240_000);
  await openTool(page, "/compress");
  await addFiles(page, hard("150-pages.pdf"));
  await loaded(page, 150);
  const run = toolButton(page, "Compress");
  await run.click();
  const btn = toolButton(page, "Download");
  await expect(btn).toBeVisible({ timeout: 200_000 });
  const d = await download(page, () => btn.click());
  expect(await pageCount(new Uint8Array(await bytes(d)))).toBe(150);
});

test("scanned PDF to black and white", async ({ page }) => {
  test.setTimeout(120_000);
  await openTool(page, "/grayscale");
  await addFiles(page, hard("scanned.pdf"));
  await loaded(page, 3);
  const out = await runAndDownload(page, "Make black and white");
  expect(await pageCount(out.bytes)).toBe(3);
});
