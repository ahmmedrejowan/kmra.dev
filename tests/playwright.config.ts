import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production builds (run `pnpm build` first, or `pnpm test:e2e`
 * which builds). Each app is served by tests/serve.ts with Vercel's URL rules and headers.
 */
const APPS = [
  { id: "imgtool", port: 4601 },
  { id: "pdftool", port: 4602 },
  { id: "qrtool", port: 4603 },
  { id: "devtool", port: 4604 },
  { id: "ocrtool", port: 4605 },
  { id: "vidtool", port: 4606 },
  { id: "kmra", port: 4607 },
  { id: "audiotool", port: 4608 },
  { id: "calctool", port: 4609 },
  { id: "colortool", port: 4610 },
  { id: "musictool", port: 4611 },
] as const;

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./fixtures/make.ts",
  use: {
    ...devices["Desktop Chrome"],
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [
    ...APPS.map((a) => ({
      name: a.id,
      testDir: ".",
      // The app's own folder, plus its hard-input specs (tests/hard/<app>-*.spec.ts)
      testMatch: new RegExp(`/(${a.id}/.+|hard/${a.id}-[^/]+)\\.spec\\.ts$`),
      use: { baseURL: `http://localhost:${a.port}` },
    })),
    // The image tools' everyday tests again in Firefox and Safari's engine (WebKit): their
    // decoders, encoders and canvas differ from Chromium's. Run with --project=imgtool-firefox
    // or imgtool-webkit.
    ...(
      [
        ["imgtool-firefox", "Desktop Firefox"],
        ["imgtool-webkit", "Desktop Safari"],
      ] as const
    ).map(([name, device]) => ({
      name,
      testDir: ".",
      testMatch:
        /\/imgtool\/(basics|controls|effects|compress-ui|strip|workspace|tasks)\.spec\.ts$/,
      use: { ...devices[device], baseURL: "http://localhost:4601" },
    })),
  ],
  webServer: APPS.map((a) => ({
    command: `node tests/serve.ts ${a.id} ${a.port}`,
    cwd: "..",
    url: `http://localhost:${a.port}/`,
    reuseExistingServer: !process.env.CI,
  })),
});
