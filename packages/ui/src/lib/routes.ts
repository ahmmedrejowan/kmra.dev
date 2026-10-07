/** Shared build-time routes (icons, manifest, robots, OG images). Each app re-exports these. */
import { appOrigin, brandName, getApp, type AppId } from "@kmra/registry";
import type { IconKey } from "./icons";
import { markSvg } from "./brand";
import { faviconIco, iconPng, ogResponse } from "./render";

const bin = (body: Uint8Array, type: string) =>
  new Response(body as unknown as BodyInit, {
    headers: { "Content-Type": type },
  });

export const faviconSvg = (appId: AppId) =>
  new Response(markSvg(appId, getApp(appId).accent.light), {
    headers: { "Content-Type": "image/svg+xml" },
  });
export const favicon = (appId: AppId) => bin(faviconIco(appId), "image/x-icon");
export const icon = (appId: AppId, size: number, maskable = false) =>
  bin(iconPng(appId, size, maskable), "image/png");

export function manifest(appId: AppId) {
  const app = getApp(appId);
  return new Response(
    JSON.stringify(
      {
        name: `${brandName(app)} by kmra.dev`,
        short_name: brandName(app),
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

export function robots(appId: AppId) {
  const origin = appOrigin(appId);
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
      subtitle: "Compress, resize, convert, crop and more.",
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
      subtitle: "No uploads, no accounts, no tracking of your files.",
      icon: "shield",
    },
    {
      slug: "about",
      title: `About ${brandName(app)}`,
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

export const og = (appId: AppId, page: OgPage) =>
  ogResponse({ appId, ...page });
