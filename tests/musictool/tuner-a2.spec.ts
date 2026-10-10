/**
 * Guitar tuner with Chromium's fake microphone playing 110 Hz: the A string (A2) lights up and
 * reads in tune; in drop D the low string is the target for a low note.
 */
import { expect, openTool, test } from "../helpers.ts";
import { fakeMic, toneWav } from "./wav.ts";

test.use(fakeMic(toneWav(110)));

test("guitar tuner hears the A string (110 Hz)", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await openTool(page, "/guitar-tuner");
  const tuner = page.locator(".tool-area .mt-tuner");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(tuner).toHaveAttribute("data-note", "A2");
  await expect(tuner).toHaveAttribute("data-state", "in-tune");
  await expect
    .poll(async () => Math.abs(Number(await tuner.getAttribute("data-cents"))))
    .toBeLessThan(2);
  await expect(page.locator(".mt-string.near")).toHaveCount(1);
  await expect(page.locator(".mt-string.near strong")).toHaveText("A");
  await expect(page.locator(".mt-string").nth(1)).toHaveClass(/near/);
});
