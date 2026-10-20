import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { test, expect, openTool, download, bytes } from "../helpers.ts";
import type { Page } from "@playwright/test";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function hs256(payload: object, secret: string) {
  const input = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}`;
  return `${input}.${b64url(createHmac("sha256", secret).update(input).digest())}`;
}

const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const box = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });

test("base64 encodes UTF-8 text, URL-safe and as a data URI", async ({
  page,
}) => {
  await openTool(page, "/base64");
  await box(page, "Text or file").fill("héllo 👋");
  await expect(box(page, "Base64")).toHaveValue("aMOpbGxvIPCfkYs=");
  await page.getByRole("checkbox", { name: "Data URI" }).check();
  await expect(box(page, "Base64")).toHaveValue(
    "data:text/plain;charset=utf-8;base64,aMOpbGxvIPCfkYs=",
  );
  await page.getByRole("checkbox", { name: "Data URI" }).uncheck();
  await box(page, "Text or file").fill("subjects?_d");
  await expect(box(page, "Base64")).toHaveValue("c3ViamVjdHM/X2Q=");
  await btn(page, "URL-safe").click();
  await expect(box(page, "Base64")).toHaveValue("c3ViamVjdHM_X2Q");
});

test("base64 decode page decodes standard and URL-safe Base64 and points at errors", async ({
  page,
}) => {
  await openTool(page, "/base64-decode");
  await expect(btn(page, "Decode")).toHaveAttribute("aria-pressed", "true");
  await box(page, "Base64").fill("aMOpbGxvIPCfkYs=");
  await expect(box(page, "Text")).toHaveValue("héllo 👋");
  await box(page, "Base64").fill("c3ViamVjdHM_X2Q");
  await expect(box(page, "Text")).toHaveValue("subjects?_d");
  await box(page, "Base64").fill("aGVs#bG8=");
  await expect(page.getByRole("alert")).toContainText("unexpected character");
  await expect(page.getByRole("alert")).toContainText("column 5");
});

test("base64 round-trips a binary file", async ({ page }) => {
  await openTool(page, "/base64");
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 37) % 256)),
  ]);
  await page
    .locator(".tool-area input[type=file]")
    .first()
    .setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("dot.png")).toBeVisible();
  await expect(box(page, "Base64")).toHaveValue(png.toString("base64"));
  await btn(page, "Swap").click();
  await expect(btn(page, "Decode")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("PNG image").first()).toBeVisible();
  const d = await download(page, () =>
    btn(page, "Download decoded.png").click(),
  );
  expect(d.suggestedFilename()).toBe("decoded-kmra.png");
  expect((await bytes(d)).equals(png)).toBe(true);
});

test("url-encode encodes components and full URLs", async ({ page }) => {
  await openTool(page, "/url-encode");
  await box(page, "Text").fill("a b&c=é/👋");
  await expect(box(page, "Encoded")).toHaveValue(
    "a%20b%26c%3D%C3%A9%2F%F0%9F%91%8B",
  );
  await page.getByRole("checkbox", { name: "Spaces as +" }).check();
  await expect(box(page, "Encoded")).toHaveValue(
    "a+b%26c%3D%C3%A9%2F%F0%9F%91%8B",
  );
  await btn(page, "Full URL").click();
  await box(page, "Text").fill("https://x.com/a b?q=é&x=1");
  await expect(box(page, "Encoded")).toHaveValue(
    "https://x.com/a%20b?q=%C3%A9&x=1",
  );
});

test("url-decode page decodes, with + as a space by choice", async ({
  page,
}) => {
  await openTool(page, "/url-decode");
  await expect(btn(page, "Decode")).toHaveAttribute("aria-pressed", "true");
  await box(page, "Encoded").fill("a+b%20caf%C3%A9%F0%9F%91%8B");
  await expect(box(page, "Decoded")).toHaveValue("a b café👋");
  await page.getByRole("checkbox", { name: "+ means space" }).uncheck();
  await expect(box(page, "Decoded")).toHaveValue("a+b café👋");
  await box(page, "Encoded").fill("ok%2Gno");
  await expect(page.getByRole("alert")).toContainText("two hex digits");
  await expect(page.getByRole("alert")).toContainText("column 3");
});

test("html-entities escapes and unescapes", async ({ page }) => {
  await openTool(page, "/html-entities");
  await box(page, "Text").fill(`<a href="x">Tom & 'Jé' 👋</a>`);
  await expect(box(page, "Escaped")).toHaveValue(
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jé&#39; 👋&lt;/a&gt;",
  );
  await btn(page, "Also non-ASCII").click();
  await expect(box(page, "Escaped")).toHaveValue(
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;J&eacute;&#39; &#128075;&lt;/a&gt;",
  );
  await btn(page, "Hex").click();
  await expect(box(page, "Escaped")).toHaveValue(
    "&#x3C;a href=&#x22;x&#x22;&#x3E;Tom &#x26; &#x27;J&#xE9;&#x27; &#x1F44B;&#x3C;/a&#x3E;",
  );
  await btn(page, "Unescape").click();
  await box(page, "HTML").fill(
    "&lt;b&gt; &eacute; &#128075; &#x2665; &hearts; &amp;amp; &bogus;",
  );
  await expect(box(page, "Unescaped")).toHaveValue(
    "<b> é 👋 ♥ ♥ &amp; &bogus;",
  );
});

test("jwt-decoder reads a token and checks an HS256 signature", async ({
  page,
}) => {
  await openTool(page, "/jwt-decoder");
  await box(page, "Token").fill(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  );
  await expect(page.locator(".jwt-json").first()).toContainText(
    '"alg": "HS256"',
  );
  await expect(page.locator(".jwt-json").nth(1)).toContainText("John Doe");
  await expect(page.locator(".jwt-claims")).toContainText("2018");
  const secret = box(page, "Secret");
  await secret.fill("your-256-bit-secret");
  await expect(page.locator(".jwt-badge")).toHaveText("Signature verified");
  await secret.fill("not-the-secret");
  await expect(page.locator(".jwt-badge")).toContainText(
    "Signature doesn't match",
  );
});

test("jwt-decoder shows expiry as relative time and reports bad tokens", async ({
  page,
}) => {
  await openTool(page, "/jwt-decoder");
  const now = Math.floor(Date.now() / 1000);
  await box(page, "Token").fill(hs256({ sub: "a", exp: now - 3 * 86400 }, "s"));
  await expect(page.locator(".dev-status")).toContainText("Expired 3 days ago");
  await box(page, "Token").fill(
    hs256({ sub: "a", exp: now + 2 * 3600 + 60 }, "s"),
  );
  await expect(page.locator(".dev-status")).toContainText("Valid for 2 hours");
  await box(page, "Token").fill("abc.def");
  await expect(page.getByRole("alert")).toContainText("three parts");
});

test("jwt-decoder checks an RS256 signature with a public key", async ({
  page,
}) => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const input = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ sub: "rs" }))}`;
  const token = `${input}.${b64url(sign("sha256", Buffer.from(input), privateKey))}`;
  await openTool(page, "/jwt-decoder");
  await box(page, "Token").fill(token);
  await box(page, "Public key").fill(
    publicKey.export({ type: "spki", format: "pem" }).toString(),
  );
  await expect(page.locator(".jwt-badge")).toHaveText("Signature verified");
  // The same key as a JWK
  await box(page, "Public key").fill(
    JSON.stringify(publicKey.export({ format: "jwk" })),
  );
  await expect(page.locator(".jwt-badge")).toHaveText("Signature verified");
});

