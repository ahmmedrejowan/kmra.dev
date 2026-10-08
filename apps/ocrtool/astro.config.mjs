// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { appOrigin } from "@kmra/registry";
import { kmraBuild } from "@kmra/ui/integration";
import {
  cpSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

// -- pdf.js assets (PDF tools) --
// pdf.js loads CMaps, standard fonts, ICC profiles and small wasm decoders at runtime. Serve them
// from this site (the CSP allows nothing else): copy them into public/pdfjs (git-ignored).
const pdfjsDir = dirname(require.resolve("pdfjs-dist/package.json"));
for (const sub of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const from = join(pdfjsDir, sub);
  if (existsSync(from))
    cpSync(from, new URL(`./public/pdfjs/${sub}`, import.meta.url).pathname, {
      recursive: true,
    });
}
// -- end pdf.js assets --

// -- tesseract.js assets (document engine) --
// tesseract.js loads its worker script, its wasm core and the language data at runtime. Serve them
// from this site: the worker and cores are copied into public/tesseract (git-ignored). Only the
// LSTM cores are used (OEM 1); the browser picks plain, SIMD or relaxed-SIMD. Language data
// ("best_int" LSTM models, gzipped) is committed in public/tesseract/lang, so builds don't
// install the large @tesseract.js-data packages.
{
  const out = new URL("./public/tesseract/", import.meta.url).pathname;
  const tjs = dirname(require.resolve("tesseract.js/package.json"));
  const core = dirname(
    createRequire(join(tjs, "package.json")).resolve(
      "tesseract.js-core/package.json",
    ),
  );
  const copy = (/** @type {string} */ from, /** @type {string} */ to) => {
    if (existsSync(to) && statSync(to).size === statSync(from).size) return;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  };
  copy(join(tjs, "dist/worker.min.js"), join(out, "worker.min.js"));
  // The worker the app starts: Tesseract writes notes ("Warning: Parameter not found", "Empty
  // page!!") to stderr, which shows as console errors; keep those as debug messages.
  writeFileSync(
    join(out, "ocr-worker.js"),
    `const NOTE = /^(Warning:|Empty page|Estimating resolution|Detected \\d+ diacritics|Image too small|Line cannot be recognized|Too few characters)/;
const error = console.error.bind(console);
console.error = (...a) => (typeof a[0] === "string" && NOTE.test(a[0]) ? console.debug(...a) : error(...a));
importScripts("./worker.min.js");
`,
  );
  for (const f of ["", "-simd", "-relaxedsimd"])
    copy(
      join(core, `tesseract-core${f}-lstm.wasm.js`),
      join(out, `core/tesseract-core${f}-lstm.wasm.js`),
    );
}
// -- end tesseract.js assets --

export default defineConfig({
  site: appOrigin("ocrtool"),
  trailingSlash: "never",
  build: { format: "file" },
  // English at the root, other languages under a prefix (/bn/...). Keep in sync with the
  // registry's ocrtool `locales` and @kmra/ui's LOCALES.
  i18n: {
    locales: ["en", "bn"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  server: { port: 4326 },
  integrations: [react(), kmraBuild({ origin: appOrigin("ocrtool") })],
  vite: {
    plugins: [tailwindcss()],
    // ES-module workers can lazy-load heavy decoders as separate chunks
    worker: { format: "es" },
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
