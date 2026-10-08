import { test, expect, openTool, download, bytes } from "../helpers.ts";

const status = (page: import("@playwright/test").Page) =>
  page.locator(".dev-status");

test("diff-checker: counts, inline view, next change and the unified patch", async ({
  page,
}) => {
  await openTool(page, "/diff-checker");
  await page
    .getByRole("textbox", { name: "Original" })
    .fill("alpha\nbeta\ngamma\ndelta\n");
  await page
    .getByRole("textbox", { name: "Changed" })
    .fill("alpha\nbeta two\ngamma\nepsilon\nzeta\n");
  await expect(status(page)).toContainText("3 lines added");
  await expect(status(page)).toContainText("2 lines removed");
  // Side by side: the changed word is marked inside the paired lines
  await expect(page.locator(".diff-side .dl.add mark").first()).toHaveText(
    "two",
  );
  await expect(page.getByText("2 changes")).toBeVisible();
  await page.getByRole("button", { name: "Next change" }).click();
  await expect(page.getByText("Change 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next change" }).click();
  await expect(page.locator(".diff-row.cur .dl.del")).toHaveText("delta");

  await page.getByRole("button", { name: "Inline" }).click();
  await expect(page.locator(".diff-inline .dl.del")).toHaveCount(2);
  await expect(page.locator(".diff-inline .dl.add")).toHaveCount(3);

  const d = await download(page, () =>
    page.locator(".diff-out").getByRole("button", { name: "Download" }).click(),
  );
  expect(d.suggestedFilename()).toBe("changes.patch");
  expect((await bytes(d)).toString()).toBe(
    [
      "--- original",
      "+++ changed",
      "@@ -1,4 +1,5 @@",
      " alpha",
      "-beta",
      "+beta two",
      " gamma",
      "-delta",
      "+epsilon",
      "+zeta",
      "",
    ].join("\n"),
  );

  // Ignore case and whitespace
  await page.getByRole("textbox", { name: "Original" }).fill("Hello  World");
  await page.getByRole("textbox", { name: "Changed" }).fill("hello world");
  await expect(status(page)).toContainText("1 line added");
  await page.getByLabel("Ignore case").check();
  await page.getByLabel("Ignore whitespace").check();
  await expect(
    page.getByText("No differences with these settings."),
  ).toBeVisible();
});