test("unicode-escape escapes astral characters and reads every form back", async ({
  page,
}) => {
  await openTool(page, "/unicode-escape");
  await box(page, "Text").fill("Hé👋");
  await expect(box(page, "Escapes")).toHaveValue("H\\u00E9\\uD83D\\uDC4B");
  await btn(page, "\\u{…}").click();
  await expect(box(page, "Escapes")).toHaveValue("H\\u{00E9}\\u{1F44B}");
  await btn(page, "U+XXXX").click();
  await expect(box(page, "Escapes")).toHaveValue("U+0048 U+00E9 U+1F44B");
  await btn(page, "&#x…;").click();
  await expect(box(page, "Escapes")).toHaveValue("H&#x00E9;&#x1F44B;");
  await btn(page, "Unescape").click();
  for (const [inp, out] of [
    ["U+0048 U+00E9 U+1F44B", "Hé👋"],
    ["\\uD83D\\uDC4B \\u{1F600} \\xe9 &#233;", "👋 😀 é é"],
    ['"line\\nbreak \\"q\\""', 'line\nbreak "q"'],
  ]) {
    await box(page, "Escapes").fill(inp!);
    await expect(box(page, "Text")).toHaveValue(out!);
  }
  await box(page, "Escapes").fill("ab\\u12g");
  await expect(page.getByRole("alert")).toContainText("Incomplete escape");
});

test("text-hex converts UTF-8 bytes both ways", async ({ page }) => {
  await openTool(page, "/text-hex");
  await box(page, "Text").fill("Hé👋");
  await expect(box(page, "Hex")).toHaveValue("48 c3 a9 f0 9f 91 8b");
  await page.getByRole("checkbox", { name: "0x prefix" }).check();
  await btn(page, "Comma").click();
  await expect(box(page, "Hex")).toHaveValue(
    "0x48, 0xc3, 0xa9, 0xf0, 0x9f, 0x91, 0x8b",
  );
  await btn(page, "Binary").click();
  await btn(page, "Space").click();
  await expect(box(page, "Binary")).toHaveValue(
    "01001000 11000011 10101001 11110000 10011111 10010001 10001011",
  );
  await btn(page, "Decimal").click();
  await expect(box(page, "Decimal")).toHaveValue("72 195 169 240 159 145 139");
  await btn(page, "Bytes to text").click();
  for (const [inp, out] of [
    ["0x48,0xC3,0xA9", "Hé"],
    ["48c3a9", "Hé"],
    ["01001000 01101001", "Hi"],
    ["72 105 33", "Hi!"],
  ]) {
    await box(page, "Bytes").fill(inp!);
    await expect(box(page, "Text")).toHaveValue(out!);
  }
  await box(page, "Bytes").fill("48 4z");
  await expect(page.getByRole("alert")).toContainText("Not valid hex");
});

test("jwt-decoder checks an ES256 signature", async ({ page }) => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const input = `${b64url(JSON.stringify({ alg: "ES256" }))}.${b64url(JSON.stringify({ sub: "es" }))}`;
  const sig = sign("sha256", Buffer.from(input), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  await openTool(page, "/jwt-decoder");
  await box(page, "Token").fill(`${input}.${b64url(sig)}`);
  await box(page, "Public key").fill(
    publicKey.export({ type: "spki", format: "pem" }).toString(),
  );
  await expect(page.locator(".jwt-badge")).toHaveText("Signature verified");
});

test("smart paste hands Base64 to the decoder", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Paste anything" })
    .fill("aGVsbG8gd29ybGQgZnJvbSBrbXJh");
  await page.getByRole("button", { name: /Open Base64/ }).click();
  await expect(page).toHaveURL(/\/base64$/);
  await expect(btn(page, "Decode")).toHaveAttribute("aria-pressed", "true");
  await expect(box(page, "Text")).toHaveValue("hello world from kmra");
});
