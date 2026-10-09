/**
 * kmra.dev, the hub: home (six apps, drop box, showcase, tasks), all-tools search, info pages,
 * Bangla pages, headers, and the file handoff to each app. Handoff tests load the hub and the
 * apps under their real names (https://kmra.dev, https://<app>.kmra.dev), routed to the local
 * test servers, so the sites are same-site as in production and the real CSP applies.
 */
import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, gen, test } from "../helpers.ts";

const PORTS: Record<string, number> = {
  "kmra.dev": 4607,
  "imgtool.kmra.dev": 4601,
  "pdftool.kmra.dev": 4602,
  "qrtool.kmra.dev": 4603,
  "devtool.kmra.dev": 4604,
  "ocrtool.kmra.dev": 4605,
  "vidtool.kmra.dev": 4606,
};
const APPS = ["imgtool", "pdftool", "vidtool", "devtool", "qrtool", "ocrtool"];

/** Serve https://kmra.dev and https://<app>.kmra.dev from the local builds */
async function realSites(context: BrowserContext) {
  await context.route(/^https:\/\/([a-z]+\.)?kmra\.dev\//, async (route) => {
    const u = new URL(route.request().url());
    const port = PORTS[u.hostname];
    if (!port) return route.abort();
    const response = await route.fetch({
      url: `http://localhost:${port}${u.pathname}${u.search}`,
    });
    await route.fulfill({ response });
  });
}

const drop = (page: Page, files: string | string[]) =>
  page.locator(".hubdrop input[type=file]").setInputFiles(files);

test.use({ serviceWorkers: "block" });

test("home lists the six apps, links to their sites and counts every tool", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/kmra\.dev/);
  await expect(page.locator("h1")).toHaveText("Free tools for every file");
  const cards = page.locator(".hub-app");
  await expect(cards).toHaveCount(6);
  for (const id of APPS)
    await expect(
      page.locator(`.hub-app[href="https://${id}.kmra.dev/"]`),
    ).toHaveCount(1);
  // The total in the lede is the sum of each app's count
  const counts = await page.locator(".hub-app-count strong").allInnerTexts();
  const sum = counts.reduce((s, n) => s + Number(n), 0);
  await expect(page.locator(".lede").first()).toContainText(`${sum} tools`);
  await expect(page.locator(".hub-chips a")).toHaveCount(10);
  expect(await page.locator(".marquee .feat").count()).toBeGreaterThan(20);
  await expect(page.locator(".tasks .task")).toHaveCount(12);
  // Footer: one column per app
  await expect(page.locator("footer .fapp-title")).toHaveCount(6);
  // Menus open
  await page.getByRole("button", { name: "Apps" }).click();
  await expect(page.locator("#m-apps .app-item")).toHaveCount(6);
});

test("dropping a PDF offers PDF and OCR tools; more expands; another file resets", async ({
  page,
}) => {
  await page.goto("/");
  await drop(page, gen("text6.pdf"));
  await expect(page.locator(".hub-file strong")).toHaveText("text6.pdf");
  const groups = page.locator(".hub-match");
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0).locator("h3 > span:last-child")).toHaveText("PDFTool");
  await expect(groups.nth(1).locator("h3 > span:last-child")).toHaveText("OCRTool");
  const pdf = groups.nth(0).locator(".hub-match-tools a");
  await expect(pdf).toHaveCount(6);
  await expect(pdf.first()).toHaveAttribute(
    "href",
    "https://pdftool.kmra.dev/compress",
  );
  await groups.nth(0).getByRole("button", { name: /more/ }).click();
  expect(await pdf.count()).toBeGreaterThan(6);
  await page.getByRole("button", { name: "Other files" }).click();
  await expect(page.getByText("Drop any file")).toBeVisible();
});

test("each kind of file gets its own tools", async ({ page }) => {
  await page.goto("/");
  const first = () =>
    page
      .locator(".hub-match h3 > span:last-child")
      .allInnerTexts()
      .then((t) => t.join(","));
  await drop(page, gen("photo.jpg"));
  expect(await first()).toBe("ImgTool,PDFTool,OCRTool,QRTool");
  await page.getByRole("button", { name: "Other files" }).click();
  await drop(page, gen("vid-landscape.mp4"));
  expect(await first()).toBe("VidTool");
  await page.getByRole("button", { name: "Other files" }).click();
  await drop(page, gen("anim.gif"));
  expect(await first()).toBe("VidTool,ImgTool");
  await page.getByRole("button", { name: "Other files" }).click();
  await drop(page, {
    name: "data.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"a":1}'),
  } as never);
  expect(await first()).toBe("DevTool");
  await page.getByRole("button", { name: "Other files" }).click();
  await drop(page, {
    name: "archive.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK"),
  } as never);
  await expect(page.locator(".hub-none")).toContainText("no kmra tool");
});

