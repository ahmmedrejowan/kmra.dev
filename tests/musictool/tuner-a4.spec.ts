/**
 * Tuner end to end with Chromium's fake microphone playing a 440 Hz tone: A4, about 0 cents,
 * "in tune"; then Stop releases the microphone. Its own file: the fake mic is a launch option.
 */
import { expect, openTool, test } from "../helpers.ts";
import { fakeMic, toneWav } from "./wav.ts";

test.use(fakeMic(toneWav(440)));

test("hears A4 at 440 Hz and shows it in tune", async ({ page, context }) => {
  await context.grantPermissions(["microphone"]);
  await openTool(page, "/tuner");
  const tuner = page.locator(".tool-area .mt-tuner");
  await expect(tuner).toHaveAttribute("data-state", "idle");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(tuner).toHaveAttribute("data-note", "A4");
  await expect
    .poll(async () => Math.abs(Number(await tuner.getAttribute("data-cents"))))
    .toBeLessThan(2);
  await expect(tuner).toHaveAttribute("data-state", "in-tune");
  await expect(page.locator(".mt-tuner-advice")).toHaveText("In tune");
  expect(Math.abs(Number(await tuner.getAttribute("data-freq")) - 440)).toBeLessThan(0.6);
  await expect(page.locator(".mt-tuner-name")).toHaveText("A");

  // A4 = 442 Hz: the same tone now reads flat
  await page.getByLabel("Reference pitch A4").fill("442");
  await page.getByLabel("Reference pitch A4").press("Enter");
  await expect
    .poll(async () => Number(await tuner.getAttribute("data-cents")))
    .toBeLessThan(-5);
  await expect(tuner).toHaveAttribute("data-state", "flat");

  await page.getByRole("button", { name: "Stop" }).click();
  await expect(tuner).toHaveAttribute("data-state", "idle");
  // The microphone is released
  expect(
    await page.evaluate(() =>
      (window as unknown as { kmraMusic: { mic: MediaStream } }).kmraMusic.mic
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
});
