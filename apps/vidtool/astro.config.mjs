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

// -- ffmpeg.wasm core (the compatible video engine in @kmra/media) --
// The core's JS and wasm (~31 MB) are served from this site (the CSP allows nothing else): copied
// from node_modules into public/ffmpeg (git-ignored) and cached by the browser on first use (the
// service worker doesn't precache them). Single-threaded core only: the multi-threaded one
// (@ffmpeg/core-mt 0.12.10) needs cross-origin isolation (COEP) and hung on every encode in
// testing (Oct 2026). To try it again: add @ffmpeg/core-mt to @kmra/media, set FFMPEG_MT, and send
// COEP on this app; @kmra/media picks up public/ffmpeg/mt by itself when the page is isolated.
const FFMPEG_MT = false;
{
  const media = createRequire(
    createRequire(import.meta.url).resolve("@kmra/media/package.json"),
  );
  const out = new URL("./public/ffmpeg/", import.meta.url).pathname;
  const copy = (/** @type {string} */ from, /** @type {string} */ to) => {
    if (existsSync(to) && statSync(to).size === statSync(from).size) return;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  };
  const cores = /** @type {[string, string][]} */ ([
    ["@ffmpeg/core", ""],
    ...(FFMPEG_MT ? [["@ffmpeg/core-mt", "mt/"]] : []),
  ]);
  for (const [pkg, sub] of cores) {
    // The packages export only their entry (CommonJS → dist/umd); the ES build sits next to it
    const dist = join(dirname(media.resolve(pkg)), "../esm");
    for (const f of [
      "ffmpeg-core.js",
      "ffmpeg-core.wasm",
      "ffmpeg-core.worker.js",
    ])
      if (existsSync(join(dist, f))) copy(join(dist, f), join(out, sub, f));
  }
  writeFileSync(
    join(out, "NOTICE.txt"),
    `This folder holds ffmpeg.wasm (https://github.com/ffmpegwasm/ffmpeg.wasm), a WebAssembly build of
FFmpeg (https://ffmpeg.org), unmodified from the npm packages @ffmpeg/core${FFMPEG_MT ? " and @ffmpeg/core-mt" : ""}.
FFmpeg and this build are licensed under the GNU General Public License, version 2 or later
(https://www.gnu.org/licenses/old-licenses/gpl-2.0.html). The complete source is available at
https://github.com/ffmpegwasm/ffmpeg.wasm (build scripts) and https://ffmpeg.org/download.html.
`,
  );
}
// -- end ffmpeg.wasm core --

export default defineConfig({
  site: appOrigin("vidtool"),
  trailingSlash: "never",
  build: { format: "file" },
  // English at the root, other languages under a prefix (/bn/...). Keep in sync with the
  // registry's vidtool `locales` and @kmra/ui's LOCALES.
  i18n: {
    locales: ["en", "bn"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  server: { port: 4323 },
  integrations: [react(), kmraBuild({ origin: appOrigin("vidtool") })],
  vite: {
    plugins: [tailwindcss()],
    // ES-module workers can lazy-load heavy decoders as separate chunks
    worker: { format: "es" },
    // @ffmpeg/ffmpeg starts its worker with new URL(..., import.meta.url); pre-bundling breaks that
    optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] },
    // Native image renderer used by build-time OG/icon routes
    ssr: { external: ["@resvg/resvg-js", "satori"] },
  },
});
