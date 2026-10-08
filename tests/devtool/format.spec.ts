import { test, expect, openTool, download, bytes } from "../helpers.ts";
import type { Page } from "@playwright/test";

const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const box = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });
const status = (page: Page) => page.locator(".dev-status");

test("xml-formatter indents, keeps comments and CDATA, and points at errors", async ({
  page,
}) => {
  await openTool(page, "/xml-formatter");
  await box(page, "XML").fill(
    `<?xml version="1.0"?><!-- note --><feed><title>Hi &amp; bye</title><item id="1"><![CDATA[<b>x</b>]]></item><empty></empty></feed>`,
  );
  await expect(box(page, "Formatted")).toHaveValue(
    [
      `<?xml version="1.0"?>`,
      `<!-- note -->`,
      `<feed>`,
      `  <title>Hi &amp; bye</title>`,
      `  <item id="1"><![CDATA[<b>x</b>]]></item>`,
      `  <empty></empty>`,
      `</feed>`,
      ``,
    ].join("\n"),
  );
  await expect(status(page)).toContainText("Well-formed XML");
  await page.getByLabel("Collapse empty tags").check();
  await expect(box(page, "Formatted")).toHaveValue(/ {2}<empty\/>/);
  await btn(page, "Minify").click();
  await expect(box(page, "Minified")).toHaveValue(
    `<?xml version="1.0"?><!-- note --><feed><title>Hi &amp; bye</title><item id="1"><![CDATA[<b>x</b>]]></item><empty/></feed>`,
  );
  await btn(page, "Tree").click();
  await expect(page.locator(".xml-tree")).toContainText("title");

  await box(page, "XML").fill("<a>\n  <b>text</c>\n</a>");
  await expect(page.getByRole("alert")).toContainText("Line 2");
  await expect(page.getByRole("alert")).toContainText(
    /doesn't match|isn't closed/,
  );
  await expect(status(page)).toContainText("Not well-formed");
});

test("sql-formatter upper-cases keywords and breaks clauses for PostgreSQL", async ({
  page,
}) => {
  await openTool(page, "/sql-formatter");
  await page.getByLabel("Dialect").selectOption("postgresql");
  await box(page, "SQL").fill(
    "select id, name from users where created_at > now() - interval '1 day' and name ilike 'a%' order by id limit 5",
  );
  const out = box(page, "Formatted");
  await expect(out).toHaveValue(
    /^SELECT\n {2}id,\n {2}name\nFROM\n {2}users\nWHERE\n/,
  );
  await expect(out).toHaveValue(
    /\n {2}AND name ILIKE 'a%'\nORDER BY\n {2}id\nLIMIT\n {2}5\n$/,
  );
  await btn(page, "Lower case").click();
  await expect(out).toHaveValue(/^select\n/);
  await btn(page, "Minify").click();
  await expect(box(page, "Minified")).toHaveValue(
    "select id,name from users where created_at>now()- interval '1 day' and name ilike 'a%' order by id limit 5",
  );
  await expect(status(page)).toContainText("1 query");
});

test("html-formatter beautifies and minifies with byte savings", async ({
  page,
}) => {
  await openTool(page, "/html-formatter");
  await box(page, "HTML").fill(
    `<div class="a"><p>Hello <b>you</b></p><!-- gone --><pre>  keep   me</pre></div>`,
  );
  await expect(box(page, "Formatted")).toHaveValue(
    /<div class="a">\n {2}<p>Hello <b>you<\/b><\/p>\n/,
  );
  await btn(page, "4 spaces").click();
  await expect(box(page, "Formatted")).toHaveValue(/\n {4}<p>Hello/);
  await btn(page, "Minify").click();
  await expect(box(page, "Minified")).toHaveValue(
    `<div class="a"><p>Hello <b>you</b></p><pre>  keep   me</pre></div>`,
  );
  await expect(status(page)).toContainText("% smaller");
});

test("css-formatter beautifies and minifies with byte savings", async ({
  page,
}) => {
  await openTool(page, "/css-formatter");
  await box(page, "CSS").fill(
    `/* card */\n.card > h2 , a:hover{color:red;margin:0 0 8px;}\n@media (max-width: 600px){.card{width:calc(100% - 2 * 12px)}}`,
  );
  await expect(box(page, "Formatted")).toHaveValue(
    /^\/\* card \*\/\n\.card > h2,\na:hover {\n {2}color: red;\n {2}margin: 0 0 8px;\n}\n/,
  );
  await btn(page, "Minify").click();
  await expect(box(page, "Minified")).toHaveValue(
    ".card>h2,a:hover{color:red;margin:0 0 8px}@media (max-width: 600px){.card{width:calc(100% - 2 * 12px)}}",
  );
  await expect(status(page)).toContainText(/\d+(\.\d)?% smaller/);
});

