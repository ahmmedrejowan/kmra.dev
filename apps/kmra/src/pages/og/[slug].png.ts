import type { APIRoute } from "astro";
import { og, type OgPage } from "@kmra/ui/lib/routes";
import { totalTools } from "../../lib/hub";

const PAGES: OgPage[] = [
  {
    slug: "index",
    title: "Free tools for every file",
    subtitle: `${totalTools} tools for images, PDFs, video, QR codes, text in pictures and code. Everything runs in your browser.`,
  },
  {
    slug: "tools",
    title: `All ${totalTools} kmra tools`,
    subtitle: "Search every tool, or pick an app. Free, and your files stay on your device.",
    icon: "grid",
  },
  {
    slug: "privacy",
    title: "Privacy",
    subtitle: "Files stay on your device. No accounts, no tracking of your files.",
    icon: "shield",
  },
  {
    slug: "about",
    title: "About kmra.dev",
    subtitle: "Small, private tools for everyday files.",
    icon: "layers",
  },
];

export const getStaticPaths = () =>
  PAGES.map((page) => ({ params: { slug: page.slug }, props: { page } }));
export const GET: APIRoute = ({ props }) =>
  og("kmra", (props as { page: OgPage }).page);
