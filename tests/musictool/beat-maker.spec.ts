/**
 * The beat maker in the browser: the real schedule (steps on time, swing, live edits), drawing
 * and undo, lengths and pages, mute/solo heard in the export, WAV and MP3 downloads checked
 * byte by byte, the link, the saved beat, keyboard, use-case presets and Bangla.
 */
import type { Page } from "@playwright/test";
import { bytes, download, expect, openTool, test } from "../helpers.ts";

const area = (page: Page) => page.locator(".tool-area");
const btn = (page: Page, name: string | RegExp) =>
  area(page).getByRole("button", { name, exact: typeof name === "string" }).first();
const cell = (page: Page, drum: string, step: number) =>
  area(page).locator(`.mt-cell[data-drum="${drum}"][data-step="${step}"]`);
const row = (page: Page, drum: string) =>
  area(page)
    .locator(`.mt-cell[data-drum="${drum}"]`)
    .evaluateAll((c) => c.map((x) => Number(x.getAttribute("data-v"))));

interface Step {
  time: number;
  step: number;
  drums: [string, number][];
}
const log = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { kmraMusic: { beats: { log: Step[] } } }).kmraMusic.beats.log.map((s) => ({
      ...s,
      drums: s.drums.map((d) => [...d]),
    })),
  ) as Promise<Step[]>;

/** Samples of a 16-bit stereo WAV as [left, right] floats */
function pcm(buf: Buffer) {
  expect(buf.subarray(0, 4).toString()).toBe("RIFF");
  expect(buf.subarray(8, 12).toString()).toBe("WAVE");
  const n = buf.readUInt32LE(40) / 4;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = buf.readInt16LE(44 + i * 4) / 32768;
    R[i] = buf.readInt16LE(46 + i * 4) / 32768;
  }
  return { L, R, rate: buf.readUInt32LE(24), channels: buf.readUInt16LE(22) };
}
const energy = (x: Float32Array, from: number, to: number) => {
  let e = 0;
  for (let i = Math.max(0, from); i < Math.min(x.length, to); i++) e += x[i]! * x[i]!;
  return e;
};

/** A fresh page with an empty grid (storage cleared, so the default beat loads, then Clear) */
async function fresh(page: Page, path = "/beat-maker") {
  await openTool(page, path);
  await page.evaluate(() => localStorage.clear());
  await openTool(page, path);
}

test("beat maker: plays the starter beat on time, with swing on the off-beats", async ({ page }) => {
  await fresh(page);
  // The hip-hop starter: 90 BPM, 40% swing
  await expect(area(page).getByRole("button", { name: "Hip-hop" })).toHaveAttribute("aria-pressed", "true");
  await expect(area(page).locator(".mt-beat-bpm")).toHaveAttribute("data-value", "90");
  await btn(page, "Play").click();
  await expect(area(page).locator(".mt-cell.now").first()).toBeVisible();
  await page.waitForTimeout(1700);
  const steps = await log(page);
  await btn(page, "Stop").click();
  await expect(area(page).locator(".mt-cell.now")).toHaveCount(0);
  expect(steps.length).toBeGreaterThanOrEqual(8);
  const len = 60 / 90 / 4;
  const swing = ((0.4 * len) / 3);
  // Even steps on the grid, odd steps late by the swing
  const t0 = steps[0]!.time;
  expect(steps[0]!.step).toBe(0);
  for (const s of steps) {
    const k = steps.indexOf(s);
    expect(s.step).toBe(k % 16);
    expect(s.time - t0).toBeCloseTo(k * len + (k % 2 ? swing : 0), 6);
  }
  const at = (i: number) => steps[i]!.drums.map(([d]) => d).sort();
  expect(at(0)).toEqual(["hat", "kick"]);
  expect(at(4)).toEqual(["hat", "snare"]);
  expect(at(1)).toEqual([]);
  // Accent on the downbeat kick
  expect(steps[0]!.drums.find(([d]) => d === "kick")![1]).toBe(2);
});

test("beat maker: edits while playing are heard on the next pass", async ({ page }) => {
  await fresh(page);
  await btn(page, "Clear").click();
  await btn(page, "Play").click();
  await page.waitForTimeout(300);
  await cell(page, "clap", 12).click();
  await page.waitForTimeout(2600);
  const steps = await log(page);
  await btn(page, "Stop").click();
  const claps = steps.filter((s) => s.drums.some(([d]) => d === "clap"));
  expect(claps.length).toBeGreaterThanOrEqual(1);
  expect(claps.every((s) => s.step === 12)).toBe(true);
});

