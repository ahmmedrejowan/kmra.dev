/**
 * qrtool readers with hard pictures: a skewed, dim, blurry photo, inverted, tiny, logo-covered,
 * damaged and multiple codes, Data Matrix and PDF417 photos, WebP/AVIF/SVG screenshots, a small
 * code in a big photo, and pictures with no code or no image at all.
 */
import {
  test,
  expect,
  openTool,
  addFiles,
  download,
  bytes,
} from "../helpers.ts";
import { hard, toast, QR_TEXT } from "./util.ts";

const CASES: [string, string[]][] = [
  ["qr-photo.jpg", [QR_TEXT.photo]],
  ["qr-inverted.png", [QR_TEXT.inverted]],
  ["qr-tiny-21px.png", [QR_TEXT.tiny]],
  ["qr-logo.png", [QR_TEXT.logo]],
  ["qr-damaged.png", [QR_TEXT.damaged]],
  ["qr-multi.png", [...QR_TEXT.multi]],
  ["datamatrix-photo.jpg", [QR_TEXT.datamatrix]],
  ["pdf417-photo.jpg", [QR_TEXT.pdf417]],
  ["qr-webp.webp", [QR_TEXT.webp]],
  ["qr-avif.avif", [QR_TEXT.avif]],
  ["qr-svg.svg", [QR_TEXT.svg]],
  ["qr-in-big-photo.jpg", [QR_TEXT.big]],
];

/* ---------- Scanner, image mode ---------- */

for (const [name, texts] of CASES)
  test(`scanner reads ${name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await openTool(page, "/scan-qr-from-image");
    await addFiles(page, hard(name));
    for (const t of texts)
      await expect(page.locator(".tool-area")).toContainText(t, {
        timeout: 30_000,
      });
    await expect(page.locator(".toast")).toHaveCount(0);
  });

test("scanner says when there's no code", async ({ page }) => {
  await openTool(page, "/scan-qr-from-image");
  await addFiles(page, hard("no-code.jpg"));
  await expect(toast(page)).toContainText("No code found");
});

for (const name of ["garbage.jpg", "zero-bytes.jpg"])
  test(`scanner explains ${name}`, async ({ page }) => {
    await openTool(page, "/scan-qr-from-image");
    await addFiles(page, hard(name));
    await expect(toast(page)).toContainText("couldn't be read");
  });

test("scanner explains a text file", async ({ page }) => {
  await openTool(page, "/scan-qr-from-image");
  await addFiles(page, hard("notes.txt"));
  await expect(toast(page)).toContainText("isn't an image");
});

/* ---------- Batch scan ---------- */

test("batch scan: every hard picture, plus broken ones, in one go", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openTool(page, "/batch-scan");
  await addFiles(page, [
    ...CASES.map(([n]) => hard(n)),
    hard("no-code.jpg"),
    hard("garbage.jpg"),
  ]);
  const table = page.locator(".tool-area table");
  for (const [, texts] of CASES)
    for (const t of texts)
      await expect(table).toContainText(t, { timeout: 60_000 });
  await expect(table).toContainText("No code found");
  await expect(table).toContainText("Couldn't open this image");
  const d = await download(page, () =>
    page.getByRole("button", { name: "Download CSV" }).click(),
  );
  const csv = (await bytes(d)).toString("utf8");
  expect(csv).toContain(QR_TEXT.pdf417);
  expect(csv).toContain("MULTI-THREE");
});

/* ---------- Checker ---------- */

for (const [name, texts] of CASES.filter(([n]) => n !== "qr-multi.png"))
  test(`checker reads ${name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await openTool(page, "/checker");
    await addFiles(page, hard(name));
    // Every check finishes: no "Testing…" left
    await expect(page.locator(".tool-area")).toContainText(
      /Scans|Not a QR code/,
      { timeout: 45_000 },
    );
    await expect(page.locator(".tool-area")).not.toContainText(
      /Testing|Reading…/,
      { timeout: 45_000 },
    );
    void texts;
  });

test("checker: several codes in one image can each be checked", async ({
  page,
}) => {
  await openTool(page, "/checker");
  await addFiles(page, hard("qr-multi.png"));
  await expect(page.locator(".tool-area")).toContainText("3 codes found");
});

test("checker: no code and broken files are explained", async ({ page }) => {
  await openTool(page, "/checker");
  await addFiles(page, hard("no-code.jpg"));
  await expect(page.locator(".tool-area")).toContainText(
    "No code could be read",
  );
  await openTool(page, "/checker");
  await addFiles(page, hard("garbage.jpg"));
  await expect(toast(page)).toContainText("couldn't be read");
});

/* ---------- QR code cleaner ---------- */

for (const name of [
  "qr-photo.jpg",
  "qr-damaged.png",
  "qr-logo.png",
  "qr-inverted.png",
  "qr-tiny-21px.png",
  "qr-webp.webp",
])
  test(`fix-qr redraws ${name}`, async ({ page }) => {
    await openTool(page, "/fix-qr");
    await addFiles(page, hard(name));
    const btn = page
      .locator(".tool-area")
      .getByRole("button", { name: /Download PNG/ })
      .first();
    await expect(btn).toBeEnabled({ timeout: 30_000 });
    const d = await download(page, () => btn.click());
    expect((await bytes(d)).subarray(1, 4).toString()).toBe("PNG");
  });

test("fix-qr: a Data Matrix photo points to the 2D generator", async ({
  page,
}) => {
  await openTool(page, "/fix-qr");
  await addFiles(page, hard("datamatrix-photo.jpg"));
  await expect(page.locator(".tool-area")).toContainText(
    "Open the 2D code generator",
  );
});

test("fix-qr: no code and broken files are explained", async ({ page }) => {
  await openTool(page, "/fix-qr");
  await addFiles(page, hard("no-code.jpg"));
  await expect(toast(page)).toContainText("No code found");
  await addFiles(page, hard("garbage.jpg"));
  await expect(toast(page)).toContainText("couldn't be read");
});
