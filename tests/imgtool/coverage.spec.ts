/**
 * Every imgtool tool and task page from the registry loads and hydrates without errors, and every
 * ready tool has a smoke test (add new tools to TESTED once their test exists).
 */
import { getApp } from "../../packages/registry/src/index.ts";
import { test, expect, openTool } from "../helpers.ts";

const app = getApp("imgtool");

/** Tools with a smoke test in this folder. */
const TESTED = new Set([
  // basics.spec.ts
  "compress",
  "resize",
  "convert",
  "strip-metadata",
  "form-size",
  "crop",
  "rotate",
  // effects.spec.ts
  "adjust",
  "filters",
  "add-text",
  "watermark",
  "border",
  "extend-canvas",
  "beautify",
  "blur",
  "signature",
  // ai.spec.ts
  "remove-bg",
  "change-bg",
  "passport-photo",
  "face-blur",
  // standalone.spec.ts
  "collage",
  "split",
  "image-info",
  "exif",
  "histogram",
  "palette",
  "color-picker",
  "favicon",
  "base64",
  "gif-frames",
]);

test("every ready tool has a smoke test", () => {
  const ready = app.tools.filter((t) => t.ready).map((t) => t.slug);
  expect(ready.filter((s) => !TESTED.has(s))).toEqual([]);
});

for (const page of [...app.tools.filter((t) => t.ready), ...app.tasks]) {
  test(`/${page.slug} loads`, async ({ page: p }) => {
    await openTool(p, `/${page.slug}`);
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      p.locator(".tool-area input[type=file]").first(),
    ).toBeAttached();
  });
}
