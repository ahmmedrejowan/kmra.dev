import { routes, type VercelConfig } from "@vercel/config/v1";

/**
 * Content-Security-Policy shared by every app.
 * `connect-src 'self' blob: data:` is what enforces "files never leave your device":
 * the page cannot send requests to any other host. Bundle libraries (WASM, workers) from npm
 * instead of loading them from a CDN; if a third-party origin is ever truly needed, add it here
 * deliberately.
 */
const CSP = [
  "default-src 'self'",
  // Astro inlines small island bootstrap scripts; WASM codecs need wasm-unsafe-eval.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Vercel project config for a static Astro app in apps/<id>. */
export function appConfig(opts: { camera?: boolean } = {}): VercelConfig {
  return {
    framework: "astro",
    buildCommand: "turbo run build",
    outputDirectory: "dist",
    cleanUrls: true,
    trailingSlash: false,
    headers: [
      routes.header("/(.*)", [
        { key: "Content-Security-Policy", value: CSP },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          // Only apps that scan with the camera (QR) may ask for it, and only for themselves
          value: `camera=${opts.camera ? "(self)" : "()"}, microphone=(), geolocation=(), interest-cohort=()`,
        },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ]),
      // The service worker must always be re-checked so new deploys reach offline users.
      routes.cacheControl("/sw.js", {
        public: true,
        maxAge: "0s",
        mustRevalidate: true,
      }),
      // Generated OG images and icons change only on deploy.
      routes.cacheControl("/og/(.*)", { public: true, maxAge: "1 day" }),
      routes.cacheControl(
        "/(favicon.ico|favicon.svg|apple-touch-icon.png|icon-192.png|icon-512.png|icon-maskable-512.png)",
        {
          public: true,
          maxAge: "1 day",
        },
      ),
      // Astro emits content-hashed assets here.
      routes.cacheControl("/_astro/(.*)", {
        public: true,
        maxAge: "1 year",
        immutable: true,
      }),
    ],
  };
}
