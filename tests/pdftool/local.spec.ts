/**
 * Real-world PDFs kept only on a developer's machine (tests/fixtures/local, git-ignored).
 * Skipped when the file isn't there.
 */
import {
  test,
  expect,
  openTool,
  addFiles,
  local,
  hasLocal,
} from "../helpers.ts";
import { loaded, pageCount, pageTexts, runAndDownload, unzip } from "./util.ts";

const TRACE = "tracemonkey.pdf";

test.describe("tracemonkey.pdf (14 pages, real fonts)", () => {
  test.skip(!hasLocal(TRACE), `needs tests/fixtures/local/${TRACE}`);

  test("to-text reads the paper's title", async ({ page }) => {
    await openTool(page, "/to-text");
    await addFiles(page, local(TRACE));
    await loaded(page, 14);
    const out = await runAndDownload(page, "Extract text");
    const txt = Buffer.from(out.bytes).toString("utf8");
    expect(txt).toMatch(/Trace-based Just-in-Time Type Specialization/);
    expect(txt.split("\f")).toHaveLength(14);
  });

  test("split-every-page makes 14 one-page PDFs", async ({ page }) => {
    await openTool(page, "/split-every-page");
    await addFiles(page, local(TRACE));
    await loaded(page, 14);
    const out = await runAndDownload(page, "Split", "Download 14 files (zip)");
    const files = Object.values(unzip(out.bytes));
    expect(files).toHaveLength(14);
    for (const f of files) expect(await pageCount(f)).toBe(1);
  });

  test("page numbers on a real paper", async ({ page }) => {
    await openTool(page, "/page-numbers");
    await addFiles(page, local(TRACE));
    await loaded(page, 14);
    const out = await runAndDownload(page, "Add page numbers");
    const texts = await pageTexts(out.bytes);
    expect(texts).toHaveLength(14);
    expect(texts[13]).toContain("Page 14 of 14");
  });
});
