/**
 * Images for the GitHub repository: the social preview (1280 × 640, upload it in the repo's
 * Settings → Social preview) and the README banner. Drawn with the same marks and font as the
 * sites' own preview images.
 *
 *   npx tsx scripts/repo-images.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { apps, getApp, HUB } from "../packages/registry/src/index.ts";
import { markSvg } from "../packages/ui/src/lib/brand.ts";

// satori and resvg are dependencies of the apps, not of the repo root
const req = createRequire(join(process.cwd(), "apps/imgtool/package.json"));
const satori = (req("satori") as { default: typeof import("satori").default })
  .default;
const { Resvg } = req("@resvg/resvg-js") as typeof import("@resvg/resvg-js");

const font = (w: number) =>
  readFile(
    join(
      process.cwd(),
      `packages/ui/node_modules/@fontsource/geist/files/geist-latin-${w}-normal.woff`,
    ),
  );
const fonts = await Promise.all(
  ([400, 600, 700] as const).map(async (weight) => ({
    name: "Geist",
    data: await font(weight),
    weight,
    style: "normal" as const,
  })),
);

type Node = { type: string; props: Record<string, unknown> };
const h = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
  extra: Record<string, unknown> = {},
): Node => ({
  type,
  props: { style, children, ...extra },
});
const img = (svg: string, size: number): Node =>
  h("img", { width: size, height: size }, undefined, {
    src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    width: size,
    height: size,
  });

const live = apps.filter((a) => a.live).map((a) => getApp(a.id));
const tools = live.reduce(
  (n, a) => n + a.tools.filter((t) => t.ready).length,
  0,
);
const INK = "#18181b";
const MUTED = "#52525b";

function tree(w: number, h_: number): Node {
  return h(
    "div",
    {
      width: w,
      height: h_,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "64px 72px",
      background: "#ffffff",
      fontFamily: "Geist",
      color: INK,
    },
    [
      // Logo
      h("div", { display: "flex", alignItems: "center", gap: 18 }, [
        img(markSvg("kmra", HUB.accent.light), 64),
        h(
          "div",
          {
            display: "flex",
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: -1.5,
          },
          [h("span", {}, "kmra"), h("span", { color: MUTED }, ".dev")],
        ),
      ]),
      // Headline
      h("div", { display: "flex", flexDirection: "column", gap: 18 }, [
        h(
          "div",
          {
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: -2.5,
            lineHeight: 1.05,
          },
          "Free tools that run in your browser",
        ),
        h(
          "div",
          { fontSize: 28, color: MUTED, lineHeight: 1.35, maxWidth: 1040 },
          `${tools} tools for images, PDFs, video, audio, QR codes, text in pictures, code, colours, calculations and music. Your files stay on your device.`,
        ),
      ]),
      // Every app's mark
      h(
        "div",
        { display: "flex", gap: 14 },
        live.map((a) => img(markSvg(a.id, a.accent.light), 56)),
      ),
    ],
  );
}

async function png(w: number, hgt: number): Promise<Uint8Array> {
  const svg = await satori(
    tree(w, hgt) as unknown as Parameters<typeof satori>[0],
    { width: w, height: hgt, fonts },
  );
  return new Resvg(svg, { fitTo: { mode: "width", value: w } })
    .render()
    .asPng();
}

await mkdir("docs/images", { recursive: true });
await writeFile("docs/images/social-preview.png", await png(1280, 640));
console.log(
  `docs/images/social-preview.png (${live.length} apps, ${tools} tools)`,
);
