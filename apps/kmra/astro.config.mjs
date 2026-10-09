// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { HUB, hubOrigin } from "@kmra/registry";
import { kmraBuild } from "@kmra/ui/integration";

// kmra.dev: the hub that lists every kmra app. English at the root, Bangla under /bn; keep in
// sync with HUB.locales in the registry.
export default defineConfig({
  site: hubOrigin(),
  trailingSlash: "never",
  build: { format: "file" },
  i18n: {
    locales: ["en", "bn"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  server: { port: HUB.devPort },
  integrations: [react(), kmraBuild({ origin: hubOrigin() })],
  vite: {
    plugins: [tailwindcss()],
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
