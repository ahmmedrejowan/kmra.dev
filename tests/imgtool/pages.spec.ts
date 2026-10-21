/** The editor workspace, the homepage drop box and a Bangla tool page. */
import { test, expect, gen, download, bytes } from "../helpers.ts";
import { info, unzip, save, start } from "./lib.ts";

test("editor: two files, PNG output, one zip", async ({ page }) => {
  await page.goto("/editor");
  const ws = page.getByRole("dialog", { name: "Advanced workspace" });
  await expect(ws).toBeVisible();
  await page
    .locator("main input[type=file]")
    .first()
    .setInputFiles([gen("photo.jpg"), gen("small.jpg")]);
  await expect(ws).toContainText("2 photos");
  // Sections start closed until opened or switched on
  await ws.locator("#ws-format .ed-head").click();
  await ws
    .getByRole("group", { name: "Output format" })
    .getByRole("button", { name: "PNG" })
    .click();
  await expect(ws).toContainText(/1600 × 1200, PNG/);
  const d = await download(page, () =>
    ws.getByRole("button", { name: "Zip of 2" }).click(),
  );
  expect(d.suggestedFilename()).toBe("images-edit-kmra.zip");
  const files = unzip(await bytes(d));
  expect(files.map((f) => f.name).sort()).toEqual([
    "photo-edit-kmra.png",
    "small-edit-kmra.png",
  ]);
  expect(files.map((f) => info(f.data)).sort((a, b) => b.w - a.w)).toEqual([
    { type: "png", w: 1600, h: 1200 },
    { type: "png", w: 640, h: 480 },
  ]);
});

test("editor: per-file download from the queue", async ({ page }) => {
  await page.goto("/editor");
  const ws = page.getByRole("dialog", { name: "Advanced workspace" });
  await page
    .locator("main input[type=file]")
    .first()
    .setInputFiles([gen("photo.jpg"), gen("small.jpg")]);
  await ws.locator("#ws-resize").getByRole("button", { name: "Add" }).click();
  await ws.getByRole("button", { name: "50%" }).click();
  await expect(ws).toContainText(/800 × 600, JPEG/);
  const d = await download(page, () =>
    ws.getByRole("button", { name: "Download small.jpg" }).click(),
  );
  expect(d.suggestedFilename()).toBe("small-edit-kmra.jpg");
  expect(info(await bytes(d))).toEqual({ type: "jpeg", w: 320, h: 240 });
});

test("homepage drop box hands the file to the editor", async ({ page }) => {
  await page.goto("/");
  await page
    .locator("main input[type=file]")
    .first()
    .setInputFiles(gen("photo.jpg"));
  await page.waitForURL(/\/editor$/);
  const ws = page.getByRole("dialog", { name: "Advanced workspace" });
  await expect(ws).toContainText("1 photo");
  await expect(ws.getByRole("button", { name: /^photo\.jpg/ })).toBeVisible();
  await expect(ws).toContainText(/1600 × 1200, JPEG/);
  const d = await download(page, () =>
    ws.getByRole("button", { name: "Download", exact: true }).click(),
  );
  expect(info(await bytes(d))).toEqual({ type: "jpeg", w: 1600, h: 1200 });
});

test("Bangla compress page renders in Bangla and works", async ({ page }) => {
  await start(page, "/bn/compress", gen("photo.jpg"));
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/[ঀ-৿]/);
  await expect(page.getByRole("img", { name: "আসল: photo.jpg" })).toBeVisible();
  const { d, b } = await save(page, { summary: /থেকে/, button: "ডাউনলোড" });
  expect(d.suggestedFilename()).toBe("photo-compress-kmra.jpg");
  expect(info(b)).toEqual({ type: "jpeg", w: 1600, h: 1200 });
  // Links stay in Bangla
  await expect(
    page.locator(".tool-area").getByRole("link", { name: /১০০ কেবি করুন/ }),
  ).toHaveAttribute("href", "/bn/compress-to-100kb");
});

test("Bangla compress page: quality and size labels are translated", async ({
  page,
}) => {
  await start(page, "/bn/compress", gen("photo.jpg"));
  await expect(page.getByRole("slider", { name: /^মান/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /৫০ কেবির নিচে|50 KB-এর নিচে/ }),
  ).toBeVisible();
});
