/**
 * Tell IndexNow search engines (Bing, Yandex, Seznam, Naver…) about every page, from the live
 * sitemaps. Run after a deploy that adds or changes pages:
 *
 *   pnpm indexnow            # all live apps
 *   pnpm indexnow devtool    # one app
 */
import { apps, INDEXNOW_KEY } from "../packages/registry/src/index.ts";

const only = process.argv[2];
for (const app of apps.filter((a) => a.live && (!only || a.id === only))) {
  const host = `${app.id}.kmra.dev`;
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
