/**
 * OCRTool photo engine (PaddleOCR PP-OCRv5 on onnxruntime-web), driven through the real Image to
 * text tool: an app screenshot (coloured buttons, small grey text, a dark panel) and a phone
 * photo of a printed page (rotated, perspective, blur, JPEG). Each image is read by both engines;
 * the photo engine must find ≥ 90% of the words and at least as many as the document engine.
 * Word recall and timings are printed for the report.
 */
import type { Page } from "@playwright/test";
import { addFiles, expect, gen, openTool, test } from "../helpers.ts";
import {
  PAGE_TEXT,
  SCREENSHOT_TEXT,
  wordRecall,
} from "../fixtures/ocrtool-photo.ts";

test.describe.configure({ timeout: 240_000 });

const text = (page: Page) => page.locator(".oi-text textarea");

type Engine = "document" | "photo";
const BUTTON: Record<Engine, string> = {
  document: "Document",
  photo: "Photo and screenshot",
};
const DONE: Record<Engine, string> = {
  document: "Read with the document engine",
  photo: "Read with the photo engine",
};

/** Pick an engine and wait until the picture has been read with it; returns text and seconds */
async function readWith(page: Page, engine: Engine) {
  const t0 = Date.now();
  await page
    .getByRole("group", { name: "Engine" })
    .getByRole("button", { name: BUTTON[engine], exact: true })
    .click();
  await expect(page.getByText(DONE[engine])).toBeVisible({ timeout: 200_000 });
  await expect(page.locator(".dev-status")).toContainText(/Confidence \d+%/, {
    timeout: 200_000,
  });
  return { text: await text(page).inputValue(), s: (Date.now() - t0) / 1000 };
}

/** Every request the page makes stays on this site */
function requests(page: Page) {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  return urls;
}

for (const [name, file, expected] of [
  ["app screenshot", "ocr-screenshot.png", SCREENSHOT_TEXT],
  ["phone photo of a page", "ocr-page-photo.jpg", PAGE_TEXT],
] as const) {
  test(`photo engine reads an ${name} better than the document engine`, async ({
    page,
    baseURL,
  }) => {
    const urls = requests(page);
    await openTool(page, "/image-to-text");
    await page
      .getByRole("group", { name: "Engine" })
      .getByRole("button", { name: BUTTON.document, exact: true })
      .click();
    await addFiles(page, gen(file));
    const doc = await readWith(page, "document");
    // First read: downloads the photo engine; second: models already running
    const photo = await readWith(page, "photo");
    await readWith(page, "document");
    const again = await readWith(page, "photo");

    const docRecall = wordRecall(expected, doc.text);
    const photoRecall = wordRecall(expected, photo.text);
    console.log(
      `[photo engine] ${file}: word recall photo ${(photoRecall * 100).toFixed(1)}% ` +
        `vs document ${(docRecall * 100).toFixed(1)}%; photo ${photo.s.toFixed(1)} s first ` +
        `(download + start), ${again.s.toFixed(1)} s warm; document ${doc.s.toFixed(1)} s`,
    );
    expect(photoRecall).toBeGreaterThanOrEqual(0.9);
    expect(photoRecall).toBeGreaterThanOrEqual(docRecall);
    expect(again.text).toBe(photo.text);

    // Models come from this site's /models, nothing from anywhere else
    expect(urls.some((u) => u.includes("/models/ppocrv5-det.onnx"))).toBe(true);
    expect(
      urls.filter((u) => !u.startsWith(baseURL!) && !/^(blob|data):/.test(u)),
    ).toEqual([]);
  });
}

test("photo engine boxes are in image pixels, words included", async ({
  page,
}) => {
  await openTool(page, "/image-to-text");
  await addFiles(page, gen("ocr-screenshot.png"));
  await readWith(page, "photo");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const json = JSON.parse(await text(page).inputValue()) as {
    engine: string;
    width: number;
    height: number;
    lines: {
      text: string;
      box: { x: number; y: number; w: number; h: number };
      words: {
        text: string;
        box: { x: number; y: number; w: number; h: number };
      }[];
    }[];
  };
  expect(json.engine).toBe("photo");
  expect([json.width, json.height]).toEqual([1280, 800]);
  const words = json.lines.flatMap((l) => l.words);
  const find = (t: string) => words.find((w) => w.text === t);
  // "Publish now" is drawn at x 262, middle y 336, 15 px bold; "Pending" at x 560, y 628
  for (const [t, x, y] of [
    ["Publish", 262, 336],
    ["Pending", 560, 628],
    ["Northwind", 32, 40],
  ] as const) {
    const w = find(t);
    expect(w, t).toBeTruthy();
    expect(Math.abs(w!.box.x - x), `${t} left edge`).toBeLessThan(15);
    expect(w!.box.y, `${t} top`).toBeLessThan(y);
    expect(w!.box.y + w!.box.h, `${t} bottom`).toBeGreaterThan(y);
    expect(w!.box.h, `${t} height`).toBeLessThan(45);
  }
  // Lines keep their words together
  const plain = json.lines.map((l) => l.text);
  expect(plain).toContain("Quarterly report for October");
});
