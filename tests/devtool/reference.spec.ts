import { test, expect, openTool } from "../helpers.ts";
import type { Page } from "@playwright/test";

const box = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });
const row = (page: Page, id: string) =>
  page.locator(`[data-row="${id}"] .dev-row-val`);
const runs = (page: Page) =>
  page
    .locator(".cron-runs li[data-iso]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-iso")!));

test("cron: working-hours expression, monthly, and an invalid field", async ({
  page,
}) => {
  await openTool(page, "/cron-explainer");
  await page.getByRole("combobox", { name: "Time zone" }).selectOption("UTC");
  const input = box(page, "Cron expression");
  await input.fill("*/15 9-17 * * 1-5");
  await expect(page.locator(".cron-say")).toHaveText(
    "At every 15th minute past every hour from 9 through 17 on Monday through Friday.",
  );
  await expect(page.locator(".cron-runs li[data-iso]")).toHaveCount(10);
  for (const iso of await runs(page)) {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):00Z$/.exec(iso);
    expect(m, iso).not.toBeNull();
    const [y, mo, d, h, mi] = m!.slice(1).map(Number) as number[];
    const wd = new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDay();
    expect(wd, iso).toBeGreaterThanOrEqual(1);
    expect(wd, iso).toBeLessThanOrEqual(5);
    expect(h, iso).toBeGreaterThanOrEqual(9);
    expect(h, iso).toBeLessThanOrEqual(17);
    expect([0, 15, 30, 45]).toContain(mi);
  }
  // The breakdown names each field
  await expect(page.locator('tr[data-field="hour"]')).toContainText(
    "every hour from 9 through 17",
  );

  await input.fill("0 0 1 * *");
  await expect(page.locator(".cron-say")).toHaveText(
    "At 00:00 on day 1 of the month.",
  );
  for (const iso of await runs(page))
    expect(iso).toMatch(/^\d{4}-\d\d-01T00:00:00Z$/);

  await input.fill("61 * * * *");
  await expect(page.getByRole("alert")).toContainText(
    "Minute: 61 is out of range (0–59)",
  );
  await expect(page.locator('tr[data-field="minute"]')).toHaveClass(/bad/);
  await expect(page.locator(".cron-runs")).toHaveCount(0);

  await input.fill("* * * *");
  await expect(page.getByRole("alert")).toContainText("Found 4");
});

test("cron: next runs follow daylight saving in the chosen zone", async ({
  page,
}) => {
  // London, clocks go back on 25 October 2026: 01:30 happens twice and runs once
  await page.clock.setFixedTime(new Date("2026-10-23T12:00:00Z"));
  await openTool(page, "/cron-explainer");
  await page
    .getByRole("combobox", { name: "Time zone" })
    .selectOption("Europe/London");
  await box(page, "Cron expression").fill("30 1 * * *");
  await expect(page.locator(".cron-runs li[data-iso]").first()).toHaveAttribute(
    "data-iso",
    "2026-10-24T01:30:00+01:00",
  );
  expect((await runs(page)).slice(0, 3)).toEqual([
    "2026-10-24T01:30:00+01:00",
    "2026-10-25T01:30:00+01:00",
    "2026-10-26T01:30:00+00:00",
  ]);
  await expect(page.locator(".cron-runs li.shift")).toHaveCount(1);

  // New York, clocks go back on 1 November 2026: 09:00 stays 09:00 local
  await page
    .getByRole("combobox", { name: "Time zone" })
    .selectOption("America/New_York");
  await box(page, "Cron expression").fill("0 9 * * *");
  await expect(page.locator(".cron-runs li[data-iso]").first()).toHaveAttribute(
    "data-iso",
    "2026-10-23T09:00:00-04:00",
  );
  const ny = await runs(page);
  expect(ny).toContain("2026-10-31T09:00:00-04:00");
  expect(ny).toContain("2026-11-01T09:00:00-05:00");
});

test("cron: a time skipped when the clocks go forward", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-03-27T12:00:00Z"));
  await openTool(page, "/cron-explainer");
  await page
    .getByRole("combobox", { name: "Time zone" })
    .selectOption("Europe/London");
  await box(page, "Cron expression").fill("30 1 * * *");
  await expect(page.locator(".cron-runs li[data-iso]").first()).toHaveAttribute(
    "data-iso",
    "2026-03-28T01:30:00+00:00",
  );
  expect((await runs(page)).slice(0, 2)).toEqual([
    "2026-03-28T01:30:00+00:00",
    "2026-03-30T01:30:00+01:00",
  ]);
  await expect(page.locator(".cron-skip")).toContainText("skipped");
});

