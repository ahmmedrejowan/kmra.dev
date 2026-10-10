/**
 * Serves a built app (apps/<id>/dist) the way Vercel does, so end-to-end tests see production:
 * clean URLs (/merge -> merge.html), 404.html for missing pages, and the real security headers
 * (CSP included, so a tool that tried to reach another host would fail here too).
 *
 *   node tests/serve.ts <appId> <port>
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import {
  CSP,
  CSP_HANDOFF,
  HANDOFF_PATH,
  HUB_FRAMES,
  csp,
  permissionsPolicy,
} from "../packages/config/src/vercel.ts";

const [appId, portArg] = process.argv.slice(2);
if (!appId || !portArg) throw new Error("usage: serve.ts <appId> <port>");
const root = join(import.meta.dirname, "..", "apps", appId, "dist");
// Same per-app permissions as each app's vercel.ts
const camera = appId === "qrtool";
const screen = appId === "vidtool";
const mic = appId === "audiotool" || appId === "musictool";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".ttf": "font/ttf",
};

const HEADERS = {
  "Content-Security-Policy":
    appId === "kmra" ? csp({ frameSrc: HUB_FRAMES }) : CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": permissionsPolicy({ camera, screen, mic }),
  "Cross-Origin-Opener-Policy": "same-origin",
};
// The page the hub frames to hand a file over: framed by kmra.dev only, no COOP
const { "Cross-Origin-Opener-Policy": _, ...rest } = HEADERS;
const HANDOFF_HEADERS = { ...rest, "Content-Security-Policy": CSP_HANDOFF };

async function file(path: string): Promise<string | null> {
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch {
    return null;
  }
}

async function resolve(urlPath: string): Promise<string | null> {
  const clean = normalize(decodeURIComponent(urlPath)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  const base = join(root, clean);
  if (!base.startsWith(root)) return null;
  return (
    (await file(base)) ??
    (await file(`${base}.html`)) ??
    (await file(join(base, "index.html")))
  );
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  // Vercel Web Analytics only exists on Vercel; answer with an empty script
  if (url.pathname.startsWith("/_vercel/")) {
    res.writeHead(200, { ...HEADERS, "Content-Type": "text/javascript" });
    return res.end("");
  }
  let path = await resolve(url.pathname);
  let status = 200;
  if (!path) {
    path = join(root, "404.html");
    status = 404;
  }
  try {
    const body = await readFile(path);
    res.writeHead(status, {
      ...(url.pathname === HANDOFF_PATH ? HANDOFF_HEADERS : HEADERS),
      "Content-Type": TYPES[extname(path)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(500).end();
  }
}).listen(Number(portArg), () =>
  console.log(`${appId}: http://localhost:${portArg}`),
);
