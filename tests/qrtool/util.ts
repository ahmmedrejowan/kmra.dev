/**
 * Helpers for the qrtool tests. Codes made by a tool are read back with the site's own batch
 * scanner (/batch-scan, zxing-wasm in the browser), so a round trip tests both sides.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Download, Page } from "@playwright/test";
import { bytes, expect } from "../helpers.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const req = createRequire(join(ROOT, "apps", "pdftool", "package.json"));
export const PDFLib = req("pdf-lib") as typeof import("pdf-lib");
const fflate = req("fflate") as typeof import("fflate");

const qrcode = createRequire(join(ROOT, "apps", "qrtool", "package.json"))(
  "qrcode",
) as typeof import("qrcode");

/** A QR code PNG made in Node (independent of the site's generator) */
export async function qrFile(
  text: string,
  name: string,
  opts: { width?: number } = {},
): Promise<FilePayload> {
  return {
    name,
    mimeType: "image/png",
    // 12 px modules and a 4-module margin by default; a width makes qrcode round module sizes
    buffer: await qrcode.toBuffer(text, {
      type: "png",
      margin: 4,
      ...(opts.width ? { width: opts.width } : { scale: 12 }),
    }),
  };
}

export const unzip = (b: Uint8Array) => fflate.unzipSync(new Uint8Array(b));

export interface FilePayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const MIME: Record<string, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
};

/** A finished download as a file to put into another tool */
export async function asFile(d: Download): Promise<FilePayload> {
  const name = d.suggestedFilename();
  return {
    name,
    mimeType: MIME[name.split(".").pop()!] ?? "application/octet-stream",
    buffer: await bytes(d),
  };
}

/** Click and return the download as a file payload */
export async function grab(
  page: Page,
  click: () => Promise<unknown>,
): Promise<FilePayload> {
  const [d] = await Promise.all([page.waitForEvent("download"), click()]);
  return asFile(d);
}

export interface Read {
  file: string;
  format: string;
  text: string;
}

/**
 * Read every code in the given files with /batch-scan. Navigates the page there; returns one row
 * per code found (images without a code are left out).
 */
export async function decode(
  page: Page,
  files: (string | FilePayload)[],
): Promise<Read[]> {
  await page.goto("/batch-scan");
  await page.locator(".tool-area").waitFor();
  await page.waitForLoadState("networkidle");
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles(files as never);
  const n = files.length;
  await expect(page.locator(".bs-card .controls .ctl .lbl")).toHaveText(
    new RegExp(`^${n} images?, \\d+ codes?$`),
    { timeout: 60_000 },
  );
  return page.locator(".bs-table tbody tr").evaluateAll((rows) =>
    rows.flatMap((r) => {
      const t = r.querySelector<HTMLElement>(".bs-text");
      if (!t) return [];
      const cells = r.querySelectorAll("td");
      return [
        {
          file: cells[0]!.textContent ?? "",
          format: cells[1]!.textContent ?? "",
          text: t.getAttribute("title") ?? "",
        },
      ];
    }),
  );
}

/** Decode one file and expect exactly one code; returns its text */
export async function decodeOne(
  page: Page,
  file: string | FilePayload,
): Promise<Read> {
  const r = await decode(page, [file]);
  expect(r, "exactly one code read back").toHaveLength(1);
  return r[0]!;
}

/** Fill a labelled field exactly */
export const field = (page: Page, label: string) =>
  page.locator(".tool-area").getByLabel(label, { exact: true });