test("beat maker: draw, drag, accents, undo, redo, clear and lengths", async ({ page }) => {
  await fresh(page);
  await btn(page, "Clear").click();
  expect(await row(page, "kick")).toEqual(Array(16).fill(0));
  await cell(page, "kick", 0).click();
  await expect(cell(page, "kick", 0)).toHaveAttribute("aria-pressed", "true");
  await expect(cell(page, "kick", 0)).toHaveAttribute("aria-label", "Kick, step 1: on");
  // Drag across four hi-hat steps paints them all
  const a = (await cell(page, "hat", 0).boundingBox())!;
  const b = (await cell(page, "hat", 3).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  expect((await row(page, "hat")).slice(0, 5)).toEqual([1, 1, 1, 1, 0]);
  // A drag that starts on a lit step erases
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x - 4, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  expect((await row(page, "hat")).slice(0, 4)).toEqual([0, 0, 0, 1]);
  // Undo takes back the whole stroke, redo puts it back
  await btn(page, "Undo").click();
  expect((await row(page, "hat")).slice(0, 4)).toEqual([1, 1, 1, 1]);
  await btn(page, "Redo").click();
  expect((await row(page, "hat")).slice(0, 4)).toEqual([0, 0, 0, 1]);
  // Accent mode
  await area(page).getByRole("group", { name: "New steps" }).getByRole("button", { name: "Accent" }).click();
  await cell(page, "snare", 4).click();
  await expect(cell(page, "snare", 4)).toHaveAttribute("data-v", "2");
  // Two bars: the bar repeats and is shown a page at a time
  await area(page).getByRole("group", { name: "Length" }).getByRole("button", { name: "2 bars" }).click();
  await expect(area(page).getByRole("button", { name: "Steps 17–32" })).toBeVisible();
  await area(page).getByRole("button", { name: "Steps 17–32" }).click();
  await expect(cell(page, "snare", 20)).toHaveAttribute("data-v", "2");
  await expect(cell(page, "kick", 16)).toHaveAttribute("data-v", "1");
  // 3/4: twelve steps on one page
  await area(page).getByRole("group", { name: "Length" }).getByRole("button", { name: "3/4 bar" }).click();
  await expect(area(page).locator('.mt-cell[data-drum="kick"]')).toHaveCount(12);
  await expect(area(page).locator(".mt-beat-pages")).toHaveCount(0);
  // Keyboard: Ctrl+Z goes back to two bars
  await page.locator("body").press("Control+z");
  await expect(area(page).locator('.mt-cell[data-drum="kick"]')).toHaveCount(16);
  await btn(page, "Clear").click();
  expect((await row(page, "snare")).every((v) => v === 0)).toBe(true);
  await expect(btn(page, "Download WAV")).toBeDisabled();
});

test("beat maker: downloads a WAV that loops exactly, with mute and solo applied", async ({ page }) => {
  await fresh(page, "/rock-drum-beat");
  await area(page).getByRole("group", { name: "Times through the loop" }).getByRole("button", { name: "1", exact: true }).click();
  await expect(area(page).getByText("2.2 seconds. The file loops without a gap.")).toBeVisible();
  const full = pcm(await bytes(await download(page, () => btn(page, "Download WAV").click())));
  expect(full.rate).toBe(44100);
  expect(full.channels).toBe(2);
  // 110 BPM, 16 sixteenths
  expect(full.L.length).toBe(Math.round((16 * 60) / 110 / 4 * 44100));
  const stepAt = (i: number) => Math.round((i * 60) / 110 / 4 * 44100);
  // Kick and hat on step 0, snare on step 4
  expect(energy(full.L, 0, 2000)).toBeGreaterThan(5);
  expect(energy(full.L, stepAt(4), stepAt(4) + 2000)).toBeGreaterThan(5);
  // Solo the snare: the downbeat (kick and hat only) goes quiet, the snare stays
  await btn(page, "Solo Snare").click();
  const solo = pcm(await bytes(await download(page, () => btn(page, "Download WAV").click())));
  expect(energy(solo.L, 0, 1500)).toBeLessThan(energy(full.L, 0, 1500) / 50);
  expect(energy(solo.L, stepAt(4), stepAt(4) + 2000)).toBeGreaterThan(5);
  // Mute the snare as well as soloing it: solo wins, as on a mixer
  await btn(page, "Mute Snare").click();
  const both = pcm(await bytes(await download(page, () => btn(page, "Download WAV").click())));
  expect(energy(both.L, stepAt(4), stepAt(4) + 2000)).toBeGreaterThan(5);
});

test("beat maker: downloads an MP3", async ({ page }) => {
  await fresh(page);
  await area(page).getByRole("group", { name: "File" }).getByRole("button", { name: "MP3" }).click();
  const d = await download(page, () => btn(page, "Download MP3").click());
  expect(d.suggestedFilename()).toBe("beat-90bpm-kmra.mp3");
  const b = await bytes(d);
  // An ID3 tag or straight into MPEG frames (sync word 0xFFE)
  const id3 = b.subarray(0, 3).toString() === "ID3";
  let at = 0;
  if (id3) at = 10 + ((b[6]! << 21) | (b[7]! << 14) | (b[8]! << 7) | b[9]!);
  expect(b[at]).toBe(0xff);
  expect(b[at + 1]! & 0xe0).toBe(0xe0);
  // 4 loops of 90 BPM = 10.7 s at 192 kbps ≈ 256 KB
  expect(b.length).toBeGreaterThan(150_000);
  expect(b.length).toBeLessThan(400_000);
});

test("beat maker: a link carries the beat, and it's kept after a reload", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fresh(page);
  await btn(page, "Clear").click();
  await cell(page, "tomLow", 6).click();
  await btn(page, "Faster").click();
  await btn(page, "Copy link").click();
  await expect(area(page).locator("p[role=status]")).toHaveText("Link copied. Anyone who opens it hears this beat.");
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/beat-maker#bpm=91&swing=40&steps=16&tomLow=0000001000000000$/);
  // Saved on this device
  await page.reload();
  await area(page).locator(".mt-cell").first().waitFor();
  await expect(cell(page, "tomLow", 6)).toHaveAttribute("data-v", "1");
  await expect(area(page).locator(".mt-beat-bpm")).toHaveAttribute("data-value", "91");
  // Someone else opening the link
  await page.evaluate(() => localStorage.clear());
  await page.goto("about:blank");
  await openTool(page, "/beat-maker#bpm=123&swing=0&steps=16&kick=2000200020002000");
  await expect(area(page).locator(".mt-beat-bpm")).toHaveAttribute("data-value", "123");
  expect(await row(page, "kick")).toEqual([2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0]);
  expect((await row(page, "hat")).every((v) => v === 0)).toBe(true);
});

