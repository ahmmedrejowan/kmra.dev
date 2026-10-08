/**
 * Playwright global setup: writes the generated test files into tests/fixtures/gen/ (git-ignored),
 * so the repo carries no third-party images or documents. Add new generated files here.
 */
import { mkdir } from "node:fs/promises";
import { GEN } from "../helpers.ts";
import { makeImgtoolFixtures } from "./imgtool.ts";
import { makeDocFixtures } from "./docs.ts";
import makeHard from "./hard.ts";
import { makeDevtoolFixtures } from "./devtool.ts";

export default async function make() {
  await mkdir(GEN, { recursive: true });
  // imgtool inputs (photos, transparent PNG, SVG, EXIF JPEG, signature, GIF): see imgtool.ts
  await makeImgtoolFixtures(GEN);
  // pdftool and qrtool inputs (text, landscape and heavy PDFs, pictures, QR codes): see docs.ts
  await makeDocFixtures(GEN);
  // hard inputs for tests/hard (huge, damaged, odd formats, code photos): see hard.ts
  await makeHard();
  // devtool inputs (an Excel workbook): see devtool.ts
  await makeDevtoolFixtures(GEN);
}
