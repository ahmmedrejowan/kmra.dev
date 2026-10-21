/**
 * Screenshots for the README, taken from the built sites with generated sample files only
 * (no third-party images). Skipped in normal runs; to refresh them:
 *
 *   pnpm build && SHOTS=1 npx playwright test -c tests/playwright.config.ts tests/kmra/readme-shots.spec.ts
 */
import type { Page } from "@playwright/test";
import { test, gen } from "../helpers.ts";

test.skip(!process.env.SHOTS, "set SHOTS=1 to take the README screenshots");
test.use({
  viewport: { width: 1440, height: 900 },
  colorScheme: "light",
  allowConsole: [/./],
});
test.describe.configure({ mode: "parallel", timeout: 120_000 });

const PORT = {
  kmra: 4607,
  imgtool: 4601,
  pdftool: 4602,
  qrtool: 4603,
  devtool: 4604,
  ocrtool: 4605,
  vidtool: 4606,
  audiotool: 4608,
  calctool: 4609,
  colortool: 4610,
  musictool: 4611,
} as const;
const at = (app: keyof typeof PORT, path = "/") =>
  `http://localhost:${PORT[app]}${path}`;

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem("kmra-mode", "simple");
    localStorage.setItem("kmra-theme", "light");
  });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}
const add = (page: Page, files: string | string[]) =>
  page.locator("main input[type=file]").first().setInputFiles(files);
async function shoot(page: Page, name: string, scrollTo?: string) {
  // The tool just below the sticky header
  if (scrollTo)
    await page
      .locator(scrollTo)
      .first()
      .evaluate((e) =>
        scrollTo(0, e.getBoundingClientRect().top + scrollY - 88),
      );
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: `docs/images/screens/${name}.jpg`,
    type: "jpeg",
    quality: 82,
  });
}

test("hub", async ({ page }) => {
  await open(page, at("kmra"));
  await shoot(page, "01-hub");
});

test("image editor", async ({ page }) => {
  await open(page, at("imgtool", "/watermark"));
  await add(page, gen("photo.jpg"));
  await page
    .locator(".controls .result")
    .getByRole("button", { name: "Download" })
    .waitFor();
  await page.evaluate(() => window.dispatchEvent(new Event("kmra:advanced")));
  const ws = page.locator(".ws");
  await ws
    .getByRole("navigation", { name: "Tools" })
    .getByRole("button", { name: "Filters", exact: true })
    .click();
  await ws.locator(".ws-tool").getByRole("button", { name: "Warm" }).click();
  await page.waitForFunction(
    () => !document.querySelector(".ws .result.working"),
  );
  await shoot(page, "02-image-editor");
});

test("image compress", async ({ page }) => {
  await open(page, at("imgtool", "/compress"));
  await add(page, gen("photo.jpg"));
  await page.getByRole("button", { name: "Under 200 KB" }).click();
  await page.waitForFunction(
    () => !document.querySelector(".controls .result.working"),
  );
  await shoot(page, "03-image-compress", ".toolcard");
});

test("pdf merge", async ({ page }) => {
  await open(page, at("pdftool", "/merge"));
  await add(page, [gen("text6.pdf"), gen("landscape2.pdf")]);
  await page.waitForTimeout(2500);
  await shoot(page, "04-pdf-merge", ".tool-area");
});

test("video compress", async ({ page }) => {
  await open(page, at("vidtool", "/compress"));
  await add(page, gen("vid-landscape.mp4"));
  await page.waitForTimeout(3000);
  await shoot(page, "05-video-compress", ".tool-area");
});

test("audio trim", async ({ page }) => {
  await open(page, at("audiotool", "/trim"));
  await add(page, gen("aud-tone.mp3"));
  await page.waitForTimeout(3000);
  await shoot(page, "06-audio-trim", ".tool-area");
});

test("qr generator", async ({ page }) => {
  await open(page, at("qrtool", "/generator"));
  await page.waitForTimeout(1500);
  await shoot(page, "07-qr-generator", ".tool-area");
});

test("ocr", async ({ page }) => {
  await open(page, at("ocrtool", "/image-to-text"));
  await add(page, gen("ocr-doc.png"));
  await page.waitForTimeout(12000);
  await shoot(page, "08-ocr", ".tool-area");
});

test("json formatter", async ({ page }) => {
  await open(page, at("devtool", "/json-formatter"));
  const json = JSON.stringify({
    site: "kmra.dev",
    tools: 154,
    runs: "in your browser",
    sites: [
      "imgtool",
      "pdftool",
      "vidtool",
      "audiotool",
      "qrtool",
      "ocrtool",
      "devtool",
      "calctool",
      "colortool",
      "musictool",
    ],
    upload: false,
  });
  await page.locator("main textarea").first().fill(json);
  await page.waitForTimeout(1200);
  await shoot(page, "09-json-formatter", ".tool-area");
});

test("scientific calculator", async ({ page }) => {
  await open(page, at("calctool", "/scientific-calculator"));
  await shoot(page, "10-calculator", ".tool-area");
});

test("palette", async ({ page }) => {
  await open(page, at("colortool", "/palette-generator"));
  await shoot(page, "11-palette", ".tool-area");
});

test("beat maker", async ({ page }) => {
  await open(page, at("musictool", "/beat-maker"));
  await shoot(page, "12-beat-maker", ".tool-area");
});

test("bangla", async ({ page }) => {
  await open(page, at("kmra", "/bn"));
  await shoot(page, "13-bangla");
});
