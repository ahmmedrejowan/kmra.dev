/**
 * Edge cases in the qrtool tools: unreadable files among good ones, results that belong to one
 * mode, lines too long for a code, style hidden in Simple mode, and download names.
 */
import { test, expect, openTool, addFiles, gen } from "../helpers.ts";
import { QR_LINK, QR_TEXT } from "../fixtures/docs.ts";
import { decodeOne, field, grab, qrFile, unzip } from "./util.ts";

/** Not an image at all, named like one */
const BROKEN = {
  name: "broken.png",
  mimeType: "image/png",
  buffer: Buffer.from("this is not a picture"),
};

const fileInput = (page: import("@playwright/test").Page) =>
  page.locator(".tool-area input[type=file]").first();

test("scanner: an unreadable image among good ones keeps the good codes", async ({
  page,
}) => {
  await openTool(page, "/scan-qr-from-image");
  await fileInput(page).setInputFiles([
    BROKEN,
    await qrFile(QR_LINK, "link.png"),
    await qrFile(QR_TEXT, "text.png"),
  ]);
  const res = page.locator(".tool-area .scan-results");
  await expect(res.getByText("2 codes found")).toBeVisible();
  await expect(page.getByText("Couldn't read broken.png.")).toBeVisible();
  // The first readable image is shown, with its code outlined
  await expect(page.locator(".scan-view img")).toBeVisible();
  await expect(page.locator(".scan-view svg polygon")).toHaveCount(1);
});

test("scanner: a failed image clears the last one, and modes don't share results", async ({
  page,
}) => {
  await openTool(page, "/scan-qr-from-image");
  await addFiles(page, gen("qr-link.png"));
  const res = page.locator(".tool-area .scan-results");
  await expect(res.getByText("1 code found")).toBeVisible();

  // Switching to the camera and back starts empty
  const modes = page.getByRole("group", { name: "Scan from" });
  await modes.getByRole("button", { name: "Camera" }).click();
  await expect(page.getByText("Code read. Scan another?")).toHaveCount(0);
  await expect(res.locator(".scan-result")).toHaveCount(0);
  await modes.getByRole("button", { name: "Image or screenshot" }).click();
  await expect(page.locator(".scan-view")).toHaveCount(0);

  await addFiles(page, gen("qr-link.png"));
  await expect(res.getByText("1 code found")).toBeVisible();
  await fileInput(page).setInputFiles(BROKEN);
  await expect(page.getByText("That image couldn't be read.")).toBeVisible();
  await expect(res.locator(".scan-result")).toHaveCount(0);
  await expect(page.getByText("Drop an image with a code")).toBeVisible();
});

test("checker: a failed image goes back to the drop box and names the file", async ({
  page,
}) => {
  await openTool(page, "/checker");
  await addFiles(page, gen("qr-link.png"));
  await expect(page.locator(".tool-area .qc-content")).toHaveText(QR_LINK);
  await fileInput(page).setInputFiles(BROKEN);
  await expect(page.getByText("broken.png couldn't be read.")).toBeVisible();
  await expect(
    page.getByText("Drop your QR code design or photo"),
  ).toBeVisible();
  await expect(page.locator(".tool-area .qc-content")).toHaveCount(0);
});

test("batch-scan: one image can be taken off the list", async ({ page }) => {
  await openTool(page, "/batch-scan");
  await addFiles(page, [gen("qr-link.png"), gen("photo-wide.png")]);
  const card = page.locator(".bs-card");
  await expect(card.locator(".controls .lbl")).toHaveText("2 images, 1 code");
  await card.getByRole("button", { name: "Remove photo-wide.png" }).click();
  await expect(card.locator(".bs-table tbody tr")).toHaveCount(1);
  await expect(card.locator(".controls .lbl")).toHaveText("1 image, 1 code");
  await expect(card.getByText("1 image without a code")).toHaveCount(0);
  await page.getByLabel("Only images without a code").check();
  await expect(card.getByText("Every image had a code.")).toBeVisible();
});

test("bulk: lines too long aren't counted, and none at all means no zip", async ({
  page,
}) => {
  await openTool(page, "/bulk");
  const input = field(page, "One link or text per line");
  const long = "x".repeat(4000);
  await input.fill(`${long}\nhttps://kmra.dev`);
  await expect(
    page.getByText("1 line is too long for a QR code and will be skipped."),
  ).toBeVisible();
  const zip = await grab(page, () =>
    page.getByRole("button", { name: "Download 1 as zip" }).click(),
  );
  expect(Object.keys(unzip(zip.buffer))).toEqual(["002-kmra.dev-kmra.png"]);

  await input.fill(`${long}\n${long}y`);
  await expect(
    page.getByText("2 lines are too long for a QR code and will be skipped."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download 0 as zip" }),
  ).toBeDisabled();

  // The warning goes with the text
  await input.fill("https://kmra.dev");
  await expect(page.getByText(/too long for a QR code/)).toHaveCount(0);
});

test("bulk: names that differ only in case get their own files", async ({
  page,
}) => {
  await openTool(page, "/bulk");
  await field(page, "One link or text per line").fill(
    "Menu | https://example.com/a\nmenu | https://example.com/b",
  );
  await expect(page.locator(".bulk-grid figcaption")).toHaveText([
    "Menu",
    "menu-2",
  ]);
  const zip = await grab(page, () =>
    page.getByRole("button", { name: "Download 2 as zip" }).click(),
  );
  expect(Object.keys(unzip(zip.buffer)).sort()).toEqual([
    "Menu-kmra.png",
    "menu-2-kmra.png",
  ]);
});

test("generator: style from Advanced is listed in Simple mode and can be reset", async ({
  page,
}) => {
  await openTool(page, "/generator");
  await page
    .getByRole("group", { name: "Dots" })
    .getByRole("button", { name: "Rounded" })
    .click();
  await page.getByRole("button", { name: "Fewer options" }).click();
  const applied = page.locator(".qr-applied");
  await expect(applied).toContainText("Also applied from Advanced");
  await expect(
    applied.getByRole("button", { name: "Remove Dots: Rounded" }),
  ).toBeVisible();
  await applied.getByRole("button", { name: "Reset style" }).click();
  await expect(applied).toHaveCount(0);
  await page
    .getByRole("button", { name: "Style, logo and more in Advanced" })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Dots" })
      .getByRole("button", { name: "Square" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("fix-qr: the download is named after the opened file", async ({
  page,
}) => {
  await openTool(page, "/fix-qr");
  await fileInput(page).setInputFiles(await qrFile(QR_TEXT, "poster.png"));
  await expect(page.locator(".tool-area .qc-content")).toHaveText(QR_TEXT);
  const png = await grab(page, () =>
    page.getByRole("button", { name: "Download PNG" }).click(),
  );
  expect(png.name).toBe("poster-fix-qr-kmra.png");
  expect((await decodeOne(page, png)).text).toBe(QR_TEXT);
});
