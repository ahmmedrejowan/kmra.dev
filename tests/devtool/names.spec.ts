/**
 * Download names follow the opened file ("<file>-<tool>-kmra.<ext>"); typed or pasted input
 * keeps the plain names. Also: an empty file replaces an open workbook.
 */
import { test, expect, openTool, gen, download, bytes } from "../helpers.ts";
import type { Page } from "@playwright/test";

const box = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });
const outPane = (page: Page) => page.locator(".tool-area .pane").nth(1);
const fileInput = (page: Page) =>
  page.locator(".tool-area input[type=file]").first();

test("json-formatter names the download after the opened file", async ({
  page,
}) => {
  await openTool(page, "/json-formatter");
  await box(page, "JSON").fill('{"a":1}');
  let d = await download(page, () =>
    outPane(page).getByRole("button", { name: "Download" }).click(),
  );
  expect(d.suggestedFilename()).toBe("formatted-kmra.json");

  await fileInput(page).setInputFiles({
    name: "report.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"b":[1,2]}'),
  });
  await expect(box(page, "Formatted")).toHaveValue(
    '{\n  "b": [\n    1,\n    2\n  ]\n}',
  );
  d = await download(page, () =>
    outPane(page).getByRole("button", { name: "Download" }).click(),
  );
  expect(d.suggestedFilename()).toBe("report-json-formatter-kmra.json");
  expect((await bytes(d)).toString()).toBe(
    '{\n  "b": [\n    1,\n    2\n  ]\n}',
  );

  // Clearing forgets the file: typed text gets the plain name again
  await page
    .locator(".tool-area .pane")
    .first()
    .getByRole("button", { name: "Clear" })
    .click();
  await box(page, "JSON").fill('{"c":3}');
  d = await download(page, () =>
    outPane(page).getByRole("button", { name: "Download" }).click(),
  );
  expect(d.suggestedFilename()).toBe("formatted-kmra.json");
});

test("base64 names an encoded file after it", async ({ page }) => {
  await openTool(page, "/base64");
  await fileInput(page).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(box(page, "Base64")).toHaveValue("aGVsbG8=");
  const d = await download(page, () =>
    outPane(page).getByRole("button", { name: "Download" }).click(),
  );
  expect(d.suggestedFilename()).toBe("notes-base64-kmra.txt");
  expect((await bytes(d)).toString()).toBe("aGVsbG8=");
});

test("csv-json names the JSON after an opened CSV", async ({ page }) => {
  await openTool(page, "/csv-json");
  await fileInput(page).setInputFiles({
    name: "people.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,name\n1,Ada"),
  });
  await expect(box(page, "JSON")).toHaveValue(
    '[\n  {\n    "id": 1,\n    "name": "Ada"\n  }\n]',
  );
  const d = await download(page, () =>
    outPane(page).getByRole("button", { name: "Download" }).click(),
  );
  expect(d.suggestedFilename()).toBe("people-csv-json-kmra.json");
});

test("csv-json: an empty file replaces an open workbook and says so", async ({
  page,
}) => {
  await openTool(page, "/excel-to-json");
  await fileInput(page).setInputFiles(gen("devtool-sheet.xlsx"));
  await expect(page.getByText("devtool-sheet.xlsx")).toBeVisible();
  await fileInput(page).setInputFiles({
    name: "empty.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(0),
  });
  await expect(page.getByText("empty.csv is empty.")).toBeVisible();
  await expect(page.getByText("devtool-sheet.xlsx")).toHaveCount(0);
  await expect(box(page, "JSON")).toHaveValue("");
});
