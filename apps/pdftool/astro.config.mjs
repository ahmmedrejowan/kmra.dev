// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { appOrigin } from "@kmra/registry";

export default defineConfig({
  site: appOrigin("pdftool"),
  trailingSlash: "never",
  build: { format: "file" },
  server: { port: 4322 },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
