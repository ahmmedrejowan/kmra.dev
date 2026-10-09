/**
 * VidTool in Google Chrome (not the bundled Chromium): Chrome has the platform AAC and H.264
 * encoders, so compress-to-target re-encodes the sound on the hardware path there. Some AAC
 * bitrates (64 kbps among them) made Chrome's GPU process crash on macOS and took the tab with
 * it; the engine test-encodes the rate first and picks one that works. Skips without Chrome.
 */
import { existsSync } from "node:fs";
import { addFiles, expect, gen, openTool, test } from "../helpers.ts";
import { VID } from "../fixtures/vidtool.ts";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/opt/google/chrome/chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].some((p) => existsSync(p));

test.use({ channel: "chrome" });
test.describe.configure({ timeout: 120_000 });
test.beforeEach(() => test.skip(!CHROME, "needs Google Chrome"));

// 6 s at 1280×720: 0.5 MB asked for 64 kbps sound, 1.5 MB 96 kbps; 0.3 MB is below the
// smallest target, so it aims for 0.5 MB and says so
for (const mb of ["0.5", "0.3", "1.5"])
  test(`compress to ${mb} MB on the hardware engine in Chrome`, async ({
    page,
  }) => {
    let crashed = false;
    page.on("crash", () => (crashed = true));
    await openTool(page, "/compress?engine=webcodecs");
    await addFiles(page, gen(VID.landscape));
    await page
      .locator(".vt-ws .seg button", { hasText: "Target size" })
      .first()
      .click();
    await page.locator("#vt-mb").fill(mb);
    const aim = Math.max(0.5, Number(mb));
    if (aim > Number(mb))
      await expect(page.locator(".vt-target .note")).toContainText(
        "The smallest target is 0.5 MB.",
      );
    await expect(page.locator(".vt-target label span")).toContainText(
      aim < 1 ? "KB" : "MB",
    );
    await expect(page.locator(".vt-plan")).toContainText("Hardware (fast)");
    await page.locator(".vt-run").click();
    const res = page.locator(".vt-result");
    await expect(res).toBeVisible({ timeout: 60_000 });
    expect(crashed).toBe(false);
    expect(await res.getAttribute("data-engine")).toBe("webcodecs");
    expect(Number(await res.getAttribute("data-bytes"))).toBeLessThanOrEqual(
      aim * 1_000_000,
    );
  });
