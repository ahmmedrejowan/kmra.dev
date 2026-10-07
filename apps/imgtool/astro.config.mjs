// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { appOrigin } from "@kmra/registry";
import { kmraBuild } from "@kmra/ui/integration";

export default defineConfig({
  site: appOrigin("imgtool"),
  trailingSlash: "never",
  build: { format: "file" },
  server: { port: 4321 },
  integrations: [react(), kmraBuild({ origin: appOrigin("imgtool") })],
  vite: {
    plugins: [tailwindcss()],
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
