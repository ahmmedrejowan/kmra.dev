import { test, expect, openTool, gen, download, bytes } from "../helpers.ts";
import type { Page } from "@playwright/test";

const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const box = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });
const row = (page: Page, id: string) =>
  page.locator(`[data-row="${id}"] .dev-row-val`);

test("number-base converts 255, a 30-digit number and negatives", async ({
  page,
}) => {
  await openTool(page, "/number-base");
  await box(page, "Number").fill("255");
  await expect(row(page, "b16")).toHaveText("0xff");
  await expect(row(page, "b2")).toHaveText("0b11111111");
  await expect(row(page, "b8")).toHaveText("0o377");
  await expect(row(page, "t8")).toHaveText("11111111");

  // A 30-digit number survives decimal → hex → decimal
  const big = "123456789012345678901234567890";
  await box(page, "Number").fill(big);
  const hex = BigInt(big).toString(16);
  await expect(row(page, "b16")).toHaveText(`0x${hex}`);
  await box(page, "Number").fill(`0x${hex}`);
  await expect(row(page, "b10")).toHaveText(big);
  await expect(row(page, "b36")).toHaveText(BigInt(big).toString(36));

  await box(page, "Number").fill("-1");
  await expect(row(page, "t8")).toHaveText("11111111");
  await expect(row(page, "t16")).toHaveText("1111111111111111");
  await expect(row(page, "b2")).toHaveText("-0b1");

  await box(page, "Number").fill("12a");
  await btn(page, "Decimal").click();
  await expect(page.getByRole("alert")).toContainText("isn't a digit");
  await expect(page.getByRole("alert")).toContainText("column 3");
});

test("color-converter reads HEX and checks contrast", async ({ page }) => {
  await openTool(page, "/color-converter");
  await box(page, "Color").fill("#8e4ec6");
  await expect(row(page, "rgb")).toHaveText("rgb(142 78 198)");
  await expect(row(page, "hsl")).toHaveText("hsl(272 51.3% 54.1%)");
  const oklch = await row(page, "oklch").textContent();
  const m = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/.exec(oklch ?? "");
  expect(m, oklch ?? "").not.toBeNull();
  expect(Math.abs(Number(m![1]) - 55.56)).toBeLessThan(0.05);
  expect(Math.abs(Number(m![2]) - 0.1829)).toBeLessThan(0.001);
  expect(Math.abs(Number(m![3]) - 305.86)).toBeLessThan(0.1);

  // oklch() input comes back to the same HEX
  await box(page, "Color").fill(oklch!);
  await expect(row(page, "hex")).toHaveText("#8e4ec6");

  await box(page, "Color").fill("black");
  await box(page, "Background").fill("white");
  await expect(page.locator("[data-ratio]")).toHaveText("21.00:1");
  await expect(page.locator(".cc-checks .pass")).toHaveCount(4);
  await box(page, "Color").fill("#777");
  await expect(page.locator("[data-ratio]")).toHaveText("4.48:1");
  await expect(page.locator(".cc-checks .pass")).toHaveCount(1);

  await box(page, "Color").fill("rgb(1 2)");
  await expect(page.getByRole("alert")).toContainText("three values");
});

