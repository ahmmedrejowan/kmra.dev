/**
 * Helpers for the hard-input tests: wait for whatever a tool does with a difficult file (a result
 * or a clear message) and fail on silence, stuck spinners and requests to other hosts.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "../helpers.ts";

export {
  hard,
  fixed,
  QR_TEXT,
  UNICODE_JPG,
  UNICODE_PNG,
  UNICODE_PDF,
} from "../fixtures/hard.ts";

/** The status message (toast) at the bottom of the screen. */
export const toast = (page: Page) => page.locator(".toast").last();

/**
 * Wait for the first of several outcomes and say which one happened. Fails when none shows up in
 * time (stuck or silent).
 */
export async function outcome<K extends string>(
  page: Page,
  options: Record<K, string>,
  timeout = 60_000,
): Promise<{ kind: K; text: string }> {
  const kinds = Object.keys(options) as K[];
  const any = page.locator(kinds.map((k) => options[k]).join(", ")).first();
  await any.waitFor({ state: "visible", timeout });
  for (const k of kinds) {
    const l = page.locator(options[k]).first();
    if (await l.isVisible())
      return { kind: k, text: (await l.innerText()).trim() };
  }
  return { kind: kinds[0]!, text: "" };
}

/** Record every request that leaves the page's own origin. */
export function offsite(page: Page): string[] {
  const out: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["http:", "https:"].includes(u.protocol)) return;
    if (u.hostname !== "localhost") out.push(r.url());
  });
  return out;
}

/** Bangla script: a message in Bangla has at least a few of these letters. */
export const BANGLA = /[ঀ-৿]{2,}/;

export async function noSpinner(page: Page, sel: string) {
  await expect(page.locator(sel)).toHaveCount(0, { timeout: 60_000 });
}

const fflate = createRequire(
  join(import.meta.dirname, "..", "..", "apps", "imgtool", "package.json"),
)("fflate") as typeof import("fflate");
/** Files inside a zip, by name */
export const unzip = (b: Uint8Array) => fflate.unzipSync(new Uint8Array(b));