test("js-formatter beautifies, minifies and reports parse errors with a line", async ({
  page,
}) => {
  await openTool(page, "/js-formatter");
  await box(page, "JavaScript").fill(
    "function add(a,b){return a+b}\nconst x = add(1,2)",
  );
  await expect(box(page, "Formatted")).toHaveValue(
    "function add(a, b) {\n  return a + b;\n}\nconst x = add(1, 2);\n",
  );
  await page.getByLabel("Semicolons").uncheck();
  await expect(box(page, "Formatted")).toHaveValue(/return a \+ b\n/);
  await btn(page, "Single").click();
  await box(page, "JavaScript").fill('const s = "hi"');
  await expect(box(page, "Formatted")).toHaveValue("const s = 'hi'\n");

  await btn(page, "Minify").click();
  await box(page, "JavaScript").fill(
    "function greet(name) {\n  const message = 'Hello, ' + name;\n  return message;\n}\nconsole.log(greet('you'));\n",
  );
  await expect(box(page, "Minified")).toHaveValue(
    /^function greet\(\w\)\{return"Hello, "\+\w\}console\.log\(greet\("you"\)\);?$/,
  );
  await expect(status(page)).toContainText("% smaller");

  await btn(page, "Beautify").click();
  await box(page, "JavaScript").fill("const a = 1;\nconst b = {\n  c: 2,,\n};");
  await expect(page.getByRole("alert")).toContainText("Line 3");
  await expect(status(page)).toContainText("Couldn't parse this code");

  // TypeScript
  await page.getByLabel("TypeScript").check();
  await box(page, "TypeScript").fill(
    "let n:number=1;function f<T>(x:T):T{return x}",
  );
  await expect(box(page, "Formatted")).toHaveValue(/let n: number = 1/);
});

test.describe(() => {
  // The pasted <img src=x> is a broken image on purpose
  test.use({ allowConsole: [/404/] });
  test("markdown-preview renders GFM, sanitises HTML and downloads", async ({
    page,
  }) => {
    let dialogs = 0;
    page.on("dialog", (d) => {
      dialogs++;
      void d.dismiss();
    });
    await openTool(page, "/markdown-preview");
    await box(page, "Markdown").fill(
      [
        "# Notes",
        "",
        "| Tool | Ready |",
        "| --- | --- |",
        "| XML | yes |",
        "",
        "- [x] done",
        "- [ ] todo",
        "",
        `<img src=x onerror="alert(1)">`,
        "",
        "<script>alert(2)</script>",
        "",
        `<a href="javascript:alert(3)">bad link</a>`,
      ].join("\n"),
    );
    const view = page.locator(".md-preview");
    await expect(view.locator("table td").first()).toHaveText("XML");
    await expect(view.locator("input[type=checkbox]")).toHaveCount(2);
    await expect(view.locator("input[type=checkbox]").first()).toBeChecked();
    await expect(view.locator("img")).toHaveCount(1);
    await expect(view.locator("img")).not.toHaveAttribute("onerror", /.*/);
    await expect(view.locator("script")).toHaveCount(0);
    await expect(
      view.locator("a", { hasText: "bad link" }),
    ).not.toHaveAttribute("href", /javascript/);
    await page.waitForTimeout(300);
    expect(dialogs).toBe(0);
    expect(
      await page.evaluate(() => document.querySelectorAll("[onerror]").length),
    ).toBe(0);

    // Toolbar wraps the selection
    await box(page, "Markdown").fill("make this bold");
    await box(page, "Markdown").evaluate((t: HTMLTextAreaElement) =>
      t.setSelectionRange(10, 14),
    );
    await page.getByRole("button", { name: "Bold" }).click();
    await expect(box(page, "Markdown")).toHaveValue("make this **bold**");
    await expect(view.locator("strong")).toHaveText("bold");

    const d = await download(page, () =>
      page.getByRole("button", { name: "Download .html" }).click(),
    );
    expect(d.suggestedFilename()).toBe("document.html");
    const html = (await bytes(d)).toString();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<strong>bold</strong>");

    await btn(page, "HTML").click();
    await expect(box(page, "HTML")).toHaveValue(
      "<p>make this <strong>bold</strong></p>\n",
    );
  });
});
