import { routes, type VercelConfig } from "@vercel/config/v1";

/**
 * Content-Security-Policy shared by every app.
 * `connect-src 'self' blob: data:` is what enforces "files never leave your device":
 * the page cannot send requests to any other host. Bundle libraries (WASM, workers) from npm
 * instead of loading them from a CDN; if a third-party origin is ever truly needed, add it here
 * deliberately.
 */
export function csp(
  opts: { frameAncestors?: string[]; frameSrc?: string[] } = {},
): string {
  return [
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
    // Only the hub frames other sites: each app's /handoff page, to pass a dropped file over
    ...(opts.frameSrc ? [`frame-src ${opts.frameSrc.join(" ")}`] : []),
    `frame-ancestors ${opts.frameAncestors?.join(" ") ?? "'none'"}`,
  ].join("; ");
}

export const CSP = csp();

/**
 * Each app's /handoff page may be framed by kmra.dev only: the hub stores a dropped file in the
 * app's own storage through it, then opens the tool (see apps/kmra). Nothing is uploaded.
 */
export const HANDOFF_PATH = "/handoff";
export const CSP_HANDOFF = csp({ frameAncestors: ["https://kmra.dev"] });
/** What the hub may frame: the apps' /handoff pages */
export const HUB_FRAMES = ["https://*.kmra.dev"];

/**
 * Permissions-Policy for an app: the camera only for apps that scan with it (QR), screen capture
 * and the microphone only for apps that record (video), the microphone alone for the voice
 * recorder (audio), each for the site itself only.
 */
export function permissionsPolicy(
  opts: { camera?: boolean; screen?: boolean; mic?: boolean } = {},
): string {
  return [
    `camera=${opts.camera ? "(self)" : "()"}`,
    `microphone=${opts.screen || opts.mic ? "(self)" : "()"}`,
    ...(opts.screen ? ["display-capture=(self)"] : []),
    "geolocation=()",
    "interest-cohort=()",
  ].join(", ");
}

/** Vercel project config for a static Astro app in apps/<id>. */
export function appConfig(
  opts: {
    camera?: boolean;
    screen?: boolean;
    mic?: boolean;
    /** The hub: frames the apps' /handoff pages (HUB_FRAMES) */
    hub?: boolean;
  } = {},
): VercelConfig {
  const common = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: permissionsPolicy(opts) },
  ];
  return {
    framework: "astro",
    buildCommand: "turbo run build",
    // Only main is deployed. Pull request branches are checked by GitHub Actions instead, so they
    // don't spend deployments (the free plan allows 100 a day, and every push starts one per app).
    git: {
      deploymentEnabled: {
        "feat/**": false,
        "fix/**": false,
        "docs/**": false,
        "chore/**": false,
        "ci/**": false,
        "test/**": false,
        "refactor/**": false,
        "dependabot/**": false,
      },
    },
    // Skip the build (exit 0) on any branch but main, and on main when a push doesn't touch this
    // app or the shared packages. Runs in apps/<id>; a non-zero exit means "build".
    ignoreCommand:
      '[ "$VERCEL_GIT_COMMIT_REF" != "main" ] || git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ../../packages ../../pnpm-lock.yaml',
    outputDirectory: "dist",
    cleanUrls: true,
    trailingSlash: false,
    headers: [
      routes.header("/((?!handoff$).*)", [
        {
          key: "Content-Security-Policy",
          value: opts.hub ? csp({ frameSrc: HUB_FRAMES }) : CSP,
        },
        ...common,
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ]),
      routes.header(HANDOFF_PATH, [
        { key: "Content-Security-Policy", value: CSP_HANDOFF },
        ...common,
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
