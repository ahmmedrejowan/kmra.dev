/**
 * Layout sweep (a dev check, not part of the test run): every ready tool, with a file loaded where it takes one,
 * clicks through the settings and reports when the editor card's height or the preview moves.
 *   npx tsx tests/layout-sweep.ts [app…]   (after pnpm build)
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { getApp } from "../packages/registry/src/index.ts";

const APPS = [
  "imgtool",
  "pdftool",
  "qrtool",
  "devtool",
  "ocrtool",
  "vidtool",
  "audiotool",
  "calctool",
  "colortool",
  "musictool",
];
const pick = process.argv.slice(2);
const apps = pick.length ? APPS.filter((a) => pick.includes(a)) : APPS;
const G = (f: string) => `${import.meta.dirname}/fixtures/gen/${f}`;

/** A file for the tool (null = the tool doesn't take files) */
function fixture(app: string, slug: string): string | string[] | null {
  if (app === "imgtool") {
    if (slug === "gif-frames") return G("anim.gif");
    if (slug === "signature") return G("signature.jpg");
    if (slug === "exif") return G("exif.jpg");
    if (slug === "collage")
      return [G("photo.jpg"), G("photo-wide.png"), G("photo-tall.png")];
    return G("photo.jpg");
  }
  if (app === "pdftool")
    return slug === "from-image"
      ? G("photo.jpg")
      : slug === "merge"
        ? [G("text6.pdf"), G("landscape2.pdf")]
        : G("text6.pdf");
  if (app === "vidtool") {
    if (slug === "screen-recorder") return null;
    if (slug === "gif-to-video") return G("vid-anim.gif");
    if (slug === "merge") return [G("vid-part1.mp4"), G("vid-part2.mp4")];
    return G("vid-landscape.mp4");
  }
  if (app === "audiotool") {
    if (slug === "voice-recorder") return null;
    if (slug === "video-to-audio") return G("vid-landscape.mp4");
    if (slug === "merge") return [G("aud-part1.mp3"), G("aud-part2.mp3")];
    return G("aud-tone.mp3");
  }
  if (app === "ocrtool")
    return slug.includes("pdf") ? G("ocr-text.pdf") : G("ocr-screenshot.png");
  if (app === "qrtool")
    return ["scanner", "batch-scanner", "checker", "fix-qr"].includes(slug)
      ? G("qr-link.png")
      : null;
  return null;
}

const SKIP =
  /download|copy|save|remove|delete|clear|record|start|stop|^play|pause|camera|choose|^\+ ?add|add files|open|share|print|undo|redo|reset|advanced|simple|paste|sample|zip|run|read|scan|tap|listen|send|next|previous|reveal/i;

const SNAP = `(() => {
  const card = document.querySelector(".tool-area :is(.toolcard, .calc-card, .mt-card, .ct-card, .devcard)");
  if (!card) return null;
  const stage = card.querySelector(":scope > .stage, .calc-out, .mt-stage, .ct-main, .dev-panes, .stage");
  const vis = stage ? stage.querySelector("img, canvas, video, svg, .cmp, output") : null;
  const r = (e) => {
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return [Math.round(b.top + scrollY), Math.round(b.height), Math.round(b.left), Math.round(b.width)];
  };
  return { kind: card.className.split(" ")[0], card: r(card), stage: r(stage), vis: r(vis) };
})()`;
async function snap(page: Page): Promise<{
  kind: string;
  card: number[] | null;
  stage: number[] | null;
  vis: number[] | null;
} | null> {
  return page.evaluate(SNAP);
}

const port = 4900;
const procs = apps.map((a, i) =>
  spawn("node", ["tests/serve.ts", a, String(port + i)], { stdio: "ignore" }),
);
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await ctx.grantPermissions([]);
const report: string[] = [];
try {
  for (const [i, app] of apps.entries()) {
    const base = `http://localhost:${port + i}`;
    for (const tool of getApp(app as never).tools.filter((t) => t.ready)) {
      const page = await ctx.newPage();
      page.on("dialog", (d) => d.dismiss());
      try {
        await page.goto(`${base}/${tool.slug}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        const f = fixture(app, tool.slug);
        if (f) {
          const input = page.locator(".tool-area input[type=file]").first();
          if (await input.count()) {
            await input.setInputFiles(f);
            await page.waitForTimeout(
              app === "vidtool" ||
                app === "audiotool" ||
                app === "ocrtool" ||
                app === "pdftool"
                ? 3500
                : 1800,
            );
          }
        }
        const first = await snap(page);
        if (!first) {
          report.push(`${app}/${tool.slug}: no card found`);
          continue;
        }
        // Every clickable setting in the card, in order
        const handles = await page
          .locator(
            ".tool-area :is(.toolcard, .calc-card, .mt-card, .ct-card, .devcard) :is(button, [role=switch], input[type=checkbox], input[type=radio])",
          )
          .all();
        let clicks = 0;
        const moves: string[] = [];
        for (const h of handles) {
          if (clicks >= 45) break;
          try {
            if (!(await h.isVisible()) || !(await h.isEnabled())) continue;
            const label = (
              (await h.getAttribute("aria-label")) ||
              (await h.innerText().catch(() => "")) ||
              ""
            )
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 40);
            if (!label || SKIP.test(label)) continue;
            // Only settings outside the preview itself
            const inStage = await h.evaluate(
              new Function(
                "e",
                'return !!e.closest(".stage, .mt-stage, .ct-main, .zoombar, .filebar, .viewport")',
              ) as (e: Element) => boolean,
            );
            if (inStage) continue;
            const before = await snap(page);
            await h.click({ timeout: 2000 });
            clicks++;
            await page.waitForTimeout(
              app === "vidtool" || app === "audiotool" ? 900 : 450,
            );
            const after = await snap(page);
            if (!before || !after) continue;
            const d = (a: number[] | null, b: number[] | null) =>
              a && b
                ? Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!))
                : 0;
            const dc = d(before.card, after.card);
            const ds = d(before.stage, after.stage);
            const dv = d(before.vis, after.vis);
            if (dc > 2 || ds > 2 || dv > 2)
              moves.push(
                `"${label}" card ${before.card?.[1]}→${after.card?.[1]} stage ${before.stage?.[1]}→${after.stage?.[1]} preview Δ${dv}`,
              );
          } catch {
            // detached or covered: skip
          }
        }
        report.push(
          `${app}/${tool.slug} [${first.kind}] card h ${first.card?.[1]} stage h ${first.stage?.[1]} · ${clicks} clicks${moves.length ? "\n    " + moves.slice(0, 6).join("\n    ") + (moves.length > 6 ? `\n    …${moves.length - 6} more` : "") : " · steady"}`,
        );
      } catch (e) {
        report.push(
          `${app}/${tool.slug}: error ${(e as Error).message.split("\n")[0]}`,
        );
      } finally {
        await page.close();
      }
    }
    console.log(report.filter((l) => l.startsWith(app + "/")).join("\n"));
  }
} finally {
  await browser.close();
  for (const p of procs) p.kill();
}
