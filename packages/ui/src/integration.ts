/**
 * Build step shared by every kmra app. After `astro build` it writes:
 * - /sitemap.xml from the pages that were actually built (404 and noindex pages left out)
 * - /sw.js, a service worker that precaches every page and asset so tools work offline.
 *   Large files (AI models, OG images) are cached the first time they're used instead.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** "compress.html" → "/compress", "index.html" → "/", "bn/index.html" → "/bn" */
function cleanUrl(file: string): string {
  const path = "/" + file.replace(/\\/g, "/").replace(/\.html$/, "");
  if (path === "/index") return "/";
  return path.replace(/\/index$/, "");
}

// Not precached: social images, AI models and anything big (cached on first use instead)
const SKIP = [
  /^test-fixtures\//,
  /^og\//,
  /^models\//,
  // pdf.js CMaps and fonts: cached when first used instead (only some PDFs need them)
  /^pdfjs\//,
  // OCR language data (one file per language, 0.4–4 MB): downloaded when a language is first
  // picked and kept by the OCR engine
  /^tesseract\/lang\//,
  // ffmpeg.wasm core (~31 MB, video tools): loaded only by jobs that need it, cached then
  /^ffmpeg\//,
  // Bengali font files: only Bangla pages need them, and only the glyphs they use
  /noto-sans-bengali/,
  /\.(onnx|wasm|map)$/,
  /^sw\.js$/,
  /^sitemap/,
  /^robots\.txt$/,
  /^404\.html$/,
];
const MAX_PRECACHE_BYTES = 2_000_000;

export function kmraBuild({
  origin,
  maxPrecache = MAX_PRECACHE_BYTES,
}: {
  origin: string;
  /**
   * Largest file precached for offline use. Apps with heavy per-tool libraries (devtool's
   * formatters) set it low: those load on first use and are cached then.
   */
  maxPrecache?: number;
}): AstroIntegration {
  return {
    name: "kmra-build",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = (await walk(root)).map((f) =>
          relative(root, f).replace(/\\/g, "/"),
        );

        // Sitemap
        const pages: string[] = [];
        for (const f of files.filter(
          (f) => f.endsWith(".html") && f !== "404.html",
        )) {
          const html = await readFile(join(root, f), "utf8");
          if (/<meta name="robots" content="noindex/.test(html)) continue;
          pages.push(cleanUrl(f));
        }
        pages.sort();
        const today = new Date().toISOString().slice(0, 10);
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          pages
            .map(
              (p) =>
                `  <url><loc>${new URL(p, origin).toString().replace(/\/$/, p === "/" ? "/" : "")}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${p === "/" ? "1.0" : "0.8"}</priority></url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;
        await writeFile(join(root, "sitemap.xml"), xml);

        // Service worker precache list
        const precache: string[] = [];
        const hash = createHash("sha256");
        for (const f of files.sort()) {
          if (SKIP.some((re) => re.test(f))) continue;
          const size = (await stat(join(root, f))).size;
          if (size > maxPrecache) continue;
          precache.push(f.endsWith(".html") ? cleanUrl(f) : "/" + f);
          hash.update(f + ":" + size);
        }
        const version = hash.digest("hex").slice(0, 12);
        await writeFile(join(root, "sw.js"), serviceWorker(version, precache));
        logger.info(
          `sitemap.xml: ${pages.length} pages; sw.js: ${precache.length} files precached (v${version})`,
        );
      },
    },
  };
}

function serviceWorker(version: string, precache: string[]): string {
  return `// Generated at build time. Makes every kmra page and tool work offline.
const VERSION = ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(precache)};
const STATIC = "kmra-static-" + VERSION;
const RUNTIME = "kmra-runtime";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then(async (cache) => {
      // Cache one by one so a single failure doesn't abort the whole install
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("kmra-static-") && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/_vercel/")) return;

  // Pages: fresh from the network when online, cached copy when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(STATIC).then((c) => c.put(url.pathname, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  // Assets, models and images: cache first, then network (and keep a copy)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") caches.open(RUNTIME).then((c) => c.put(req, res.clone()));
          return res;
        }),
    ),
  );
});
`;
}