test("beat maker: keyboard plays, changes the tempo and toggles a focused step", async ({ page }) => {
  await fresh(page);
  await page.locator("body").press("ArrowUp");
  await page.locator("body").press("Shift+ArrowUp");
  await expect(area(page).locator(".mt-beat-bpm")).toHaveAttribute("data-value", "101");
  await page.locator("body").press("Space");
  await expect(btn(page, "Stop")).toBeVisible();
  await page.locator("body").press("Space");
  await expect(btn(page, "Play")).toBeVisible();
  const c = cell(page, "rim", 3);
  await c.focus();
  await page.keyboard.press("Enter");
  await expect(c).toHaveAttribute("data-v", "1");
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-v", "0");
  // Space on a focused step toggles it and doesn't start playback
  await expect(btn(page, "Play")).toBeVisible();
});

test("beat maker: phones show eight steps at a time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await fresh(page);
  await expect(area(page).locator('.mt-cell[data-drum="kick"]')).toHaveCount(8);
  await area(page).getByRole("button", { name: "Steps 9–16" }).click();
  await expect(cell(page, "kick", 10)).toHaveAttribute("data-v", "2");
  // No sideways scrolling
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("beat maker in Bangla", async ({ page }) => {
  await fresh(page, "/bn/beat-maker");
  await expect(page.locator("h1")).toHaveText("বিট মেকার: অনলাইন ড্রাম মেশিন");
  await expect(btn(page, "চালান")).toBeVisible();
  await expect(area(page).locator(".mt-beat-bpm output")).toHaveText("৯০");
  await expect(area(page).getByRole("group", { name: "শুরুর প্যাটার্ন" })).toBeVisible();
  await expect(cell(page, "kick", 0)).toHaveAttribute("aria-label", "কিক, স্টেপ ১: অ্যাকসেন্ট");
});
