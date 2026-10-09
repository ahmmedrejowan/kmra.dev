/**
 * Build-time image rendering for Open Graph images and app icons.
 * Runs only in prerendered endpoints (Node), never in the browser.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { brandOf, type BrandId } from "@kmra/registry";
import { ICONS, type IconKey } from "./icons";
import { markSvg } from "./brand";

const uiDir = dirname(
  createRequire(join(process.cwd(), "package.json")).resolve(
    "@kmra/ui/package.json",
  ),
);
const fontFile = (w: number) =>
  join(
    uiDir,
    "node_modules/@fontsource/geist/files",
    `geist-latin-${w}-normal.woff`,
  );
let fonts: Promise<
  { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]
> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([400, 600, 700] as const).map(async (weight) => ({
      name: "Geist",
      data: await readFile(fontFile(weight)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

export function svgToPng(svg: string, width: number): Uint8Array {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } })
    .render()
    .asPng();
}

const dataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

function iconSvg(name: IconKey, color: string): string {
  const paths = ICONS[name].map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// Minimal element helper for satori (it takes React-like objects).
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

export interface OgInput {
  appId: BrandId;
  title: string;
  subtitle: string;
  /** Small label above the title, e.g. "Image tool" */
  kicker?: string;
  icon?: IconKey;
}

export async function ogPng({
  appId,
  title,
  subtitle,
  kicker,
  icon,
}: OgInput): Promise<Uint8Array> {
  const app = brandOf(appId);
  const hub = appId === "kmra";
  const acc = app.accent.light;
  const tree = h(
    "div",
    {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      padding: 72,
      fontFamily: "Geist",
      color: "#18181b",
      backgroundColor: "#fafafa",
      backgroundImage: hub
        ? "radial-gradient(circle at 88% 12%, #0057ff26, transparent 40%), radial-gradient(circle at 62% 105%, #12a59424, transparent 40%), radial-gradient(circle at 100% 70%, #e5484d1f, transparent 35%), radial-gradient(circle at 0% 100%, #8e4ec61a, transparent 40%)"
        : `radial-gradient(circle at 85% 20%, ${acc}2e, transparent 45%), radial-gradient(circle at 0% 100%, ${acc}1a, transparent 40%)`,
    },
    [
      h("div", { display: "flex", alignItems: "center", gap: 18 }, [
        h("img", { width: 64, height: 64 }, undefined, {
          src: dataUri(markSvg(appId, acc)),
          width: 64,
          height: 64,
        }),
        h(
          "div",
          {
            display: "flex",
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: -1.5,
          },
          [
            h("span", { color: acc }, app.brand[0]),
            h("span", { color: hub ? "#71717a" : "#18181b" }, app.brand[1]),
          ],
        ),
        ...(hub
          ? []
          : [
              h(
                "span",
                { fontSize: 26, color: "#71717a", marginLeft: 4, marginTop: 8 },
                "kmra.dev",
              ),
            ]),
      ]),
      h("div", { display: "flex", flex: 1 }),
      h(
        "div",
        {
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 48,
        },
        [
          h(
            "div",
            {
              display: "flex",
              flexDirection: "column",
              maxWidth: icon ? 820 : 1050,
            },
            [
              kicker
                ? h(
                    "div",
                    {
                      display: "flex",
                      alignSelf: "flex-start",
                      fontSize: 24,
                      fontWeight: 600,
                      color: acc,
                      backgroundColor: `${acc}1f`,
                      borderRadius: 999,
                      padding: "6px 18px",
                      marginBottom: 22,
                    },
                    kicker,
                  )
                : h("div", { display: "flex" }),
              h(
                "div",
                {
                  fontSize: 76,
                  fontWeight: 700,
                  letterSpacing: -3,
                  lineHeight: 1.02,
                },
                title,
              ),
              h(
                "div",
                {
                  fontSize: 32,
                  color: "#52525b",
                  marginTop: 22,
                  lineHeight: 1.3,
                },
                subtitle,
              ),
            ],
          ),
          icon
            ? h(
                "div",
                {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 200,
                  height: 200,
                  borderRadius: 48,
                  backgroundColor: "#ffffff",
                  border: "2px solid #e4e4e7",
                  boxShadow: `0 30px 60px -30px ${acc}`,
                },
                h("img", { width: 104, height: 104 }, undefined, {
                  src: dataUri(iconSvg(icon, acc)),
                  width: 104,
                  height: 104,
                }),
              )
            : h("div", { display: "flex" }),
        ],
      ),
      h(
        "div",
        {
          display: "flex",
          gap: 28,
          marginTop: 40,
          fontSize: 24,
          color: "#52525b",
        },
        [
          ...[
            "Runs in your browser",
            "Your files stay on your device",
            "Free, no sign-up",
          ].map((t) =>
            h("div", { display: "flex", alignItems: "center", gap: 10 }, [
              h("img", { width: 26, height: 26 }, undefined, {
                src: dataUri(iconSvg("check", "#047857")),
                width: 26,
                height: 26,
              }),
              t,
            ]),
          ),
        ],
      ),
    ],
  );
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: await loadFonts(),
  });
  return svgToPng(svg, 1200);
}

const png = (body: Uint8Array) =>
  new Response(body as unknown as BodyInit, {
    headers: { "Content-Type": "image/png" },
  });

export function ogResponse(input: OgInput) {
  return ogPng(input).then(png);
}

/** PNG app icon. `maskable` keeps the glyph inside the safe zone on a full-bleed background. */
export function iconPng(
  appId: BrandId,
  size: number,
  maskable = false,
): Uint8Array {
  const app = brandOf(appId);
  return svgToPng(
    markSvg(appId, app.accent.light, {
      rounded: !maskable && size < 180,
      pad: maskable ? 12 : 0,
    }),
    size,
  );
}

/** favicon.ico containing a 32px and 48px PNG. */
export function faviconIco(appId: BrandId): Uint8Array {
  const images = [32, 48].map((s) => ({ s, data: iconPng(appId, s) }));
  const header = 6 + 16 * images.length;
  const total = header + images.reduce((n, i) => n + i.data.length, 0);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint16(2, 1, true); // type: icon
  v.setUint16(4, images.length, true);
  let offset = header;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    out[e] = img.s;
    out[e + 1] = img.s;
    v.setUint16(e + 4, 1, true); // planes
    v.setUint16(e + 6, 32, true); // bits per pixel
    v.setUint32(e + 8, img.data.length, true);
    v.setUint32(e + 12, offset, true);
    out.set(img.data, offset);
    offset += img.data.length;
  });
  return out;
}
