import { test, expect, openTool } from "../helpers.ts";

test("json-formatter formats, minifies and points at errors", async ({
  page,
}) => {
  await openTool(page, "/json-formatter");
  const input = page.getByRole("textbox", { name: "JSON" });
  await input.fill('{"b":1,"a":[1,2]}');
  const out = page.getByRole("textbox", { name: "Formatted" });
  await expect(out).toHaveValue(
    '{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}',
  );
  await page.getByRole("button", { name: "Minify" }).click();
  await expect(page.getByRole("textbox", { name: "Minified" })).toHaveValue(
    '{"b":1,"a":[1,2]}',
  );
  await input.fill('{"a":1,}');
  await expect(page.getByRole("alert")).toContainText("trailing comma");
  await expect(page.getByRole("alert")).toContainText("Line 1");
});

test("smart paste on the home page opens the JSON formatter with the text", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Paste anything" })
    .fill('{"x":true}');
  await page.getByRole("button", { name: /Open JSON formatter/ }).click();
  await expect(page).toHaveURL(/\/json-formatter$/);
  await expect(page.getByRole("textbox", { name: "JSON" })).toHaveValue(
    '{"x":true}',
  );
});