test("csv-json turns quoted CSV into JSON and back", async ({ page }) => {
  await openTool(page, "/csv-json");
  const csv =
    'id,name,note\n1,"Hopper, Grace","line one\nline two"\n2,Ada,"say ""hi"""';
  await box(page, "CSV").fill(csv);
  const json = [
    { id: 1, name: "Hopper, Grace", note: "line one\nline two" },
    { id: 2, name: "Ada", note: 'say "hi"' },
  ];
  await expect(box(page, "JSON")).toHaveValue(JSON.stringify(json, null, 2));
  await expect(page.locator(".dev-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".dev-status")).toContainText("2 rows, 3 columns");

  await btn(page, "Swap").click();
  await expect(btn(page, "JSON")).toHaveAttribute("aria-pressed", "true");
  await expect(box(page, "CSV")).toHaveValue(csv);

  // Nested objects flatten to dotted keys, arrays stay JSON
  await box(page, "JSON").fill(
    '[{"a":{"b":1},"t":["x","y"]},{"a":{"c":true}}]',
  );
  await expect(box(page, "CSV")).toHaveValue(
    'a.b,t,a.c\n1,"[""x"",""y""]",\n,,true',
  );

  // Semicolons are detected; an open quote points at its line
  await box(page, "JSON").fill("x;y\n1;2");
  await expect(btn(page, "CSV")).toHaveAttribute("aria-pressed", "true");
  await expect(box(page, "JSON")).toHaveValue(
    '[\n  {\n    "x": 1,\n    "y": 2\n  }\n]',
  );
  await box(page, "CSV").fill('a,b\n1,"open');
  await expect(page.getByRole("alert")).toContainText("isn't closed");
  await expect(page.getByRole("alert")).toContainText("Line 2");
});

test("csv-json reads an Excel workbook sheet by sheet", async ({ page }) => {
  await openTool(page, "/excel-to-json");
  await expect(btn(page, "Excel")).toHaveAttribute("aria-pressed", "true");
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles(gen("devtool-sheet.xlsx"));
  await expect(page.getByText("devtool-sheet.xlsx")).toBeVisible();
  await expect(box(page, "JSON")).toHaveValue(
    JSON.stringify(
      [
        { id: 1, name: "Widget, large", price: 9.5, active: true },
        { id: 2, name: "Gadget", price: 12, active: false },
      ],
      null,
      2,
    ),
  );
  await page.getByRole("combobox", { name: "Sheet" }).selectOption("Places");
  await expect(box(page, "JSON")).toHaveValue(
    '[\n  {\n    "city": "Dhaka",\n    "country": "Bangladesh"\n  }\n]',
  );
  await page
    .getByRole("group", { name: "Output" })
    .getByRole("button", { name: "CSV" })
    .click();
  await expect(box(page, "CSV")).toHaveValue("city,country\nDhaka,Bangladesh");
  const d = await download(page, () =>
    page
      .locator(".tool-area .pane")
      .nth(1)
      .getByRole("button", { name: "Download" })
      .click(),
  );
  expect(d.suggestedFilename()).toBe("devtool-sheet-Places.csv");
  expect((await bytes(d)).toString()).toBe("city,country\nDhaka,Bangladesh");
});

test("json-to-typescript names nested types and marks optional fields", async ({
  page,
}) => {
  await openTool(page, "/json-to-typescript");
  await box(page, "JSON").fill(
    JSON.stringify({
      id: 1,
      owner: { login: "ada" },
      users: [
        { id: 1, email: "a@b.c" },
        { id: 2, email: null, admin: true },
      ],
      mixed: [1, "a"],
    }),
  );
  await expect(box(page, "TypeScript")).toHaveValue(
    [
      "export interface Root {",
      "  id: number;",
      "  owner: Owner;",
      "  users: User[];",
      "  mixed: (number | string)[];",
      "}",
      "",
      "export interface Owner {",
      "  login: string;",
      "}",
      "",
      "export interface User {",
      "  id: number;",
      "  email: string | null;",
      "  admin?: boolean;",
      "}",
      "",
    ].join("\n"),
  );
  await btn(page, "type").click();
  await page.getByRole("checkbox", { name: "Export" }).uncheck();
  await page.getByRole("checkbox", { name: "Read-only" }).check();
  await page.getByRole("textbox", { name: "Root name" }).fill("api response");
  await expect(box(page, "TypeScript")).toHaveValue(
    /^type ApiResponse = \{\n {2}readonly id: number;/,
  );
  await expect(box(page, "TypeScript")).toHaveValue(
    /readonly users: readonly User\[\];/,
  );
});

test("curl-converter turns headers and a JSON body into code", async ({
  page,
}) => {
  await openTool(page, "/curl-converter");
  await box(page, "cURL command").fill(
    `curl -X PUT 'https://api.example.com/items/7?draft=1' \\
  -H 'Authorization: Bearer t0ken' \\
  -H "Content-Type: application/json" \\
  --data-raw '{"name":"Lamp","tags":["a"],"stock":null}' -sL`,
  );
  const code = box(page, "fetch");
  await expect(code).toHaveValue(
    /fetch\("https:\/\/api\.example\.com\/items\/7\?draft=1"/,
  );
  await expect(code).toHaveValue(/method: "PUT"/);
  await expect(code).toHaveValue(/"Authorization": "Bearer t0ken"/);
  await expect(code).toHaveValue(/"Content-Type": "application\/json"/);
  await expect(code).toHaveValue(
    /body: JSON\.stringify\(\{\n {4}"name": "Lamp"/,
  );
  await expect(row(page, "method")).toHaveText("PUT");
  await expect(row(page, "q0")).toHaveText("1");

  await btn(page, "Python").click();
  await expect(box(page, "Python")).toHaveValue(/requests\.put\(/);
  await expect(box(page, "Python")).toHaveValue(/"stock": None/);
  await btn(page, "Go").click();
  await expect(box(page, "Go")).toHaveValue(
    /http\.NewRequest\("PUT", "https:\/\/api\.example\.com\/items\/7\?draft=1", body\)/,
  );
  await btn(page, "axios").click();
  await expect(box(page, "axios")).toHaveValue(/method: "put"/);

  await box(page, "cURL command").fill(
    "curl -u ada:pw -F file=@a.png https://x.dev/up",
  );
  await expect(row(page, "auth")).toHaveText("ada:pw");
  await expect(box(page, "axios")).toHaveValue(
    /auth: \{ username: "ada", password: "pw" \}/,
  );

  await box(page, "cURL command").fill("curl 'https://x.dev");
  await expect(page.getByRole("alert")).toContainText("single quote");
});

test("yaml-json converts both ways and points at YAML errors", async ({
  page,
}) => {
  await openTool(page, "/yaml-json");
  await box(page, "YAML").fill(
    "# config\nname: kmra\nport: 8080\ntags:\n  - a\n  - b\nnested:\n  on: true\n  none: null\n",
  );
  const value = {
    name: "kmra",
    port: 8080,
    tags: ["a", "b"],
    nested: { on: true, none: null },
  };
  await expect(box(page, "JSON")).toHaveValue(JSON.stringify(value, null, 2));
  await btn(page, "Swap").click();
  await expect(btn(page, "JSON to YAML")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(box(page, "YAML")).toHaveValue(
    "name: kmra\nport: 8080\ntags:\n  - a\n  - b\nnested:\n  on: true\n  none: null\n",
  );
  await btn(page, "Flow").click();
  await expect(box(page, "YAML")).toHaveValue(/^\{ name: kmra, port: 8080/);

  await btn(page, "YAML to JSON").click();
  await box(page, "YAML").fill("key: value\n\tother: x");
  await expect(page.getByRole("alert")).toContainText("not tabs");
  await expect(page.getByRole("alert")).toContainText("Line 2");
  await box(page, "YAML").fill("a: 1\na: 2");
  await expect(page.getByRole("alert")).toContainText("twice");
});

test("convert use-case pages open with their presets", async ({ page }) => {
  await openTool(page, "/yaml-to-json");
  await expect(btn(page, "YAML to JSON")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await openTool(page, "/json-to-yaml");
  await expect(btn(page, "JSON to YAML")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await box(page, "JSON").fill('{"a":[1]}');
  await expect(box(page, "YAML")).toHaveValue("a:\n  - 1\n");

  await openTool(page, "/hex-to-rgb");
  await expect(box(page, "Color")).toHaveValue("#ff8800");
  await expect(row(page, "rgb")).toHaveText("rgb(255 136 0)");
  await expect(page.locator('[data-row="rgb"]')).toHaveClass(/\bon\b/);

  await openTool(page, "/csv-to-json");
  await expect(btn(page, "CSV")).toHaveAttribute("aria-pressed", "true");
  await openTool(page, "/json-to-csv");
  await expect(btn(page, "JSON")).toHaveAttribute("aria-pressed", "true");
  await btn(page, "Try a sample").click();
  await expect(box(page, "CSV")).toHaveValue(
    /^id,name,address\.city,address\.zip,tags,active\n/,
  );
  await openTool(page, "/excel-to-json");
  await expect(btn(page, "Excel")).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("Open an Excel or OpenDocument file"),
  ).toBeVisible();
});
