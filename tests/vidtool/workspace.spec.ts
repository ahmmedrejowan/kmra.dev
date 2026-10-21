/**
 * VidTool workspace behaviour shared by every tool: output names (no doubled kmra tag, unique in
 * a batch), downloads for a batch whose selected file failed, removing files (the selection stays
 * put; single-file tools go back to the drop box), and tools that have nothing to do for a file
 * (no sound to remove, no picture to change).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  addFiles,
  bytes,
  download,
  expect,
  gen,
  openTool,
  test,
} from "../helpers.ts";
import { AUD } from "../fixtures/audiotool.ts";
import { VID } from "../fixtures/vidtool.ts";

test.describe.configure({ timeout: 240_000 });

const hasFfmpeg = (() => {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
test.beforeEach(() => test.skip(!hasFfmpeg, "needs the generated clips"));

/** Files given by name and bytes (renamed fixtures, a broken file) */
type Payload = { name: string; mimeType: string; buffer: Buffer };
const put = (page: Page, files: Payload[]) =>
  page.locator(".tool-area input[type=file]").first().setInputFiles(files);
const as = (name: string, fixture: string): Payload => ({
  name,
  mimeType: "video/mp4",
  buffer: readFileSync(gen(fixture)),
});

/** A file that isn't a video at all, named like one */
const broken = {
  name: "broken.mp4",
  mimeType: "video/mp4",
  buffer: Buffer.from("this is not a video, just some text in a file"),
};

test("a file from an earlier tool drops its kmra tag: clip-trim-mute", async ({
  page,
}) => {
  await openTool(page, "/mute");
  await put(page, [as("vid-landscape-trim-kmra.mp4", VID.landscape)]);
  await expect(page.locator(".vt-plan")).toBeVisible({ timeout: 60_000 });
  await page.locator(".vt-run").click();
  await expect(page.locator(".vt-result")).toBeVisible({ timeout: 120_000 });
  const d = await download(page, () => page.locator(".vt-download").click());
  expect(d.suggestedFilename()).toBe("vid-landscape-trim-mute-kmra.mp4");
  expect((await bytes(d)).subarray(4, 8).toString()).toBe("ftyp");
});

test.describe("a batch with a broken file", () => {
  // The engine reports the broken file in the console; that's expected here
  test.use({
    allowConsole: [
      /video engine stopped|moov atom not found|Invalid data|ERR_FILE_NOT_FOUND/,
    ],
  });
  test("a batch: unique names, zip shown while a failed file is selected, remove keeps the selection", async ({
    page,
  }) => {
    await openTool(page, "/convert");
    // clip.mov and clip.mkv both become clip-convert.mp4: the second gets -2
    await put(page, [
      { ...as("vid-clip.mov", VID.mov), mimeType: "video/quicktime" },
      { ...as("vid-clip.mkv", VID.mkv), mimeType: "video/x-matroska" },
      broken,
    ]);
    const files = page.locator(".vt-files li");
    await expect(files).toHaveCount(3);
    await expect(page.locator(".vt-run")).toContainText("2 videos", {
      timeout: 60_000,
    });
    await page.locator(".vt-run").click();
    await expect(page.locator(".vt-zip")).toBeVisible({ timeout: 180_000 });

    const second = await download(page, () =>
      page
        .getByRole("button", { name: "Download vid-clip-convert-2.mp4" })
        .click(),
    );
    expect(second.suggestedFilename()).toBe("vid-clip-convert-2-kmra.mp4");
    expect((await bytes(second)).subarray(4, 8).toString()).toBe("ftyp");

    // Select the file that couldn't be read: the batch downloads stay
    await page.locator(".vt-file", { hasText: "broken.mp4" }).click();
    // Unreadable or unprocessable: either way it says so
    await expect(page.locator("[role=alert]").first()).toContainText(
      /couldn't be (read|processed)/,
    );
    await expect(page.locator(".vt-zip")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Download each file" }),
    ).toBeVisible();
    const z = await download(page, () => page.locator(".vt-zip").click());
    expect(z.suggestedFilename()).toMatch(/\.zip$/);
    const zip = join(mkdtempSync(join(tmpdir(), "vidtool-ws-")), "all.zip");
    writeFileSync(zip, await bytes(z));
    const listing = execFileSync("unzip", ["-Z1", zip]).toString();
    expect(listing.trim().split("\n").sort()).toEqual([
      "vid-clip-convert-2-kmra.mp4",
      "vid-clip-convert-kmra.mp4",
    ]);

    // Removing another file keeps the failed one selected
    await page.getByRole("button", { name: "Remove vid-clip.mov" }).click();
    await expect(files).toHaveCount(2);
    await expect(page.locator(".vt-file[aria-pressed=true]")).toContainText(
      "broken.mp4",
    );
    // Removing the selected one moves to its neighbour
    await page.getByRole("button", { name: "Remove broken.mp4" }).click();
    await expect(page.locator(".vt-file[aria-pressed=true]")).toContainText(
      "vid-clip.mkv",
    );
  });
});

test("single-file tools can remove their file and go back to the drop box", async ({
  page,
}) => {
  for (const path of ["/trim", "/video-to-gif"]) {
    await openTool(page, path);
    await addFiles(page, gen(VID.landscape));
    await expect(page.locator(".vt-details dl")).toBeVisible({
      timeout: 60_000,
    });
    await page
      .getByRole("button", { name: "Remove vid-landscape.mp4" })
      .click();
    await expect(page.locator(".toolcard.solo"), path).toBeVisible();
    await expect(page.locator(".vt-details"), path).toHaveCount(0);
  }
});

test("nothing to do: mute on a silent video, speed on a sound file", async ({
  page,
}) => {
  await openTool(page, "/mute");
  await addFiles(page, gen(VID.webm));
  await expect(page.locator(".vt-wait")).toHaveText(
    "This video has no sound already.",
    { timeout: 60_000 },
  );
  await expect(page.locator(".vt-run")).toBeDisabled();

  await openTool(page, "/speed");
  await addFiles(page, gen(AUD.mp3));
  await expect(page.locator(".vt-wait")).toHaveText(
    "This file has no video to change.",
    { timeout: 60_000 },
  );
  await expect(page.locator(".vt-run")).toBeDisabled();
});
