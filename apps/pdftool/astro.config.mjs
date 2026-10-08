// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { appOrigin } from "@kmra/registry";
import { kmraBuild } from "@kmra/ui/integration";
import { cpSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// pdf.js loads CMaps, standard fonts, ICC profiles and small wasm decoders at runtime.
// Serve them from this site (the CSP allows nothing else): copy them into public/pdfjs (git-ignored).
const pdfjsDir = dirname(
  createRequire(import.meta.url).resolve("pdfjs-dist/package.json"),
);
for (const sub of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const from = join(pdfjsDir, sub);
  if (existsSync(from))
    cpSync(from, new URL(`./public/pdfjs/${sub}`, import.meta.url).pathname, {
      recursive: true,
    });
}

export default defineConfig({
  site: appOrigin("pdftool"),
  trailingSlash: "never",
  build: { format: "file" },
  // English at the root, other languages under a prefix (/bn/...). Keep in sync with the
  // registry's pdftool `locales` and @kmra/ui's LOCALES.
  i18n: {
    locales: ["en", "bn"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  server: { port: 4322 },
  integrations: [react(), kmraBuild({ origin: appOrigin("pdftool") })],
  vite: {
    plugins: [tailwindcss()],
    // ES-module workers can lazy-load heavy decoders (HEIC, AI models) as separate chunks
    worker: { format: "es" },
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