test("diff-checker: JSON mode ignores key order and flags bad JSON", async ({
  page,
}) => {
  await openTool(page, "/diff-checker");
  await page.getByLabel("Compare as JSON").check();
  await page
    .getByRole("textbox", { name: "Original" })
    .fill('{"b":2,"a":{"y":1,"x":[1,2]}}');
  await page
    .getByRole("textbox", { name: "Changed" })
    .fill('{"a":{"x":[1,2],"y":1},"b":2}');
  await expect(
    page.getByText("No differences with these settings."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Changed" })
    .fill('{"a":{"x":[1,2],"y":1},"b":3}');
  await expect(status(page)).toContainText("1 line added");
  await expect(status(page)).toContainText("1 line removed");
  await expect(page.locator(".diff-side .dl.add")).toHaveText('"b": 3');
  await page.getByRole("textbox", { name: "Changed" }).fill('{"a":1,}');
  await expect(page.getByRole("alert")).toContainText("trailing comma");
});

test("regex-tester: matches, groups, replace and named groups", async ({
  page,
}) => {
  await openTool(page, "/regex-tester");
  await page.getByRole("textbox", { name: "Pattern" }).fill(String.raw`(\d+)`);
  await page.getByRole("textbox", { name: "Test text" }).fill("a1b22");
  await expect(status(page)).toContainText("2 matches");
  const items = page.locator(".rx-matches > li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0).locator(".rx-val")).toHaveText("1");
  await expect(items.nth(1).locator(".rx-val")).toHaveText("22");
  await expect(items.nth(1).locator(".rx-groups dd code")).toHaveText("22");
  await expect(items.nth(1).locator(".rx-at").first()).toHaveText("index 3–5");
  // Both matches are highlighted over the text
  await expect(page.locator(".rx-back mark")).toHaveText(["1", "22"]);

  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await page.getByRole("textbox", { name: "Replace with" }).fill("[$1]");
  await expect(page.locator(".rx-out")).toHaveText("a[1]b[22]");

  await page
    .getByRole("textbox", { name: "Pattern" })
    .fill(String.raw`(?<num>\d+)`);
  await page.getByRole("textbox", { name: "Replace with" }).fill("<$<num>>");
  await expect(page.locator(".rx-out")).toHaveText("a<1>b<22>");
  await page.getByRole("button", { name: "Matches", exact: true }).click();
  await expect(page.locator(".rx-name").first()).toHaveText("<num>");

  // Explanation names the group and the quantifier
  await page.getByRole("button", { name: "Explanation" }).click();
  await expect(page.locator(".rx-explain")).toContainText(
    "Start of group 1, named “num”",
  );
  await expect(page.locator(".rx-explain")).toContainText(
    "A digit (0–9), one or more times",
  );

  // A broken pattern says why
  await page.getByRole("textbox", { name: "Pattern" }).fill("(a");
  await expect(page.getByRole("alert")).toContainText("isn't valid");
});

test("regex-tester: catastrophic backtracking stops without freezing the page", async ({
  page,
}) => {
  await openTool(page, "/regex-tester");
  await page
    .getByRole("textbox", { name: "Test text" })
    .fill("a".repeat(30) + "b");
  await page.getByRole("textbox", { name: "Pattern" }).fill("(a+)+$");
  await expect(
    page.getByText("Stopped: the pattern took too long"),
  ).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("alert")).toContainText(
    "took longer than a second",
  );
  // The page still responds and a new pattern runs in a fresh worker
  await page.getByRole("textbox", { name: "Pattern" }).fill("a");
  await expect(status(page)).toContainText("30 matches");
});

test("line-tools: sort, dedupe, trim and counts", async ({ page }) => {
  await openTool(page, "/line-tools");
  const input = page.getByRole("textbox", { name: "Text" });
  await input.fill(
    "banana\nApple\ncherry\napple\n\n  banana  \nitem 10\nitem 2\n",
  );
  const out = page.getByRole("textbox", { name: "Result" });
  await page.getByLabel("Trim each line").check();
  await page.getByLabel("Remove empty lines").check();
  await page.getByLabel("Remove duplicates").check();
  await expect(out).toHaveValue(
    "banana\nApple\ncherry\napple\nitem 10\nitem 2",
  );
  await page.getByLabel("Ignore case").check();
  await expect(out).toHaveValue("banana\nApple\ncherry\nitem 10\nitem 2");
  await page.getByRole("button", { name: "Natural" }).click();
  await expect(out).toHaveValue("Apple\nbanana\ncherry\nitem 2\nitem 10");
  await page.getByRole("button", { name: "Z–A" }).click();
  await expect(out).toHaveValue("item 2\nitem 10\ncherry\nbanana\nApple");
  await expect(status(page)).toContainText("2 duplicates removed");
  await page.getByRole("textbox", { name: "Join with" }).fill(", ");
  await expect(out).toHaveValue("item 2, item 10, cherry, banana, Apple");

  await input.fill("Hello world. How are you?\n\nA second paragraph here!");
  const count = (k: string) => page.locator(`[data-count="${k}"]`);
  await expect(count("words")).toHaveText("9 words");
  await expect(count("chars")).toHaveText("51 characters");
  await expect(count("nospace")).toHaveText("42 without spaces");
  await expect(count("lines")).toHaveText("3 lines");
  await expect(count("sentences")).toHaveText("3 sentences");
  await expect(count("paragraphs")).toHaveText("2 paragraphs");
  await expect(count("read")).toHaveText("Under a minute to read");
});

test("slug-generator: accents, dashes and options", async ({ page }) => {
  await openTool(page, "/slug-generator");
  await page
    .getByRole("textbox", { name: "Titles" })
    .fill("Héllo Wörld — 2026!\nStraße & Crème brûlée\nThe Quick Brown Fox");
  const out = page.getByRole("textbox", { name: "Slugs" });
  await expect(out).toHaveValue(
    "hello-world-2026\nstrasse-and-creme-brulee\nthe-quick-brown-fox",
  );
  await page.getByRole("button", { name: "Underscore _" }).click();
  await page.getByLabel("Remove stop words").check();
  await page.getByRole("spinbutton", { name: "Max length" }).fill("12");
  await expect(out).toHaveValue("hello_world\nstrasse\nquick_brown");
});

test("fake-data: JSON rows, seeded output, CSV and SQL", async ({ page }) => {
  await openTool(page, "/fake-data");
  const out = page.getByRole("textbox", { name: "Data", exact: true });
  await page.getByRole("spinbutton", { name: "Rows" }).fill("50");
  await expect(out).not.toHaveValue("");
  const rows = JSON.parse(await out.inputValue()) as Record<string, unknown>[];
  expect(rows).toHaveLength(50);
  expect(Object.keys(rows[0]!)).toEqual([
    "id",
    "first_name",
    "last_name",
    "email",
    "company",
    "city",
    "date",
  ]);
  expect(rows.map((r) => r.id)).toEqual(
    Array.from({ length: 50 }, (_, i) => i + 1),
  );
  for (const r of rows) {
    expect(r.email).toMatch(/^[a-z.]+\d*@example\.(com|org|net)$/);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }

  // Seeded output is the same every time
  await page.getByLabel("Repeatable (seed)").check();
  await page.getByRole("textbox", { name: "Seed" }).fill("test-seed");
  const first = await out.inputValue();
  await page.getByRole("textbox", { name: "Seed" }).fill("other");
  await expect(out).not.toHaveValue(first);
  await page.getByRole("textbox", { name: "Seed" }).fill("test-seed");
  await expect(out).toHaveValue(first);

  await page.getByRole("button", { name: "CSV" }).click();
  const csv = (await out.inputValue()).split("\n");
  expect(csv[0]).toBe("id,first_name,last_name,email,company,city,date");
  expect(csv).toHaveLength(51);

  await page.getByRole("button", { name: "SQL" }).click();
  await page.getByRole("textbox", { name: "Table name" }).fill("people");
  const sql = (await out.inputValue()).split("\n");
  expect(sql).toHaveLength(50);
  expect(sql[0]).toMatch(
    /^INSERT INTO people \(id, first_name, last_name, email, company, city, date\) VALUES \(1, '[^']+', /,
  );
  expect(sql[0]).toMatch(/\);$/);
});

test("compare-text use case opens the diff checker", async ({ page }) => {
  await openTool(page, "/compare-text");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Compare two texts",
  );
  await expect(page.getByRole("textbox", { name: "Original" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Changed" })).toBeVisible();
});
