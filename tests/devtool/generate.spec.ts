import { test, expect, openTool } from "../helpers.ts";
import type { Page } from "@playwright/test";

const row = (page: Page, id: string) =>
  page.locator(`.dev-row[data-row="${id}"]`);
const val = (page: Page, id: string) => row(page, id).locator(".dev-row-val");

const SHA256_ABC =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const MD5_ABC = "900150983cd24fb0d6963f7d28e17f72";

test("hash: text, HMAC, compare and a file", async ({ page }) => {
  await openTool(page, "/hash");
  const text = page.getByRole("textbox", { name: "Text" });
  await text.fill("abc");
  await expect(val(page, "SHA-256")).toHaveText(SHA256_ABC);
  await expect(val(page, "MD5")).toHaveText(MD5_ABC);
  await expect(val(page, "SHA-1")).toHaveText(
    "a9993e364706816aba3e25717850c26c9cd0d89d",
  );

  // Compare marks the matching row (case and spaces don't matter)
  await page
    .getByRole("textbox", { name: "Compare with" })
    .fill(" " + MD5_ABC.toUpperCase() + " ");
  await expect(row(page, "MD5")).toHaveClass(/match/);
  await expect(row(page, "SHA-256")).not.toHaveClass(/match/);
  await page.getByRole("textbox", { name: "Compare with" }).fill("");

  // HMAC-SHA256, RFC 4231 test case 2
  await page.getByRole("textbox", { name: "HMAC key" }).fill("Jefe");
  await text.fill("what do ya want for nothing?");
  await expect(val(page, "SHA-256")).toHaveText(
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
  // HMAC-MD5, RFC 2104 test case 2
  await expect(val(page, "MD5")).toHaveText("750c783e6ab0b503eaa86e310a5db738");
  await page.getByRole("textbox", { name: "HMAC key" }).fill("");

  // A file, hashed in the worker
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles({
      name: "abc.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("abc"),
    });
  await expect(page.getByText("Hashed on your device.")).toBeVisible();
  await expect(val(page, "SHA-256")).toHaveText(SHA256_ABC);
  await expect(val(page, "MD5")).toHaveText(MD5_ABC);

  // Base64 output
  await page.getByRole("button", { name: "Base64" }).click();
  await expect(val(page, "SHA-256")).toHaveText(
    "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=",
  );
});

test("hash use cases highlight their algorithm", async ({ page }) => {
  await openTool(page, "/sha256");
  await expect(row(page, "SHA-256")).toHaveClass(/\bon\b/);
  await openTool(page, "/md5");
  await expect(row(page, "MD5")).toHaveClass(/\bon\b/);
  await expect(row(page, "SHA-256")).not.toHaveClass(/\bon\b/);
});

test("uuid: v4 and v7 formats, v7 in order, inspect", async ({ page }) => {
  await openTool(page, "/uuid");
  const vals = page.locator(".dev-rows.numbered .dev-row-val");
  await expect(vals).toHaveCount(10);
  const v4 = await vals.allTextContents();
  for (const v of v4)
    expect(v).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  expect(new Set(v4).size).toBe(10);

  await page.getByRole("button", { name: "UUID v7" }).click();
  await page.getByRole("spinbutton", { name: "How many" }).fill("200");
  await expect(vals).toHaveCount(200);
  const v7 = await vals.allTextContents();
  for (const v of v7)
    expect(v).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  expect([...v7].sort()).toEqual(v7);
  expect(new Set(v7).size).toBe(200);

  // The time inside a v7 UUID
  await page
    .getByRole("textbox", { name: "Inspect an ID" })
    .fill("018bcfe5-6800-7000-8000-000000000000");
  await expect(val(page, "ms")).toHaveText("1700000000000");
  await expect(val(page, "time")).toContainText("2023-11-14T22:13:20.000Z");

  await page.getByRole("button", { name: "ULID" }).click();
  await page.getByRole("spinbutton", { name: "How many" }).fill("3");
  await expect(vals).toHaveCount(3);
  for (const v of await vals.allTextContents())
    expect(v).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test("uuid-v4 use case starts on v4", async ({ page }) => {
  await openTool(page, "/uuid-v4");
  await expect(page.getByRole("button", { name: "UUID v4" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".dev-row-val").first()).toHaveText(
    /^[0-9a-f-]{36}$/,
  );
});

test("password generator: length, sets and passphrases", async ({ page }) => {
  await openTool(page, "/password-generator");
  await page.getByRole("spinbutton", { name: "Length" }).fill("32");
  await page.getByRole("checkbox", { name: "Symbols" }).uncheck();
  const vals = page.locator(".dev-row-val");
  await expect(vals.first()).toHaveText(/^[A-Za-z0-9]{32}$/);
  for (const v of await vals.allTextContents()) {
    expect(v).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(v).toMatch(/[A-Z]/);
    expect(v).toMatch(/[a-z]/);
    expect(v).toMatch(/[0-9]/);
  }
  await page.getByRole("checkbox", { name: "A–Z", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "a–z", exact: true }).uncheck();
  await expect(vals.first()).toHaveText(/^[0-9]{32}$/);
  await expect(page.getByText(/bits of entropy/)).toContainText("106");

  await page.getByRole("button", { name: "Passphrase" }).click();
  await expect(vals.first()).toHaveText(/^[a-z]+(-[a-z]+){4}$/);
});

test("timestamp: seconds and milliseconds", async ({ page }) => {
  await openTool(page, "/timestamp");
  const ts = page.getByRole("textbox", { name: "Timestamp" });
  await ts.fill("1700000000");
  await expect(val(page, "iso")).toHaveText("2023-11-14T22:13:20Z");
  await expect(val(page, "rfc")).toContainText("2023");
  await expect(page.locator(".dev-status")).toContainText("Read as seconds");
  await ts.fill("1700000000000");
  await expect(page.locator(".dev-status")).toContainText(
    "Read as milliseconds",
  );
  await expect(val(page, "iso")).toHaveText("2023-11-14T22:13:20Z");
  await page.getByRole("combobox", { name: "Time zone" }).selectOption("UTC");
  await expect(val(page, "rfc")).toHaveText("Tue, 14 Nov 2023 22:13:20 +0000");
  await expect(val(page, "week")).toContainText("Week 46 of 2023");
  await ts.fill("2024-05-01T12:00:00Z");
  await expect(val(page, "s")).toHaveText("1714564800");
});

test("epoch-to-date use case shows the current time", async ({ page }) => {
  await openTool(page, "/epoch-to-date");
  await expect(val(page, "s").first()).toHaveText(/^\d{10}$/);
});

test("case converter splits names smartly", async ({ page }) => {
  await openTool(page, "/case-converter");
  const text = page.getByRole("textbox", { name: "Text" });
  await text.fill("XMLHttpRequest userID");
  await expect(val(page, "camel")).toHaveText("xmlHttpRequestUserId");
  await expect(val(page, "pascal")).toHaveText("XmlHttpRequestUserId");
  await expect(val(page, "snake")).toHaveText("xml_http_request_user_id");
  await expect(val(page, "constant")).toHaveText("XML_HTTP_REQUEST_USER_ID");
  await expect(val(page, "kebab")).toHaveText("xml-http-request-user-id");
  await text.fill("version2Beta\nalready_snake");
  await expect(val(page, "snake")).toHaveText("version2_beta\nalready_snake");
  await expect(val(page, "train")).toHaveText("Version2-Beta\nAlready-Snake");
});

test("camel-case use case highlights camelCase", async ({ page }) => {
  await openTool(page, "/camel-case");
  await page.getByRole("textbox", { name: "Text" }).fill("hello world");
  await expect(row(page, "camel")).toHaveClass(/\bon\b/);
  await expect(val(page, "camel")).toHaveText("helloWorld");
});

test("lorem ipsum: units, opening and HTML", async ({ page }) => {
  await openTool(page, "/lorem-ipsum");
  const out = page.getByRole("textbox", { name: "Placeholder text" });
  await expect(out).toHaveValue(/^Lorem ipsum dolor sit amet/);
  await page.getByRole("button", { name: "Words" }).click();
  await page.getByRole("spinbutton", { name: "How many" }).fill("12");
  await expect(out).toHaveValue(/^(\S+ ){11}\S+$/);
  await page.getByRole("button", { name: "Paragraphs" }).click();
  await page.getByRole("spinbutton", { name: "How many" }).fill("2");
  await page.getByRole("button", { name: "HTML" }).click();
  await expect(out).toHaveValue(/^<p>Lorem ipsum[^]*<\/p>\n\n<p>[^]*<\/p>$/);
});
