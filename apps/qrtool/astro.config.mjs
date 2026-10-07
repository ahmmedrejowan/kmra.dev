// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { appOrigin } from "@kmra/registry";
import { kmraBuild } from "@kmra/ui/integration";

export default defineConfig({
  site: appOrigin("qrtool"),
  trailingSlash: "never",
  build: { format: "file" },
  server: { port: 4325 },
  integrations: [react(), kmraBuild({ origin: appOrigin("qrtool") })],
  vite: {
    plugins: [tailwindcss()],
    // ES-module workers can lazy-load heavy decoders as separate chunks
    worker: { format: "es" },
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
