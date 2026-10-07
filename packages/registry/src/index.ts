/**
 * Single source of truth for every app on kmra.dev.
 * Each app lives on its own subdomain; headers, menus, footers, the ⌘K palette and cross-app links
 * are all generated from this file. Add a new app here first, then scaffold it under apps/<id>.
 */

export const ROOT_DOMAIN = "kmra.dev";

/** Who makes kmra, and how to reach them. */
export const CONTACT = {
  email: "ping@kmra.dev",
  maker: "K M Rejowan Ahmmed",
  portfolio: "https://rejowan.com",
  linkedin: "https://www.linkedin.com/in/ahmmedrejowan",
} as const;

/** Icon names available in @kmra/ui (see packages/ui/src/lib/icons.ts) */
export type IconName =
  | "resize"
  | "crop"
  | "compress"
  | "convert"
  | "rotate"
  | "magic"
  | "shield"
  | "zap"
  | "layers"
  | "file"
  | "split"
  | "signature"
  | "image"
  | "hash";

export interface Tool {
  /** URL path segment, e.g. "resize" -> imgtool.kmra.dev/resize */
  slug: string;
  name: string;
  /** Page H1; defaults to `name` */
  title?: string;
  description: string;
  /** Short line for menus (about 3–5 words) */
  blurb: string;
  icon: IconName;
  /** Menu group, e.g. "Optimize" */
  group: string;
  /** false = page exists but shows "coming soon" */
  ready: boolean;
  steps?: readonly string[];
}

/** Settings a task page pre-fills in its tool. Interpreted by the app that owns the tool. */
export type Preset = Readonly<Record<string, string | number | boolean | null>>;

/** Landing page for a specific job, e.g. "Compress to 100 KB". Uses an existing tool with a preset. */
export interface Task {
  slug: string;
  tool: string;
  /** Short name for menus */
  name: string;
  /** One-line hint for menus and cards */
  short: string;
  /** Menu group, e.g. "For forms" */
  group: string;
  /** Page H1 */
  title: string;
  intro: string;
  about: readonly string[];
  preset: Preset;
}

export interface Accent {
  light: string;
  dark: string;
  softLight: string;
  softDark: string;
}

export interface App {
  /** Also the subdomain and the folder name under apps/ */
  id: string;
  name: string;
  /** Two-part wordmark, e.g. ["Img", "Tool"] → "ImgTool"; the first part takes the accent colour */
  brand: readonly [string, string];
  /** Short label for nav, e.g. "Images" */
  short: string;
  tagline: string;
  accent: Accent;
  /** Whether the subdomain is deployed. Apps that aren't live show as "Soon" and aren't linked. */
  live: boolean;
  devPort: number;
  tools: readonly Tool[];
  tasks: readonly Task[];
}

