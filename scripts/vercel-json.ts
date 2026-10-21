/**
 * Writes each site's apps/<id>/vercel.json from appConfig() in packages/config.
 *
 * Vercel reads vercel.json before it starts a deployment, which is what makes the branch rules
 * (git.deploymentEnabled) and the ignore command work. A vercel.ts is compiled only inside the
 * build, too late for both: every branch push built every site.
 *
 *   node scripts/vercel-json.ts          write the files
 *   node scripts/vercel-json.ts --check  fail when a file is out of date (pull request checks)
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { format } from "prettier";
import { APP_OPTIONS, appConfig } from "../packages/config/src/vercel.ts";

const APPS = join(import.meta.dirname, "..", "apps");
const check = process.argv.includes("--check");
let stale = 0;

for (const id of readdirSync(APPS).sort()) {
  if (!existsSync(join(APPS, id, "package.json"))) continue;
  const path = join(APPS, id, "vercel.json");
  // Formatted as the repo's Prettier would, so format checks agree with this one
  const json = await format(
    JSON.stringify({
      $schema: "https://openapi.vercel.sh/vercel.json",
      ...appConfig(APP_OPTIONS[id] ?? {}),
    }),
    { parser: "json" },
  );
  const now = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (now === json) continue;
  if (check) {
    console.error(`apps/${id}/vercel.json is out of date`);
    stale++;
  } else {
    writeFileSync(path, json);
    console.log(`wrote apps/${id}/vercel.json`);
  }
}

if (stale) {
  console.error("Run `pnpm vercel:json` and commit the result.");
  process.exit(1);
}
