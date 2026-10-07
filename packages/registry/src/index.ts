/**
 * Single source of truth for every tool app on kmra.dev.
 * Each app lives on its own subdomain; apps link to each other through this registry.
 * Add a new app here first, then scaffold it under apps/<id> using the same devPort.
 */

export const ROOT_DOMAIN = "kmra.dev";

export interface Tool {
  /** URL path segment, e.g. "resize" -> imgtool.kmra.dev/resize */
  slug: string;
  name: string;
  description: string;
  /** false = page exists but shows "coming soon" */
  ready: boolean;
}

export interface App {
  /** Also the subdomain and the folder name under apps/ */
  id: string;
  name: string;
  tagline: string;
  devPort: number;
  tools: Tool[];
}

export const apps = [
  {
    id: "imgtool",
    name: "Image Tools",
    tagline: "Resize, crop, compress and convert images in your browser.",
    devPort: 4321,
    tools: [
      {
        slug: "resize",
        name: "Resize",
        description: "Change image dimensions by pixels or percentage.",
        ready: true,
      },
      {
        slug: "convert",
        name: "Convert",
        description: "Convert between JPEG, PNG and WebP.",
        ready: true,
      },
      {
        slug: "compress",
        name: "Compress",
        description: "Shrink file size with adjustable quality.",
        ready: false,
      },
      {
        slug: "crop",
        name: "Crop",
        description: "Crop to a custom area or aspect ratio.",
        ready: false,
      },
      {
        slug: "rotate",
        name: "Rotate & Flip",
        description: "Rotate or mirror images.",
        ready: false,
      },
    ],
  },
  {
    id: "pdftool",
    name: "PDF Tools",
    tagline: "Merge, split and edit PDFs without uploading them anywhere.",
    devPort: 4322,
    tools: [
      {
        slug: "merge",
        name: "Merge",
        description: "Combine multiple PDFs into one.",
        ready: false,
      },
      {
        slug: "split",
        name: "Split",
        description: "Extract pages or split into multiple files.",
        ready: false,
      },
      {
        slug: "rotate",
        name: "Rotate",
        description: "Rotate individual pages or the whole document.",
        ready: false,
      },
      {
        slug: "to-image",
        name: "PDF to Image",
        description: "Render pages as PNG or JPEG.",
        ready: false,
      },
      {
        slug: "from-image",
        name: "Image to PDF",
        description: "Turn images into a PDF.",
        ready: false,
      },
    ],
  },
] as const satisfies readonly App[];

export type AppId = (typeof apps)[number]["id"];

export function getApp(id: AppId): App {
  const app = apps.find((a) => a.id === id);
  if (!app) throw new Error(`Unknown app: ${id}`);
  return app;
}

/** Origin for an app: localhost:<port> in dev, https://<id>.kmra.dev in production. */
export function appOrigin(id: AppId, dev = false): string {
  const app = getApp(id);
  return dev
    ? `http://localhost:${app.devPort}`
    : `https://${app.id}.${ROOT_DOMAIN}`;
}

/** Absolute URL to a page in any app. Use for cross-app links. */
export function appUrl(id: AppId, path = "/", dev = false): string {
  return new URL(path, appOrigin(id, dev)).toString();
}