test("chmod: octal, symbolic and chmod rules both ways", async ({ page }) => {
  await openTool(page, "/chmod-calculator");
  const mode = box(page, "Mode");
  await mode.fill("755");
  await expect(row(page, "symbolic")).toHaveText("rwxr-xr-x");
  await expect(row(page, "cmd-octal")).toHaveText("chmod 755 file");
  await expect(row(page, "cmd-symbolic")).toHaveText(
    "chmod u=rwx,g=rx,o=rx file",
  );

  await mode.fill("rwxr-xr-x");
  await expect(row(page, "octal")).toHaveText("755");
  await mode.fill("-rw-r--r--");
  await expect(row(page, "octal")).toHaveText("644");

  await mode.fill("4755");
  await expect(row(page, "symbolic")).toHaveText("rwsr-xr-x");
  await mode.fill("1777");
  await expect(row(page, "symbolic")).toHaveText("rwxrwxrwt");

  await mode.fill("u=rw,go=r");
  await expect(row(page, "octal")).toHaveText("644");

  // Ticking a box rewrites the mode
  await page.getByRole("checkbox", { name: "Group: Write" }).check();
  await expect(mode).toHaveValue("664");
  await expect(row(page, "symbolic")).toHaveText("rw-rw-r--");

  await mode.fill("789");
  await expect(page.getByRole("alert")).toContainText("0 to 7");
});

test("url-parser: duplicate keys, live rebuild, IDN host", async ({ page }) => {
  await openTool(page, "/url-parser");
  const url = box(page, "URL");
  await url.fill("https://example.com/shop/items?a=1&b=2&a=3#top");
  const keys = page.locator(".url-q-row td:first-child input");
  await expect(keys).toHaveCount(3);
  expect(
    await keys.evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value),
    ),
  ).toEqual(["a", "b", "a"]);
  await expect(page.locator("#url-hostname")).toHaveValue("example.com");
  await expect(page.locator("#url-pathname")).toHaveValue("/shop/items");
  await expect(page.locator(".url-segs code")).toHaveText(["shop", "items"]);

  // Editing a value rebuilds the URL, keeping order and the other duplicate
  await box(page, "Value 2").fill("x y");
  await expect(url).toHaveValue(
    "https://example.com/shop/items?a=1&b=x+y&a=3#top",
  );
  await page.getByRole("button", { name: "Remove parameter 1" }).click();
  await expect(url).toHaveValue("https://example.com/shop/items?b=x+y&a=3#top");
  await page.getByRole("button", { name: "Add a parameter" }).click();
  await expect(url).toHaveValue(
    "https://example.com/shop/items?b=x+y&a=3&key=#top",
  );

  // Default port, then an international domain name in both forms
  await expect(page.locator('[data-part="port"]')).toContainText("443");
  await url.fill("https://bücher.example/");
  await expect(page.locator("#url-hostname")).toHaveValue(
    "xn--bcher-kva.example",
  );
  await expect(page.locator('[data-part="hostname-unicode"]')).toHaveText(
    "bücher.example",
  );

  // Credentials: warned about, password hidden until asked
  await url.fill("https://admin:s3cret@example.com/");
  await expect(page.getByRole("note")).toContainText("password");
  await expect(page.locator("#url-password")).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page.locator("#url-password")).toHaveAttribute("type", "text");
  await expect(page.locator("#url-password")).toHaveValue("s3cret");

  await url.fill("not a url");
  await expect(page.getByRole("alert")).toContainText("needs a scheme");
});

test("http-status: search and deep link", async ({ page }) => {
  await openTool(page, "/http-status");
  await page
    .getByRole("searchbox", { name: "Search status codes" })
    .fill("teapot");
  await expect(page.locator(".http-item[data-code]")).toHaveCount(1);
  await expect(page.locator('.http-item[data-code="418"]')).toBeVisible();
  await expect(page.locator('[data-detail="418"]')).toContainText(
    "I'm a teapot",
  );
  await expect(page.locator('[data-detail="418"]')).toContainText(
    "Non-standard",
  );

  await page.getByRole("searchbox", { name: "Search status codes" }).fill("50");
  await expect(page.locator(".http-item[data-code]")).toHaveCount(10);

  await openTool(page, "/http-status#404");
  await expect(page.locator('[data-detail="404"]')).toContainText("Not Found");
  await expect(page.locator('.http-item[data-code="404"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('.http-item[data-code="503"]').click();
  await expect(page).toHaveURL(/#503$/);
  await expect(page.locator('[data-detail="503"]')).toContainText(
    "Service Unavailable",
  );
});
