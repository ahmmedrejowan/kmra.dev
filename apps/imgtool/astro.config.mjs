// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { appOrigin } from "@kmra/registry";

export default defineConfig({
  site: appOrigin("imgtool"),
  server: { port: 4321 },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