export const apps = [
  {
    id: "imgtool",
    name: "Image tools",
    brand: ["Img", "Tool"],
    short: "Images",
    tagline:
      "Resize, compress and convert images in your browser. Nothing gets uploaded.",
    accent: {
      light: "#0057ff",
      dark: "#4d8bff",
      softLight: "#e8efff",
      softDark: "#16213a",
    },
    live: true,
    devPort: 4321,
    tools: [
      {
        slug: "compress",
        title: "Compress images",
        name: "Compress",
        description:
          "Smaller files at the quality you choose, or an exact size.",
        blurb: "Smaller files, same look",
        icon: "compress",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop or paste an image.",
          "Choose a format and drag Quality, or pick an exact size in KB.",
          "Compare before and after, then download.",
        ],
      },
      {
        slug: "resize",
        title: "Resize images",
        name: "Resize",
        description: "Exact pixels, percentages or social media presets.",
        blurb: "Pixels or presets",
        icon: "resize",
        group: "Edit",
        ready: true,
        steps: [
          "Drop an image.",
          "Type a width and height, or pick a preset.",
          "Download the resized copy.",
        ],
      },
      {
        slug: "convert",
        title: "Convert images",
        name: "Convert",
        description: "Convert HEIC, PNG, WebP and more to JPEG, PNG or WebP.",
        blurb: "HEIC, PNG, WebP to JPG",
        icon: "convert",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop one or more images, including iPhone HEIC photos.",
          "Pick JPEG, PNG or WebP.",
          "Download. Your originals stay untouched.",
        ],
      },
      {
        slug: "strip-metadata",
        title: "Remove metadata from photos",
        name: "Strip metadata",
        description: "Remove location, camera and date info from photos.",
        blurb: "Remove location data",
        icon: "shield",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop a photo.",
          "kmra re-saves the pixels only, leaving location, camera and date info behind.",
          "Download the clean copy.",
        ],
      },
      {
        slug: "form-size",
        title: "Exact size for online forms",
        name: "Exact size for forms",
        description:
          "Exact pixel size and file size for job, exam, passport and visa forms.",
        blurb: "Pixels + KB in one click",
        icon: "file",
        group: "Forms",
        ready: true,
        steps: [
          "Drop your photo or signature.",
          "Pick the form preset, or type the size and KB limit the form asks for.",
          "Download. The image is cropped to fill the size and kept just under the limit.",
        ],
      },
      {
        slug: "crop",
        title: "Crop images",
        name: "Crop",
        description: "Free crop or fixed ratios like 1:1 and 16:9.",
        blurb: "Free or fixed ratio",
        icon: "crop",
        group: "Edit",
        ready: true,
        steps: [
          "Drop an image.",
          "Pick a ratio like 1:1 or 16:9, or keep it free, then drag the frame.",
          "Download the cropped image.",
        ],
      },
      {
        slug: "rotate",
        title: "Rotate and flip images",
        name: "Rotate & flip",
        description: "Fix sideways photos in one click.",
        blurb: "Fix sideways photos",
        icon: "rotate",
        group: "Edit",
        ready: true,
        steps: [
          "Drop an image.",
          "Rotate left or right, or flip it.",
          "Download the fixed image.",
        ],
      },
    ],
    tasks: [
      {
        slug: "compress-to-100kb",
        tool: "compress",
        name: "Compress to 100 KB",
        short: "Job, exam and visa forms",
        group: "For forms",
        title: "Compress an image to 100 KB",
        intro:
          "Many job portals, exam forms and visa sites reject photos over 100 KB. Drop your photo and get the sharpest JPEG that fits.",
        about: [
          "Forms usually limit file size, not dimensions. Lowering quality step by step until the file fits keeps far more detail than shrinking the image.",
          "kmra tests quality levels on your device and keeps the best one under 100 KB. If even the lowest quality is too big, reduce the dimensions in Advanced.",
        ],
        preset: { type: "image/jpeg", target: 100 },
      },
      {
        slug: "compress-to-50kb",
        tool: "compress",
        name: "Compress to 50 KB",
        short: "Signatures, ID photos",
        group: "For forms",
        title: "Compress an image to 50 KB",
        intro:
          "For signature uploads and small ID photos that must stay under 50 KB.",
        about: [
          "Signature fields often need tiny files. A plain signature on white paper fits easily under 50 KB as a JPEG.",
        ],
        preset: { type: "image/jpeg", target: 50 },
      },
      {
        slug: "photo-300x300-100kb",
        tool: "form-size",
        name: "Photo 300×300, 100 KB",
        short: "Job and exam applications",
        group: "For forms",
        title: "Resize a photo to 300×300 under 100 KB",
        intro:
          "Most Bangladeshi job portals (Teletalk, BPSC, bank jobs) want a 300×300 photo under 100 KB. Drop your photo and download one that's accepted.",
        about: [
          "The photo is cropped to a centred square, resized to exactly 300×300 pixels and saved as a JPEG at the best quality that stays under 100 KB.",
        ],
        preset: { form: "job-photo" },
      },
      {
        slug: "signature-300x80-60kb",
        tool: "form-size",
        name: "Signature 300×80, 60 KB",
        short: "Signature upload size",
        group: "For forms",
        title: "Resize a signature to 300×80 under 60 KB",
        intro:
          "Make a scanned or photographed signature exactly 300×80 pixels and under 60 KB, as most job and admission forms require.",
        about: [
          "Crop close to your signature first for the best result. For a cleaner white background, use the signature cleaner.",
        ],
        preset: { form: "job-signature" },
      },
      {
        slug: "passport-photo-size",
        tool: "form-size",
        name: "Passport photo size",
        short: "35×45 mm at 300 dpi",
        group: "For forms",
        title: "Resize a photo to passport size (35×45 mm)",
        intro:
          "Get a 35×45 mm photo at print quality (413×531 pixels) for passport and visa forms.",
        about: [
          "35×45 mm is the standard for most passports and visas. Keep your head centred with some space above it.",
        ],
        preset: { form: "passport" },
      },
      {
        slug: "us-visa-photo",
        tool: "form-size",
        name: "US visa / DV photo",
        short: "600×600, under 240 KB",
        group: "For forms",
        title: "Make a US visa or DV lottery photo (600×600)",
        intro:
          "The US visa and DV lottery forms need a square photo of 600×600 pixels under 240 KB. This makes one in a click.",
        about: [
          "The photo is cropped to a centred square. Use a plain light background, as the rules require.",
        ],
        preset: { form: "us-visa" },
      },
      {
        slug: "heic-to-jpg",
        tool: "convert",
        name: "HEIC to JPG",
        short: "iPhone photos that open anywhere",
        group: "Formats",
        title: "Convert HEIC to JPG",
        intro:
          "iPhone photos are saved as HEIC, which many sites and Windows apps can't open. Turn them into JPGs right in your browser.",
        about: [
          "The HEIC file is decoded on your device, so private photos never leave it. Batches of photos convert in one go.",
        ],
        preset: { type: "image/jpeg", quality: 90 },
      },
      {
        slug: "png-to-jpg",
        tool: "convert",
        name: "PNG to JPG",
        short: "Smaller files for photos",
        group: "Formats",
        title: "Convert PNG to JPG",
        intro:
          "Turn screenshots and PNG photos into JPGs that are much smaller and work everywhere.",
        about: [
          "PNG is lossless, which makes photos huge. JPG is built for photos and is usually 5 to 10 times smaller.",
          "Transparent areas become white, because JPG has no transparency.",
        ],
        preset: { type: "image/jpeg", quality: 90 },
      },
      {
        slug: "jpg-to-webp",
        tool: "convert",
        name: "JPG to WebP",
        short: "Faster websites",
        group: "Formats",
        title: "Convert JPG to WebP",
        intro:
          "WebP images are around 30% smaller than JPG at the same quality, and every modern browser supports them.",
        about: [
          "Use WebP on websites and blogs to make pages load faster without visible quality loss.",
        ],
        preset: { type: "image/webp", quality: 80 },
      },
      {
        slug: "instagram-sizes",
        tool: "resize",
        name: "Instagram sizes",
        short: "Square, portrait and story",
        group: "For social",
        title: "Resize for Instagram",
        intro:
          "Pick square, portrait or story and get an image Instagram won't crop or blur.",
        about: [
          "Instagram shows posts at 1080 pixels wide. Portrait (1080 × 1350) takes up the most space in the feed.",
        ],
        preset: { size: "ig-portrait" },
      },
      {
        slug: "crop-to-square",
        tool: "crop",
        name: "Crop to square",
        short: "Profile pictures, 1:1",
        group: "For social",
        title: "Crop an image to a square",
        intro:
          "Make a 1:1 square for profile pictures and posts. Drag the frame to choose what stays.",
        about: [
          "Most profile pictures are shown as squares or circles, so a centred 1:1 crop avoids awkward automatic cropping.",
        ],
        preset: { ratio: "1:1" },
      },
      {
        slug: "youtube-thumbnail",
        tool: "resize",
        name: "YouTube thumbnail",
        short: "1280 × 720",
        group: "For social",
        title: "Resize to a YouTube thumbnail",
        intro:
          "YouTube thumbnails should be 1280 × 720 and under 2 MB. This does both.",
        about: [
          "16:9 at 1280 × 720 looks sharp on TVs and phones. Keep text large so it reads at small sizes.",
        ],
        preset: { size: "yt" },
      },
    ],
  },
  {
    id: "pdftool",
    name: "PDF tools",
    brand: ["PDF", "Tool"],
    short: "PDF",
    tagline: "Merge, split and sign PDFs without uploading them anywhere.",
    accent: {
      light: "#e5484d",
      dark: "#ff6b6f",
      softLight: "#fdecec",
      softDark: "#3a1618",
    },
    live: true,
    devPort: 4322,
    tools: [
      {
        slug: "merge",
        title: "Merge PDF files",
        name: "Merge",
        description: "Combine PDFs and reorder their pages.",
        blurb: "Combine files",
        icon: "layers",
        group: "Organize",
        ready: false,
      },
      {
        slug: "split",
        title: "Split a PDF",
        name: "Split",
        description: "Extract pages or split by range.",
        blurb: "Extract pages",
        icon: "split",
        group: "Organize",
        ready: false,
      },
      {
        slug: "rotate",
        title: "Rotate PDF pages",
        name: "Rotate pages",
        description: "Rotate single pages or the whole file.",
        blurb: "Turn pages",
        icon: "rotate",
        group: "Organize",
        ready: false,
      },
      {
        slug: "sign",
        title: "Sign a PDF",
        name: "Sign",
        description: "Draw or type a signature and place it.",
        blurb: "Add your signature",
        icon: "signature",
        group: "Edit",
        ready: false,
      },
      {
        slug: "to-image",
        title: "Convert PDF to images",
        name: "PDF to image",
        description: "Save pages as JPG or PNG.",
        blurb: "Pages as JPG or PNG",
        icon: "image",
        group: "Convert",
        ready: false,
      },
      {
        slug: "from-image",
        title: "Convert images to PDF",
        name: "Image to PDF",
        description: "Turn photos and scans into one PDF.",
        blurb: "Photos into one PDF",
        icon: "file",
        group: "Convert",
        ready: false,
      },
    ],
    tasks: [],
  },
  {
    id: "vidtool",
    name: "Video tools",
    brand: ["Vid", "Tool"],
    short: "Video",
    tagline: "Trim, convert and make GIFs.",
    accent: {
      light: "#12a594",
      dark: "#2ebfae",
      softLight: "#e2f6f3",
      softDark: "#0f2a27",
    },
    live: false,
    devPort: 4323,
    tools: [],
    tasks: [],
  },
  {
    id: "devtool",
    name: "Developer tools",
    brand: ["Dev", "Tool"],
    short: "Dev",
    tagline: "JSON, Base64, hashes and more.",
    accent: {
      light: "#8e4ec6",
      dark: "#b07ce6",
      softLight: "#f3ebfb",
      softDark: "#2a1b3a",
    },
    live: false,
    devPort: 4324,
    tools: [],
    tasks: [],
  },
  {
    id: "qrtool",
    name: "QR tools",
    brand: ["QR", "Tool"],
    short: "QR",
    tagline: "Generate and scan QR codes and barcodes.",
    accent: {
      light: "#f76b15",
      dark: "#ff8b3e",
      softLight: "#feeee3",
      softDark: "#3a2312",
    },
    live: false,
    devPort: 4325,
    tools: [],
    tasks: [],
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

/** "ImgTool" */
export function brandName(app: App): string {
  return app.brand.join("");
}

/** Link to a page in `target`, relative when it's the current app. */
export function linkTo(
  current: AppId,
  target: AppId,
  path = "/",
  dev = false,
): string {
  return current === target ? path : appUrl(target, path, dev);
}

/** Group items by their `group` field, keeping first-seen order. */
export function groupBy<T extends { group: string }>(
  items: readonly T[],
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  return [...map.entries()];
}

/** Every page a header, footer or palette may link to: tools and tasks of every live app. */
export interface PageLink {
  app: AppId;
  kind: "tool" | "task" | "page";
  slug: string;
  name: string;
  hint: string;
  icon: IconName;
  ready: boolean;
}

export function allPages(): PageLink[] {
  const out: PageLink[] = [];
  for (const app of apps as readonly App[]) {
    if (!app.live) continue;
    const id = app.id as AppId;
    for (const t of app.tools)
      out.push({
        app: id,
        kind: "tool",
        slug: t.slug,
        name: t.name,
        hint: app.short,
        icon: t.icon,
        ready: t.ready,
      });
    for (const t of app.tasks) {
      const tool = app.tools.find((x) => x.slug === t.tool);
      out.push({
        app: id,
        kind: "task",
        slug: t.slug,
        name: t.name,
        hint: t.short,
        icon: tool?.icon ?? "file",
        ready: true,
      });
    }
  }
  return out;
}
