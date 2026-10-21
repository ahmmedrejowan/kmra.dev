import { test, expect, openTool } from "../helpers.ts";
import type { Page } from "@playwright/test";

// Inputs aimed at the spots code scanning flagged: markup in entity text, comments that end in
// "--!>", and strings built to make a backtracking regex hang

const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const box = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });

test("html-entities: markup stays text, legacy names decode", async ({
  page,
}) => {
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs++;
    void d.dismiss();
  });
  await openTool(page, "/html-entities");
  await btn(page, "Unescape").click();
  await box(page, "HTML").fill(
    `<img src=x onerror="alert(1)">&lt;script&gt;alert(2)&lt;/script&gt; &amp &copy2026 &notin; &#0;`,
  );
  await expect(box(page, "Unescaped")).toHaveValue(
    `<img src=x onerror="alert(1)"><script>alert(2)</script> & ©2026 ∉ �`,
  );
  await expect(page.locator(".dev-status")).toContainText("8 entities decoded");
  expect(dialogs).toBe(0);
});

test("html-formatter: minify drops comments ending in --!>", async ({
  page,
}) => {
  await openTool(page, "/html-formatter");
  await box(page, "HTML").fill(`<p>a</p><!-- one --!><p>b</p><!-- two -->`);
  await btn(page, "Minify").click();
  await expect(box(page, "Minified")).toHaveValue(`<p>a</p><p>b</p>`);
});

test("long comment and comma runs don't hang the tools", async ({ page }) => {
  const comments = "<!--" + "--><!--".repeat(20_000);
  await openTool(page, "/xml-formatter");
  const t = Date.now();
  await box(page, "XML").fill(comments + "<svg/>");
  await expect(page.locator(".dev-status")).toBeVisible();
  expect(Date.now() - t).toBeLessThan(5_000);

  await page.goto("/");
  const s = Date.now();
  await page
    .getByRole("textbox", { name: "Paste anything" })
    .fill('",' + ",".repeat(50_000) + "x");
  await expect(
    page.getByRole("textbox", { name: "Paste anything" }),
  ).not.toBeEmpty();
  expect(Date.now() - s).toBeLessThan(5_000);
});
