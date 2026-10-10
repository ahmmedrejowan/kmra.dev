// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { appOrigin } from "@kmra/registry";
import { kmraBuild } from "@kmra/ui/integration";

export default defineConfig({
  site: appOrigin("musictool"),
  trailingSlash: "never",
  build: { format: "file" },
  // English at the root, other languages under a prefix (/bn/...). Keep in sync with the
  // registry's musictool `locales` and @kmra/ui's LOCALES.
  i18n: {
    locales: ["en", "bn"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  server: { port: 4330 },
  integrations: [
    react(),
    kmraBuild({ origin: appOrigin("musictool"), maxPrecache: 150_000 }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // ES-module workers can lazy-load heavy decoders as separate chunks
    worker: { format: "es" },
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
