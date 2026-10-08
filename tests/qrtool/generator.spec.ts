import { test, expect, openTool, download, bytes } from "../helpers.ts";

test("generator makes a PNG for a link", async ({ page }) => {
  await openTool(page, "/generator");
  await page.getByLabel("Link").fill("https://kmra.dev");
  const d = await download(page, () =>
    page.getByRole("button", { name: "Download PNG" }).click(),
  );
  expect(d.suggestedFilename()).toMatch(/\.png$/);
  const b = await bytes(d);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
});