test.describe("handoff to the apps (real domains, routed to the local builds)", () => {
  test.beforeEach(async ({ context }) => realSites(context));

  test("a PDF dropped on the hub opens in PDFTool's compress, loaded", async ({
    page,
  }) => {
    await page.goto("https://kmra.dev/");
    await drop(page, gen("text6.pdf"));
    await page.locator(".hub-match-tools a", { hasText: "Compress" }).first().click();
    await expect(page).toHaveURL("https://pdftool.kmra.dev/compress");
    await expect(
      page.locator(".tool-area .result small").first(),
    ).toContainText("6 page", { timeout: 30_000 });
  });

  test("a photo opens in ImgTool's resize with the photo loaded", async ({
    page,
  }) => {
    await page.goto("https://kmra.dev/");
    await drop(page, gen("photo.jpg"));
    await page.locator(".hub-match-tools a", { hasText: /^Resize$/ }).click();
    await expect(page).toHaveURL("https://imgtool.kmra.dev/resize");
    await expect(page.locator("main")).toContainText("photo.jpg", {
      timeout: 30_000,
    });
  });

  test("a video opens in VidTool's compress with the video loaded", async ({
    page,
  }) => {
    await page.goto("https://kmra.dev/");
    await drop(page, gen("vid-landscape.mp4"));
    await page
      .locator(".hub-match-tools a", { hasText: "Compress video" })
      .click();
    await expect(page).toHaveURL("https://vidtool.kmra.dev/compress");
    await expect(page.locator(".vt-details")).toContainText("1280 × 720", {
      timeout: 30_000,
    });
  });

  test("a JSON file opens in the JSON formatter with its text", async ({
    page,
  }) => {
    await page.goto("https://kmra.dev/");
    await drop(page, {
      name: "data.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"b":1,"a":[1,2]}'),
    } as never);
    await page
      .locator(".hub-match-tools a", { hasText: "JSON formatter" })
      .click();
    await expect(page).toHaveURL("https://devtool.kmra.dev/json-formatter");
    await expect(
      page.getByRole("textbox", { name: "Formatted" }),
    ).toHaveValue('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}');
  });

  test("an app's /handoff page may be framed by kmra.dev only (headers from the local servers)", async ({
    page,
  }) => {
    const res = await page.request.get("http://localhost:4602/handoff");
    expect(res.headers()["content-security-policy"]).toContain(
      "frame-ancestors https://kmra.dev",
    );
    const other = await page.request.get("http://localhost:4602/merge");
    expect(other.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    const hub = await page.request.get("http://localhost:4607/");
    expect(hub.headers()["content-security-policy"]).toContain(
      "frame-src https://*.kmra.dev",
    );
  });
});

test("all tools: search and app filter narrow the cards", async ({ page }) => {
  await page.goto("/tools");
  const cells = page.locator(".hub-cell:not([hidden])");
  const all = await cells.count();
  expect(all).toBeGreaterThan(100);
  await page.getByRole("button", { name: /^PDF/ }).click();
  await expect(cells).toHaveCount(14);
  await page.getByRole("button", { name: /^All/ }).click();
  await page.getByRole("searchbox", { name: "Search tools" }).fill("favicon");
  await expect(cells).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search tools" }).fill("zzzz");
  await expect(page.locator("#empty")).toBeVisible();
});

test("Bangla pages are translated and link to the apps' Bangla pages", async ({
  page,
}) => {
  await page.goto("/bn");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator("h1")).toHaveText("সব ধরনের ফাইলের জন্য ফ্রি টুল");
  await expect(
    page.locator('.hub-app[href="https://imgtool.kmra.dev/bn"]'),
  ).toHaveCount(1);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
    "href",
    "https://kmra.dev/",
  );
});

test("privacy, about, 404, icons, share images, sitemap and robots", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page.locator("main")).toContainText("is passed to the tool's site");
  await page.goto("/about");
  await expect(page.locator("main")).toContainText("video, QR codes, text in pictures and code");
  const nf = await page.request.get("/nope");
  expect(nf.status()).toBe(404);
  expect(await nf.text()).toContain("<title>Page not found · kmra.dev</title>");
  for (const p of ["/favicon.svg", "/favicon.ico", "/og/index.png", "/og/tools.png", "/manifest.webmanifest"]) {
    const r = await page.request.get(p);
    expect(r.status(), p).toBe(200);
  }
  const png = await page.request.get("/og/index.png");
  expect((await png.body()).subarray(1, 4).toString()).toBe("PNG");
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://kmra.dev/</loc>");
  expect(sitemap).toContain("<loc>https://kmra.dev/bn/tools</loc>");
  expect(sitemap).not.toContain("404");
  expect(await (await page.request.get("/robots.txt")).text()).toContain(
    "Sitemap: https://kmra.dev/sitemap.xml",
  );
  // The IndexNow key file is served like the apps'
  const key = readFileSync(
    new URL("../../apps/kmra/public/0f0695727b67e3fb00b1dc4dd4f0ff4f.txt", import.meta.url),
    "utf8",
  ).trim();
  expect(key).toBe("0f0695727b67e3fb00b1dc4dd4f0ff4f");
});

test("every app links back to kmra.dev (footer, Apps menu, more-tools)", async ({
  page,
}) => {
  for (const [id, port] of Object.entries(PORTS)) {
    if (id === "kmra.dev") continue;
    const home = await (await page.request.get(`http://localhost:${port}/`)).text();
    expect(home, id).toContain('href="https://kmra.dev/"');
    expect(home, id).toContain("Every app on kmra.dev");
    const more = await (
      await page.request.get(`http://localhost:${port}/more-tools`)
    ).text();
    expect(more, id).toContain("Drop any file on kmra.dev");
  }
  // Bangla pages link to the hub's Bangla home
  const bn = await (await page.request.get("http://localhost:4601/bn")).text();
  expect(bn).toContain('href="https://kmra.dev/bn"');
});

test("each app shows 2 other apps above the footer and 3 more in it: 5 different, never itself", async ({
  page,
}) => {
  for (const [host, port] of Object.entries(PORTS)) {
    if (host === "kmra.dev") continue;
    await page.goto(`http://localhost:${port}/`);
    const host_ = (h: string) => new URL(h).hostname;
    const cta = await page
      .locator(".cta-more-app")
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    const foot = await page
      .locator(".fapps a:not(.fmore)")
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    expect(cta, host).toHaveLength(2);
    expect(foot, host).toHaveLength(3);
    const all = [...cta, ...foot].map(host_);
    expect(new Set(all).size, host).toBe(5);
    expect(all, host).not.toContain(host);
  }
});
