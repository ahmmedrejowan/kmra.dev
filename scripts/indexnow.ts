/**
 * Tell IndexNow search engines (Bing, Yandex, Seznam, Naver…) about every page, from the live
 * sitemaps. Run after a deploy that adds or changes pages:
 *
 *   pnpm indexnow            # all live apps
 *   pnpm indexnow devtool    # one app
 *   pnpm indexnow kmra       # the hub, kmra.dev
 */
import { apps, HUB, INDEXNOW_KEY } from "../packages/registry/src/index.ts";

const only = process.argv[2];
const hosts = [
  ...apps.filter((a) => a.live).map((a) => ({ id: a.id, host: `${a.id}.kmra.dev` })),
  ...(HUB.live ? [{ id: HUB.id, host: "kmra.dev" }] : []),
];
for (const { host } of hosts.filter((h) => !only || h.id === only)) {
  const xml = await (await fetch(`https://${host}/sitemap.xml`)).text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });
  console.log(
    `${host}: ${urlList.length} URLs -> ${res.status} ${res.statusText}`,
  );
}
