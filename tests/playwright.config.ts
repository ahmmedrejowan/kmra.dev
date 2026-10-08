import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production builds (run `pnpm build` first, or `pnpm test:e2e`
 * which builds). Each app is served by tests/serve.ts with Vercel's URL rules and headers.
 */
const APPS = [
  { id: "imgtool", port: 4601 },
  { id: "pdftool", port: 4602 },
  { id: "qrtool", port: 4603 },
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
  projects: APPS.map((a) => ({
    name: a.id,
    testDir: ".",
    // The app's own folder, plus its hard-input specs (tests/hard/<app>-*.spec.ts)
    testMatch: new RegExp(`/(${a.id}/.+|hard/${a.id}-[^/]+)\\.spec\\.ts$`),
    use: { baseURL: `http://localhost:${a.port}` },
  })),
  webServer: APPS.map((a) => ({
    command: `node tests/serve.ts ${a.id} ${a.port}`,
    cwd: "..",
    url: `http://localhost:${a.port}/`,
    reuseExistingServer: !process.env.CI,
  })),
});
