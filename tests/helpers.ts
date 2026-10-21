import {
  test as base,
  expect,
  type Page,
  type Download,
} from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Generated test files (tests/fixtures/make.ts writes them on every run; git-ignored). */
export const GEN = join(import.meta.dirname, "fixtures", "gen");
/**
 * Optional real photos and documents kept only on a developer's machine (git-ignored), e.g.
 * portraits for the AI tools. Tests that need them call `needLocal()` and skip without them.
 */
export const LOCAL = join(import.meta.dirname, "fixtures", "local");

export const gen = (name: string) => join(GEN, name);
export const local = (name: string) => join(LOCAL, name);
export const hasLocal = (name: string) => existsSync(local(name));

/**
 * `page` that fails the test on uncaught page errors and console errors, so a broken island or a
 * blocked request (CSP) can't pass silently. Known harmless messages can be allowed per test.
 */
/** A quick navigation and locator wait, to tell a working page from a stuck one */
async function responds(page: Page): Promise<boolean> {
  try {
    await page.goto("/robots.txt", {
      timeout: 10_000,
      waitUntil: "domcontentloaded",
    });
    await page.locator("body").waitFor({ timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export const test = base.extend<{ allowConsole: RegExp[] }>({
  allowConsole: [[], { option: true }],
  page: async ({ page: first, allowConsole, browserName }, use) => {
    // Firefox on Linux (CI) now and then gives a new page whose first navigation Playwright
    // never hears back from: the page loads and renders, but page.goto and every locator wait
    // until the test times out (the traces show the finished page). The retry, on a fresh page,
    // always works. So in Firefox each page is tried first, and swapped for a new one if stuck.
    let page = first;
    if (browserName === "firefox") {
      for (let i = 0; i < 3 && !(await responds(page)); i++) {
        const fresh = await page.context().newPage();
        await page.close().catch(() => {});
        page = fresh;
      }
    }
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (allowConsole.some((r) => r.test(text))) return;
      errors.push(`console: ${text}`);
    });
    // Each test starts in the default mode and language, with the tools' test hooks switched on
    await page.addInitScript(() => {
      (window as unknown as { kmraTest: boolean }).kmraTest = true;
      try {
        if (!sessionStorage.getItem("kmra-test-init")) {
          localStorage.clear();
          sessionStorage.setItem("kmra-test-init", "1");
        }
      } catch {}
    });
    await use(page);
    expect(errors, "page errors / console errors").toEqual([]);
  },
});
export { expect };

/**
 * Wait until every Astro island on the page has hydrated: an island drops its `ssr` attribute
 * once its component is running. Before that, events and clicks meant for it are lost.
 */
export async function hydrated(page: Page) {
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

/** Open a tool page and wait until its island has hydrated. */
export async function openTool(page: Page, path: string) {
  await page.goto(path);
  await page.locator(".tool-area").first().waitFor();
  await hydrated(page);
  // Firefox: see the page fixture (its load and network-idle signals can go missing)
  if (page.context().browser()?.browserType().name() !== "firefox")
    await page.waitForLoadState("networkidle");
}

/** Put files into the tool's file input (the same path as choosing files or dropping them). */
export async function addFiles(page: Page, files: string | string[]) {
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles(files);
}

/** Click something that downloads, and return the download (fails if none starts). */
export async function download(
  page: Page,
  click: () => Promise<unknown>,
): Promise<Download> {
  const [d] = await Promise.all([page.waitForEvent("download"), click()]);
  return d;
}

/** Bytes of a finished download. */
export async function bytes(d: Download): Promise<Buffer> {
  const stream = await d.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

/** Switch a tool page to Advanced or Simple with the header switch. */
export async function mode(page: Page, m: "simple" | "advanced") {
  await page.locator(`[data-mode=${m}]`).click();
}
