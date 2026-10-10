/** Shared build-time routes (icons, manifest, robots, OG images). Each app re-exports these. */
import {
  appOrigin,
  brandOf,
  getApp,
  hubOrigin,
  type AppId,
  type BrandId,
} from "@kmra/registry";
import type { IconKey } from "./icons";
import { markSvg } from "./brand";
import { faviconIco, iconPng, ogResponse } from "./render";

const bin = (body: Uint8Array, type: string) =>
  new Response(body as unknown as BodyInit, {
    headers: { "Content-Type": type },
  });

export const faviconSvg = (appId: BrandId) =>
  new Response(markSvg(appId, brandOf(appId).accent.light), {
    headers: { "Content-Type": "image/svg+xml" },
  });
export const favicon = (appId: BrandId) => bin(faviconIco(appId), "image/x-icon");
export const icon = (appId: BrandId, size: number, maskable = false) =>
  bin(iconPng(appId, size, maskable), "image/png");

export function manifest(appId: BrandId) {
  const app = brandOf(appId);
  const full = appId === "kmra" ? "kmra.dev" : `${app.brand.join("")} by kmra.dev`;
  return new Response(
    JSON.stringify(
      {
        name: full,
        short_name: app.brand.join(""),
        description: app.tagline,
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fafafa",
        theme_color: app.accent.light,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}

export function robots(appId: BrandId) {
  const origin = appId === "kmra" ? hubOrigin() : appOrigin(appId);
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
    {
      headers: { "Content-Type": "text/plain" },
    },
  );
}

export interface OgPage {
  slug: string;
  title: string;
  subtitle: string;
  kicker?: string;
  icon?: IconKey;
}

/** Every page that gets an OG image: home, tools, tasks and the info pages. */
export function ogPages(appId: AppId): OgPage[] {
  const app = getApp(appId);
  const toolIcon = (slug: string) =>
    app.tools.find((t) => t.slug === slug)?.icon;
  return [
    {
      slug: "index",
      title: app.tagline.split(".")[0] ?? app.name,
      subtitle: app.tagline.split(". ").slice(1).join(". ") || app.tagline,
    },
    ...app.tools.map((t) => ({
      slug: t.slug,
      title: t.title ?? t.name,
      subtitle: t.description,
      kicker: app.name.replace(/s$/, ""),
      icon: t.icon,
    })),
    ...app.tasks.map((t) => ({
      slug: t.slug,
      title: t.title,
      subtitle: t.short,
      kicker: "Popular task",
      icon: toolIcon(t.tool),
    })),
    {
      slug: "how-it-works",
      title: "How your files stay on your device",
      subtitle: "The tool comes to your browser, not your file to a server.",
      icon: "shield",
    },
    {
      slug: "privacy",
      title: "Privacy",
      subtitle:
        "Files stay on your device. No accounts, no tracking of your files.",
      icon: "shield",
    },
    {
      slug: "tools",
      title: `All ${app.short} tools`,
      subtitle:
        "Every tool, by category. Free, and everything runs on your device.",
      icon: "grid",
    },
    {
      slug: "use-cases",
      title: "Use cases",
      subtitle: "Ready-made settings for everyday jobs.",
      icon: "layers",
    },
    {
      slug: "more-tools",
      title: "More tools from kmra",
      subtitle: "Free, private tools for images, PDFs, video, audio, QR codes, text in pictures, code, colours, calculations and music.",
      icon: "zap",
    },
    {
      slug: "about",
      title: `About ${app.brand.join("")}`,
      subtitle: "Small, private tools for everyday files.",
      icon: "layers",
    },
  ];
}

export function ogPaths(appId: AppId) {
  return ogPages(appId).map((page) => ({
    params: { slug: page.slug },
    props: { page },
  }));
}

export const og = (appId: BrandId, page: OgPage) =>
  ogResponse({ appId, ...page });
