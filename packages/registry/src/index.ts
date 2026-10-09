/**
 * Single source of truth for every app on kmra.dev.
 * Each app lives on its own subdomain; headers, menus, footers, the ⌘K palette and cross-app links
 * are all generated from this file. Add a new app here first, then scaffold it under apps/<id>.
 */

export const ROOT_DOMAIN = "kmra.dev";

import { localizeApp } from "./locales/index.ts";
export { localizeApp };
export type { AppContent } from "./locales/index.ts";

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
  | "hash"
  | "sun"
  | "eyeOff"
  | "type"
  | "stamp"
  | "frame"
  | "expand"
  | "monitor"
  | "scanFace"
  | "eraser"
  | "palette"
  | "pipette"
  | "info"
  | "chart"
  | "grid"
  | "layout"
  | "film"
  | "code"
  | "star"
  | "idCard"
  | "droplet"
  | "camera"
  | "trash"
  | "languages"
  | "braces"
  | "key"
  | "clock"
  | "diff"
  | "regex"
  | "table"
  | "link"
  | "terminal"
  | "binary"
  | "list"
  | "globe"
  | "shuffle"
  | "book"
  | "lock"
  | "scanText"
  | "search"
  | "video"
  | "music"
  | "scissors"
  | "gauge"
  | "volumeX"
  | "record"
  | "merge";

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
  /** Order of tool groups in menus and directories */
  toolGroups?: readonly string[];
  /** Short list for the homepage chips: tool or task slugs */
  popular?: readonly string[];
  /** Languages this app is published in (first = default). Defaults to English only. */
  locales?: readonly string[];
}

export const apps = [
  {
    id: "imgtool",
    name: "Image tools",
    brand: ["Img", "Tool"],
    short: "Images",
    tagline:
      "Compress, resize, convert, cut out backgrounds and more. Everything runs on your device.",
    accent: {
      light: "#0057ff",
      dark: "#4d8bff",
      softLight: "#e8efff",
      softDark: "#16213a",
    },
    live: true,
    devPort: 4321,
    locales: ["en", "bn"],
    toolGroups: [
      "Optimize",
      "Edit",
      "Background",
      "Create",
      "Forms",
      "Privacy",
      "Analyze",
      "Web & dev",
    ],
    popular: [
      "compress",
      "resize",
      "remove-bg",
      "passport-photo",
      "heic-to-jpg",
      "compress-to-100kb",
      "watermark",
      "face-blur",
      "collage",
    ],
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
      {
        slug: "adjust",
        title: "Adjust brightness, contrast and colour",
        name: "Adjust",
        description:
          "Brightness, contrast, saturation, warmth, sharpness and vignette.",
        blurb: "Light, colour, sharpness",
        icon: "sun",
        group: "Edit",
        ready: true,
        steps: [
          "Drop one or more photos.",
          "Drag the sliders. Double-click a slider to reset it.",
          "Download. Every photo in the batch gets the same fix.",
        ],
      },
      {
        slug: "filters",
        title: "Photo filters",
        name: "Filters",
        description:
          "One-click looks: mono, vintage, vivid, warm, cool and more.",
        blurb: "Mono, vintage, vivid",
        icon: "droplet",
        group: "Edit",
        ready: true,
        steps: [
          "Drop one or more photos.",
          "Pick a look and set its strength.",
          "Download the filtered copies.",
        ],
      },
      {
        slug: "add-text",
        title: "Add text to an image (meme maker)",
        name: "Add text",
        description:
          "Top and bottom text in classic meme style, or a clean caption.",
        blurb: "Memes and captions",
        icon: "type",
        group: "Create",
        ready: true,
        steps: [
          "Drop an image.",
          "Type the top and bottom text, then pick a font and size.",
          "Download your meme.",
        ],
      },
      {
        slug: "watermark",
        title: "Watermark images",
        name: "Watermark",
        description: "Add your name or logo to many photos at once.",
        blurb: "Text or logo, in bulk",
        icon: "stamp",
        group: "Create",
        ready: true,
        steps: [
          "Drop all the photos you want to protect.",
          "Type your name or add a logo, then pick a corner or repeat it across.",
          "Download them all as a zip.",
        ],
      },
      {
        slug: "border",
        title: "Add a border or round the corners",
        name: "Border & corners",
        description: "Coloured borders, rounded corners and a soft shadow.",
        blurb: "Borders, rounded corners",
        icon: "frame",
        group: "Create",
        ready: true,
        steps: [
          "Drop an image.",
          "Set the border width and colour, and how round the corners are.",
          "Download. Save as PNG to keep rounded corners transparent.",
        ],
      },
      {
        slug: "extend-canvas",
        title: "Make an image square without cropping",
        name: "Fit without cropping",
        description:
          "Pad photos to 1:1, 4:5 or 9:16 with a blurred or coloured background.",
        blurb: "Square without cropping",
        icon: "expand",
        group: "Create",
        ready: true,
        steps: [
          "Drop one or more photos.",
          "Pick the shape you need and a blurred, coloured or clear background.",
          "Download. Nothing is cut off.",
        ],
      },
      {
        slug: "beautify",
        title: "Screenshot beautifier",
        name: "Beautify screenshot",
        description:
          "Put screenshots on a gradient with padding, rounded corners and a shadow.",
        blurb: "Gradient, shadow, window",
        icon: "monitor",
        group: "Create",
        ready: true,
        steps: [
          "Drop or paste a screenshot.",
          "Pick a background, padding and window style.",
          "Download a share-ready image.",
        ],
      },
      {
        slug: "blur",
        title: "Blur or pixelate part of an image",
        name: "Blur & pixelate",
        description:
          "Hide faces, names, plates and card numbers before you share.",
        blurb: "Hide faces and details",
        icon: "eyeOff",
        group: "Privacy",
        ready: true,
        steps: [
          "Drop a photo or screenshot.",
          "Drag boxes over what to hide, then choose pixelate, blur or a solid box.",
          "Download. The hidden parts can't be recovered from the file.",
        ],
      },
      {
        slug: "signature",
        title: "Clean up a signature",
        name: "Signature cleaner",
        description:
          "Turn a phone photo of your signature into clean ink on a transparent or white background.",
        blurb: "Clean, transparent ink",
        icon: "signature",
        group: "Forms",
        ready: true,
        steps: [
          "Photograph your signature on plain paper and drop it here.",
          "Adjust how much faint ink to keep and pick an ink colour.",
          "Download a transparent PNG, or a 300 × 80 JPEG for forms.",
        ],
      },
      {
        slug: "remove-bg",
        title: "Remove the background from a photo",
        name: "Remove background",
        description:
          "Cut out people and products automatically, with AI that runs on your device.",
        blurb: "Transparent PNG cut-outs",
        icon: "eraser",
        group: "Background",
        ready: true,
        steps: [
          "Drop one or more photos of people or products.",
          "The subject is found on your device; pick Person or Object if Auto gets it wrong.",
          "Download transparent PNGs, one or all at once.",
        ],
      },
      {
        slug: "change-bg",
        title: "Change a photo's background colour",
        name: "Change background",
        description:
          "Swap the background for white, a colour or a blur. Great for profile and product photos.",
        blurb: "White, colour or blur",
        icon: "droplet",
        group: "Background",
        ready: true,
        steps: [
          "Drop a photo.",
          "Pick white, any colour, or a blurred background.",
          "Download the new photo.",
        ],
      },
      {
        slug: "passport-photo",
        title: "Passport and ID photo maker",
        name: "Passport photo",
        description:
          "Official sizes framed around your face, a plain background and a 4 × 6 print sheet.",
        blurb: "Sized, framed, printable",
        icon: "idCard",
        group: "Forms",
        ready: true,
        steps: [
          "Drop a clear, front-facing photo against any background.",
          "Pick the size your country needs and a background colour. The head is framed for you.",
          "Download the photo, or a 4 × 6 sheet to print at any photo shop.",
        ],
      },
      {
        slug: "face-blur",
        title: "Blur faces in photos automatically",
        name: "Blur faces",
        description:
          "Find and blur every face in a photo or a whole batch, on your device.",
        blurb: "Every face, automatically",
        icon: "scanFace",
        group: "Privacy",
        ready: true,
        steps: [
          "Drop one or more photos.",
          "Faces are found and blurred. Drag boxes to cover anything that was missed.",
          "Download. The blur can't be undone from the file.",
        ],
      },
      {
        slug: "collage",
        title: "Photo collage maker",
        name: "Collage",
        description:
          "Put 2 to 12 photos in a grid or layout, with spacing and rounded corners.",
        blurb: "Grids and layouts",
        icon: "layout",
        group: "Create",
        ready: true,
        steps: [
          "Drop 2 to 12 photos.",
          "Pick a layout and shape. Click two photos to swap them.",
          "Download the collage as JPEG or PNG.",
        ],
      },
      {
        slug: "split",
        title: "Split an image into a grid",
        name: "Split into grid",
        description:
          "Cut one image into tiles for Instagram grids, carousels or printing.",
        blurb: "Instagram grid, carousel",
        icon: "grid",
        group: "Create",
        ready: true,
        steps: [
          "Drop one image.",
          "Pick a preset like 3 × 3 or set rows and columns.",
          "Download every tile in one zip, numbered in order.",
        ],
      },
      {
        slug: "image-info",
        title: "Image info: size, format and dimensions",
        name: "Image info",
        description:
          "Real format, pixel size, aspect ratio, print size, transparency and more.",
        blurb: "Format, size, ratio",
        icon: "info",
        group: "Analyze",
        ready: true,
        steps: [
          "Drop one or more images.",
          "Read the details. The real format is checked from the file itself.",
          "Copy the details, or open the full metadata.",
        ],
      },
      {
        slug: "exif",
        title: "EXIF viewer: see photo metadata",
        name: "EXIF viewer",
        description:
          "See camera, settings, date and GPS location hidden in a photo.",
        blurb: "Camera, date, location",
        icon: "camera",
        group: "Analyze",
        ready: true,
        steps: [
          "Drop a photo.",
          "See everything stored in it, grouped and readable.",
          "Remove it all in one click, or save it as JSON.",
        ],
      },
      {
        slug: "histogram",
        title: "Image histogram",
        name: "Histogram",
        description:
          "RGB and brightness histogram with clipping and contrast checks.",
        blurb: "Exposure at a glance",
        icon: "chart",
        group: "Analyze",
        ready: true,
        steps: [
          "Drop a photo.",
          "Switch between RGB, brightness and single channels.",
          "Check for clipped shadows or highlights before you edit.",
        ],
      },
      {
        slug: "palette",
        title: "Colour palette from an image",
        name: "Colour palette",
        description: "Pull the main colours out of any image, with HEX codes.",
        blurb: "Main colours as HEX",
        icon: "palette",
        group: "Analyze",
        ready: true,
        steps: [
          "Drop an image.",
          "Choose how many colours you want.",
          "Click a colour to copy it, or export CSS, JSON or a PNG strip.",
        ],
      },
      {
        slug: "color-picker",
        title: "Colour picker from an image",
        name: "Colour picker",
        description:
          "Pick any pixel's colour as HEX, RGB, HSL or CMYK, with a zoom loupe.",
        blurb: "HEX, RGB, HSL from pixels",
        icon: "pipette",
        group: "Analyze",
        ready: true,
        steps: [
          "Drop an image.",
          "Move over it and click to pick a colour.",
          "Click any value to copy it.",
        ],
      },
      {
        slug: "favicon",
        title: "Favicon generator",
        name: "Favicon generator",
        description:
          "favicon.ico, Apple and Android icons, a web manifest and the HTML, from one logo.",
        blurb: "ICO, PNGs and HTML",
        icon: "star",
        group: "Web & dev",
        ready: true,
        steps: [
          "Drop your logo (SVG or a large PNG).",
          "Set padding, corners and background, and check the tab preview.",
          "Download the pack and paste the HTML into your site.",
        ],
      },
      {
        slug: "base64",
        title: "Image to Base64 converter",
        name: "Base64",
        description:
          "Turn an image into a data URI for CSS or HTML, or decode Base64 back to an image.",
        blurb: "Data URI, both ways",
        icon: "code",
        group: "Web & dev",
        ready: true,
        steps: [
          "Drop an image, or switch to Base64 to image and paste text.",
          "Pick data URI, plain Base64, CSS, HTML or Markdown.",
          "Copy it, or download the decoded image.",
        ],
      },
      {
        slug: "gif-frames",
        title: "Extract frames from a GIF",
        name: "GIF frames",
        description:
          "Split an animated GIF into PNG or JPEG frames, or one sprite sheet.",
        blurb: "Every frame as PNG",
        icon: "film",
        group: "Web & dev",
        ready: true,
        steps: [
          "Drop an animated GIF.",
          "Pick the frames you want, or keep them all.",
          "Download a zip of frames, or one sprite sheet.",
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
        tool: "passport-photo",
        name: "Passport photo 35×45",
        short: "Framed, white background",
        group: "For forms",
        title: "Make a 35 × 45 mm passport photo",
        intro:
          "Drop any front-facing photo. Your head is framed to the official size, the background turns white, and you get a print-quality 413 × 531 photo.",
        about: [
          "35 × 45 mm is used by the UK, the EU and Schengen visas, India, Bangladesh, Australia and many more. The head should fill about three quarters of the height, which is set for you.",
          "Need prints? Choose a 4 × 6 sheet and any photo shop can print it for a few cents.",
        ],
        preset: { spec: "35x45" },
      },
      {
        slug: "us-visa-photo",
        tool: "passport-photo",
        name: "US visa / DV photo",
        short: "2 × 2 in, under 240 KB",
        group: "For forms",
        title: "Make a US visa or DV lottery photo (600×600)",
        intro:
          "The US visa and DV lottery forms need a square 600 × 600 photo under 240 KB with a plain white background. Drop your photo and get one that fits.",
        about: [
          "Your head is framed to fill about 60% of the height, as the rules ask, and the background is replaced with white.",
          "Use a recent photo facing the camera, with no glasses and a neutral expression.",
        ],
        preset: { spec: "2x2", target: 240 },
      },
      {
        slug: "passport-photo-4x6",
        tool: "passport-photo",
        name: "Passport photos on 4×6",
        short: "Print 8 at any photo shop",
        group: "For forms",
        title: "Print passport photos on a 4 × 6 sheet",
        intro:
          "Get a 4 × 6 inch sheet of passport photos, ready to print at any photo shop or at home. Much cheaper than a photo studio.",
        about: [
          "The sheet is 1800 × 1200 pixels at 300 dpi, with thin grey cut lines. Print it at actual size (no scaling) so each photo comes out 35 × 45 mm.",
        ],
        preset: { spec: "35x45", sheet: "4x6" },
      },
      {
        slug: "compress-to-200kb",
        tool: "compress",
        name: "Compress to 200 KB",
        short: "Visa and university forms",
        group: "For forms",
        title: "Compress an image to 200 KB",
        intro:
          "For forms that accept photos and scans up to 200 KB. Get the best quality that fits.",
        about: [
          "200 KB is plenty for a sharp photo. If your image is a document scan, it stays readable at this size.",
        ],
        preset: { type: "image/jpeg", target: 200 },
      },
      {
        slug: "compress-to-20kb",
        tool: "compress",
        name: "Compress to 20 KB",
        short: "Tiny signature uploads",
        group: "For forms",
        title: "Compress an image to 20 KB",
        intro:
          "Some forms only accept signatures and thumbnails under 20 KB. This finds the best quality that fits.",
        about: [
          "At 20 KB, keep the image small: crop close to the signature first, or set a smaller size in Advanced.",
        ],
        preset: { type: "image/jpeg", target: 20 },
      },
      {
        slug: "transparent-signature",
        tool: "signature",
        name: "Transparent signature",
        short: "PNG for documents",
        group: "For forms",
        title: "Make a transparent signature PNG",
        intro:
          "Photograph your signature on white paper and get clean ink on a transparent background, ready to place on documents and PDFs.",
        about: [
          "Shadows and paper texture are removed by comparing each pixel with the paper around it, so even a phone photo in uneven light comes out clean.",
        ],
        preset: { type: "image/png" },
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
      {
        slug: "instagram-no-crop",
        tool: "extend-canvas",
        name: "Instagram without cropping",
        short: "Fit any photo in 4:5",
        group: "For social",
        title: "Post a full photo on Instagram without cropping",
        intro:
          "Instagram crops wide and tall photos. Add a blurred or coloured background so the whole photo fits a 4:5 post.",
        about: [
          "4:5 portrait posts take up the most room in the feed. Nothing is cut off: the space around your photo is filled instead.",
        ],
        preset: { frameRatio: "4:5" },
      },
      {
        slug: "story-no-crop",
        tool: "extend-canvas",
        name: "Story without cropping",
        short: "Fit any photo in 9:16",
        group: "For social",
        title: "Fit a photo in a 9:16 story without cropping",
        intro:
          "Turn a landscape or square photo into a full-screen 9:16 story with a blurred background, for Instagram, WhatsApp and TikTok.",
        about: [
          "Stories are 1080 × 1920. A blurred copy of your photo fills the top and bottom so it looks intentional.",
        ],
        preset: { frameRatio: "9:16" },
      },
      {
        slug: "meme-generator",
        tool: "add-text",
        name: "Meme generator",
        short: "Top and bottom text",
        group: "For social",
        title: "Meme generator",
        intro:
          "Classic white text with a black outline, at the top and bottom of any picture.",
        about: [
          "Text wraps to fit and gets an outline so it reads on any background. Switch to Clean for a modern caption look.",
        ],
        preset: {},
      },
      {
        slug: "white-background",
        tool: "change-bg",
        name: "White background",
        short: "Product and profile photos",
        group: "Photos",
        title: "Make a photo's background white",
        intro:
          "Marketplaces and job sites prefer a clean white background. Swap yours out in one step, on your device.",
        about: [
          "The subject is found automatically: people with a portrait model, products with an object model. Switch Subject if it picks the wrong one.",
        ],
        preset: {},
      },
      {
        slug: "transparent-png",
        tool: "remove-bg",
        name: "Transparent PNG",
        short: "Cut-out for designs",
        group: "Photos",
        title: "Make a transparent PNG from a photo",
        intro:
          "Remove the background and keep only the subject, ready to drop into slides, designs and stickers.",
        about: [
          "PNG keeps the transparency. WebP does too and makes smaller files for websites.",
        ],
        preset: {},
      },
      {
        slug: "black-and-white",
        tool: "filters",
        name: "Black and white",
        short: "Mono or high-contrast noir",
        group: "Photos",
        title: "Make a photo black and white",
        intro:
          "Turn colour photos into black and white, one photo or a whole batch.",
        about: [
          "Mono keeps every tone. Try Noir for deeper blacks and more drama.",
        ],
        preset: { filter: "mono" },
      },
      {
        slug: "hide-personal-info",
        tool: "blur",
        name: "Hide personal info",
        short: "Card numbers, names, plates",
        group: "Photos",
        title: "Hide personal info in a screenshot or photo",
        intro:
          "Cover card numbers, addresses, names and number plates before you share a screenshot or photo.",
        about: [
          "Solid boxes are the safest: unlike light blur, they can't be reversed. Pixelate with a high strength is also safe for text.",
        ],
        preset: {},
      },
      {
        slug: "svg-to-png",
        tool: "resize",
        name: "SVG to PNG",
        short: "Any size, sharp edges",
        group: "Formats",
        title: "Convert SVG to PNG",
        intro:
          "Turn SVG icons and logos into PNG at the size you need, with a transparent background.",
        about: [
          "The SVG is drawn at 2048 pixels on its longest side, so any smaller size you pick stays sharp.",
        ],
        preset: { type: "image/png", keepFormat: false },
      },
      {
        slug: "jpg-to-png",
        tool: "convert",
        name: "JPG to PNG",
        short: "Lossless copies",
        group: "Formats",
        title: "Convert JPG to PNG",
        intro:
          "Save a JPG as PNG, for apps and sites that ask for PNG or before editing it further.",
        about: [
          "Converting doesn't bring back detail the JPG already lost, but nothing more is lost from here on.",
        ],
        preset: { type: "image/png" },
      },
      {
        slug: "webp-to-jpg",
        tool: "convert",
        name: "WebP to JPG",
        short: "Open saved web images anywhere",
        group: "Formats",
        title: "Convert WebP to JPG",
        intro:
          "Images saved from websites are often WebP, which some apps can't open. Turn them into JPGs.",
        about: [
          "Transparent areas become white, because JPG has no transparency.",
        ],
        preset: { type: "image/jpeg", quality: 90 },
      },
    ],
  },
  {
    id: "pdftool",
    name: "PDF tools",
    brand: ["PDF", "Tool"],
    locales: ["en", "bn"],
    short: "PDF",
    tagline:
      "Merge, split, compress and sign PDFs. Everything runs on your device.",
    accent: {
      light: "#e5484d",
      dark: "#ff6b6f",
      softLight: "#fdecec",
      softDark: "#3a1618",
    },
    live: true,
    devPort: 4322,
    toolGroups: ["Organize", "Optimize", "Edit", "Convert"],
    popular: [
      "merge",
      "compress",
      "sign",
      "split",
      "from-image",
      "to-image",
      "compress-pdf-200kb",
      "organize",
    ],
    tools: [
      {
        slug: "merge",
        title: "Merge PDF files",
        name: "Merge",
        description: "Combine PDFs into one, in the order you want.",
        blurb: "Combine files",
        icon: "layers",
        group: "Organize",
        ready: true,
        steps: [
          "Drop two or more PDFs.",
          "Put the files in order, or switch to Advanced to arrange single pages.",
          "Merge and download one PDF.",
        ],
      },
      {
        slug: "split",
        title: "Split a PDF",
        name: "Split",
        description:
          "Split by page ranges, into single pages, or pull out the pages you need.",
        blurb: "Ranges, pages, extract",
        icon: "split",
        group: "Organize",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Type ranges like 1-3, 4-8, split every page, or pick pages to extract.",
          "Download the new PDFs, zipped when there are several.",
        ],
      },
      {
        slug: "organize",
        title: "Organize PDF pages",
        name: "Organize pages",
        description:
          "Reorder, rotate, delete and add blank pages by dragging thumbnails.",
        blurb: "Drag, rotate, delete",
        icon: "grid",
        group: "Organize",
        ready: true,
        steps: [
          "Drop one or more PDFs. Every page appears as a thumbnail.",
          "Drag pages into order, rotate or delete them, or add blank pages.",
          "Save one tidy PDF.",
        ],
      },
      {
        slug: "remove-pages",
        title: "Remove pages from a PDF",
        name: "Remove pages",
        description: "Delete the pages you don't need.",
        blurb: "Delete pages",
        icon: "trash",
        group: "Organize",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Type the pages to remove, or click them in Advanced.",
          "Download the shorter PDF.",
        ],
      },
      {
        slug: "rotate",
        title: "Rotate PDF pages",
        name: "Rotate pages",
        description: "Turn every page, or single pages, the right way up.",
        blurb: "Turn pages",
        icon: "rotate",
        group: "Organize",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Rotate all pages, or switch to Advanced to turn single pages.",
          "Download the fixed PDF.",
        ],
      },
      {
        slug: "compress",
        title: "Compress a PDF",
        name: "Compress",
        description:
          "Make scanned and image-heavy PDFs much smaller, or fit a size limit.",
        blurb: "Smaller files, size limits",
        icon: "compress",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Pick a compression level, or a size like 200 KB or 1 MB.",
          "Compress, check the new size, then download.",
        ],
      },
      {
        slug: "grayscale",
        title: "Convert a PDF to black and white",
        name: "Black and white",
        description:
          "Grayscale every page for cheaper printing and smaller files.",
        blurb: "Grayscale pages",
        icon: "droplet",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Every page is redrawn in grayscale.",
          "Download the black and white PDF.",
        ],
      },
      {
        slug: "sign",
        title: "Fill and sign a PDF",
        name: "Sign",
        description:
          "Draw, type or photograph your signature, add text and dates, and place them.",
        blurb: "Signature, text, date",
        icon: "signature",
        group: "Edit",
        ready: true,
        steps: [
          "Drop the PDF you need to sign.",
          "Draw, type or upload your signature, then place it. Add names, dates or ticks.",
          "Drag to position, then download the signed PDF.",
        ],
      },
      {
        slug: "page-numbers",
        title: "Add page numbers to a PDF",
        name: "Page numbers",
        description:
          "Number pages in any corner, with formats like Page 1 of 9.",
        blurb: "Page 1 of 9",
        icon: "hash",
        group: "Edit",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Pick a position and format, and where to start counting.",
          "Download the numbered PDF.",
        ],
      },
      {
        slug: "watermark",
        title: "Watermark a PDF",
        name: "Watermark",
        description: "Stamp text like CONFIDENTIAL or DRAFT across every page.",
        blurb: "Confidential, draft",
        icon: "stamp",
        group: "Edit",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Type the text, then set its size, angle and opacity.",
          "Download the watermarked PDF.",
        ],
      },
      {
        slug: "metadata",
        title: "Edit or remove PDF metadata",
        name: "Edit metadata",
        description:
          "Change the title and author, or remove all document info.",
        blurb: "Title, author, cleanup",
        icon: "info",
        group: "Edit",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Edit the title, author and other fields, or remove them all.",
          "Download the updated PDF.",
        ],
      },
      {
        slug: "from-image",
        title: "Convert images to PDF",
        name: "Image to PDF",
        description:
          "Turn photos and scans into one PDF, on A4, Letter or the image size.",
        blurb: "JPG, PNG to PDF",
        icon: "file",
        group: "Convert",
        ready: true,
        steps: [
          "Drop photos or scans.",
          "Drag them into order, then pick the page size and margins.",
          "Download one PDF.",
        ],
      },
      {
        slug: "to-image",
        title: "Convert PDF to JPG or PNG",
        name: "PDF to image",
        description: "Save pages as JPG or PNG at screen or print quality.",
        blurb: "Pages as JPG or PNG",
        icon: "image",
        group: "Convert",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Pick JPG or PNG and the quality. In Advanced, click pages to save only those.",
          "Download the images, zipped when there are several.",
        ],
      },
      {
        slug: "to-text",
        title: "Extract text from a PDF",
        name: "PDF to text",
        description: "Copy all the text out of a PDF, page by page.",
        blurb: "Copy all text",
        icon: "type",
        group: "Convert",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Extract the text.",
          "Copy it, or download it as a .txt file.",
        ],
      },
    ],
    tasks: [
      {
        slug: "compress-pdf-100kb",
        tool: "compress",
        name: "Compress PDF to 100 KB",
        short: "Job and exam uploads",
        group: "For forms",
        title: "Compress a PDF to 100 KB",
        intro:
          "Job portals and exam forms often reject documents over 100 KB. Get your PDF under the limit, on your device.",
        about: [
          "Pages are redrawn as images at the best quality that fits. Short documents like certificates and IDs fit easily; long ones may need fewer pages.",
        ],
        preset: { target: 100 },
      },
      {
        slug: "compress-pdf-200kb",
        tool: "compress",
        name: "Compress PDF to 200 KB",
        short: "Certificates and IDs",
        group: "For forms",
        title: "Compress a PDF to 200 KB",
        intro:
          "Make certificates, transcripts and ID scans fit the 200 KB limit many forms set.",
        about: [
          "The best quality under 200 KB is found automatically. Text stays readable on screen.",
        ],
        preset: { target: 200 },
      },
      {
        slug: "compress-pdf-1mb",
        tool: "compress",
        name: "Compress PDF to 1 MB",
        short: "Email and visa uploads",
        group: "For forms",
        title: "Compress a PDF to 1 MB",
        intro:
          "Fit a long scan or photo-heavy PDF under 1 MB for email, visa and university portals.",
        about: [
          "1 MB keeps scans sharp enough to print. If it's still too big, try removing pages you don't need first.",
        ],
        preset: { target: 1024 },
      },
      {
        slug: "jpg-to-pdf",
        tool: "from-image",
        name: "JPG to PDF",
        short: "Photos into one file",
        group: "Convert",
        title: "Convert JPG to PDF",
        intro:
          "Put one or many JPG photos into a single PDF, in the order you choose.",
        about: [
          "Choose A4 or Letter for documents, or Same as image to keep each photo's own shape.",
        ],
        preset: {},
      },
      {
        slug: "scan-to-pdf",
        tool: "from-image",
        name: "Phone scans to PDF",
        short: "Pages photographed on a phone",
        group: "Convert",
        title: "Turn phone photos of documents into a PDF",
        intro:
          "Photographed a form or notes with your phone? Turn the pages into one PDF to send or upload.",
        about: [
          "Rotate any page that came out sideways, then pick Small file if the PDF must stay small.",
        ],
        preset: {},
      },
      {
        slug: "pdf-to-jpg",
        tool: "to-image",
        name: "PDF to JPG",
        short: "Every page as a photo",
        group: "Convert",
        title: "Convert PDF to JPG",
        intro:
          "Save each page of a PDF as a JPG image, for sharing, slides or social posts.",
        about: [
          "Good (150 dpi) suits screens. Pick Print (300 dpi) for sharp prints.",
        ],
        preset: { imgType: "image/jpeg" },
      },
      {
        slug: "pdf-to-png",
        tool: "to-image",
        name: "PDF to PNG",
        short: "Sharp text and diagrams",
        group: "Convert",
        title: "Convert PDF to PNG",
        intro: "Save PDF pages as PNG, which keeps text and diagrams crisp.",
        about: ["PNG files are larger than JPG but have no blur around text."],
        preset: { imgType: "image/png" },
      },
      {
        slug: "extract-pages",
        tool: "split",
        name: "Extract pages",
        short: "Keep only some pages",
        group: "Organize",
        title: "Extract pages from a PDF",
        intro:
          "Pull out the pages you need into a new PDF. The original isn't changed.",
        about: [
          "Type pages like 1, 3-5, or switch to Advanced and click them.",
        ],
        preset: { splitMode: "extract" },
      },
      {
        slug: "split-every-page",
        tool: "split",
        name: "Split every page",
        short: "One PDF per page",
        group: "Organize",
        title: "Split a PDF into single pages",
        intro: "Turn every page into its own PDF, all in one zip.",
        about: [
          "Handy for invoices and statements that should be filed one page at a time.",
        ],
        preset: { splitMode: "each" },
      },
    ],
  },
  {
    id: "vidtool",
    name: "Video tools",
    brand: ["Vid", "Tool"],
    locales: ["en", "bn"],
    short: "Video",
    tagline:
      "Compress, convert, trim and record videos in your browser. Everything runs on your device.",
    accent: {
      light: "#12a594",
      dark: "#2ebfae",
      softLight: "#e2f6f3",
      softDark: "#0f2a27",
    },
    live: true,
    devPort: 4323,
    toolGroups: ["Optimize", "Edit", "Convert", "Record and info"],
    popular: [
      "compress",
      "convert",
      "trim",
      "video-to-gif",
      "video-to-mp3",
      "screen-recorder",
      "compress-video-for-whatsapp",
      "mov-to-mp4",
      "instagram-reel-size",
      "resize",
      "mute",
    ],
    tools: [
      {
        slug: "compress",
        title: "Compress a video",
        name: "Compress video",
        description:
          "Make videos smaller for WhatsApp, email and uploads. Pick a quality or a target size in MB.",
        blurb: "Smaller files, set size",
        icon: "compress",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop a video.",
          "Pick a quality, or a size like 16 MB.",
          "Check the preview, then download.",
        ],
      },
      {
        slug: "convert",
        title: "Convert video to MP4, WebM or MOV",
        name: "Convert video",
        description:
          "Turn MOV, MKV, AVI, WebM and other videos into MP4 that plays everywhere, or into WebM.",
        blurb: "MOV, MKV, WebM to MP4",
        icon: "convert",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop one or more videos.",
          "Pick MP4 or WebM.",
          "Download the converted files.",
        ],
      },
      {
        slug: "resize",
        title: "Resize a video for any screen",
        name: "Resize video",
        description:
          "Change the resolution, or reshape a video for Reels, Shorts, TikTok or a square post with crop or padding.",
        blurb: "Reels, Shorts, square",
        icon: "resize",
        group: "Optimize",
        ready: true,
        steps: [
          "Drop a video.",
          "Pick a size or a shape like 9:16, then crop or pad.",
          "Preview it and download.",
        ],
      },
      {
        slug: "trim",
        title: "Trim or cut a video",
        name: "Trim video",
        description:
          "Cut the start and end off a video, or keep just the part you need.",
        blurb: "Cut start and end",
        icon: "scissors",
        group: "Edit",
        ready: true,
        steps: [
          "Drop a video.",
          "Drag the handles or type the start and end time.",
          "Download the trimmed clip.",
        ],
      },
      {
        slug: "rotate",
        title: "Rotate or flip a video",
        name: "Rotate video",
        description:
          "Turn a sideways video upright, or flip it horizontally or vertically.",
        blurb: "Turn and flip",
        icon: "rotate",
        group: "Edit",
        ready: true,
        steps: [
          "Drop a video.",
          "Rotate 90° or flip it.",
          "Download it the right way up.",
        ],
      },
      {
        slug: "speed",
        title: "Speed up or slow down a video",
        name: "Change speed",
        description:
          "Make a video faster or slower, from 0.25× to 4×, with or without the sound.",
        blurb: "Faster or slower",
        icon: "gauge",
        group: "Edit",
        ready: true,
        steps: ["Drop a video.", "Pick a speed.", "Preview and download."],
      },
      {
        slug: "merge",
        title: "Join videos into one",
        name: "Merge videos",
        description: "Put several clips together in the order you choose.",
        blurb: "Join clips",
        icon: "merge",
        group: "Edit",
        ready: true,
        steps: [
          "Drop two or more videos.",
          "Drag them into order.",
          "Download one video.",
        ],
      },
      {
        slug: "mute",
        title: "Remove the sound from a video",
        name: "Remove audio",
        description:
          "Make a silent copy of a video, without re-encoding the picture.",
        blurb: "Silent copy",
        icon: "volumeX",
        group: "Edit",
        ready: true,
        steps: [
          "Drop a video.",
          "The sound track is removed.",
          "Download the silent video.",
        ],
      },
      {
        slug: "video-to-gif",
        title: "Make a GIF from a video",
        name: "Video to GIF",
        description:
          "Turn a part of a video into a GIF, with the size, frame rate and length you choose.",
        blurb: "Clips to GIFs",
        icon: "film",
        group: "Convert",
        ready: true,
        steps: [
          "Drop a video and pick the part you want.",
          "Choose the width and frame rate.",
          "Download the GIF.",
        ],
      },
      {
        slug: "gif-to-video",
        title: "Convert a GIF to MP4",
        name: "GIF to video",
        description:
          "Turn GIFs into MP4 videos that are much smaller and play everywhere.",
        blurb: "Smaller than GIF",
        icon: "video",
        group: "Convert",
        ready: true,
        steps: ["Drop a GIF.", "It becomes an MP4.", "Download it."],
      },
      {
        slug: "video-to-mp3",
        title: "Extract the audio from a video",
        name: "Video to MP3",
        description: "Save the sound of a video as MP3, M4A or WAV.",
        blurb: "Audio from video",
        icon: "music",
        group: "Convert",
        ready: true,
        steps: [
          "Drop a video.",
          "Pick MP3, M4A or WAV.",
          "Download the audio.",
        ],
      },
      {
        slug: "extract-frames",
        title: "Save frames from a video as images",
        name: "Extract frames",
        description:
          "Grab a still from any moment, or export frames at an interval as JPG or PNG in a zip.",
        blurb: "Stills and thumbnails",
        icon: "image",
        group: "Convert",
        ready: true,
        steps: [
          "Drop a video.",
          "Pick a moment, or an interval.",
          "Download the images.",
        ],
      },
      {
        slug: "screen-recorder",
        title: "Record your screen",
        name: "Screen recorder",
        description:
          "Record your screen, a window or a tab, with your microphone if you like, and save it as a video.",
        blurb: "Screen, window or tab",
        icon: "record",
        group: "Record and info",
        ready: true,
        steps: [
          "Pick what to share and whether to record your microphone.",
          "Record, then stop.",
          "Preview and download the video.",
        ],
      },
      {
        slug: "video-info",
        title: "See a video's details",
        name: "Video info",
        description:
          "Read a video's resolution, length, frame rate, codecs, bitrate and more.",
        blurb: "Codecs, size, length",
        icon: "info",
        group: "Record and info",
        ready: true,
        steps: [
          "Drop a video.",
          "See its details at once.",
          "Copy them if you need to.",
        ],
      },
    ],
    tasks: [
      {
        slug: "compress-video-for-whatsapp",
        tool: "compress",
        name: "Compress for WhatsApp",
        short: "Under 16 MB",
        group: "For sharing",
        title: "Compress a video for WhatsApp",
        intro:
          "Make a video small enough to send on WhatsApp without it being squeezed into a blurry mess.",
        about: [
          "The video is made to fit under 16 MB, keeping as much quality as the length allows.",
        ],
        preset: { targetMB: 16 },
      },
      {
        slug: "compress-video-for-discord",
        tool: "compress",
        name: "Compress for Discord",
        short: "Under 10 MB",
        group: "For sharing",
        title: "Compress a video for Discord",
        intro: "Fit a video under Discord's 10 MB limit for free accounts.",
        about: [
          "Long videos are made smaller in resolution too, so they stay watchable.",
        ],
        preset: { targetMB: 10 },
      },
      {
        slug: "compress-video-for-email",
        tool: "compress",
        name: "Compress for email",
        short: "Under 25 MB",
        group: "For sharing",
        title: "Compress a video for email",
        intro: "Make a video small enough to attach to an email.",
        about: ["Most email services allow attachments up to 20–25 MB."],
        preset: { targetMB: 20 },
      },
      {
        slug: "mov-to-mp4",
        tool: "convert",
        name: "MOV to MP4",
        short: "iPhone videos",
        group: "Formats",
        title: "Convert MOV to MP4",
        intro:
          "Turn iPhone and QuickTime MOV files into MP4 that plays everywhere.",
        about: [
          "If the video is already H.264, it's repackaged without losing quality.",
        ],
        preset: { to: "mp4" },
      },
      {
        slug: "webm-to-mp4",
        tool: "convert",
        name: "WebM to MP4",
        short: "Screen recordings, web videos",
        group: "Formats",
        title: "Convert WebM to MP4",
        intro:
          "Turn WebM videos into MP4 for phones, editors and social media.",
        about: ["WebM is common for screen recordings and web downloads."],
        preset: { to: "mp4" },
      },
      {
        slug: "mkv-to-mp4",
        tool: "convert",
        name: "MKV to MP4",
        short: "Movies and recordings",
        group: "Formats",
        title: "Convert MKV to MP4",
        intro: "Turn MKV files into MP4.",
        about: [
          "Compatible tracks are copied as they are, which is fast and lossless.",
        ],
        preset: { to: "mp4" },
      },
      {
        slug: "mp4-to-gif",
        tool: "video-to-gif",
        name: "MP4 to GIF",
        short: "Short clips as GIFs",
        group: "Formats",
        title: "Convert MP4 to GIF",
        intro: "Turn a short MP4 clip into a GIF.",
        about: [
          "Keep GIFs short and small: 10 seconds at 480 px is usually plenty.",
        ],
        preset: {},
      },
      {
        slug: "instagram-reel-size",
        tool: "resize",
        name: "Instagram Reel size",
        short: "9:16, 1080×1920",
        group: "For social",
        title: "Resize a video for Instagram Reels",
        intro: "Make a video fit Instagram Reels at 1080×1920.",
        about: [
          "Pick crop to fill the screen, or pad to keep everything in view.",
        ],
        preset: { aspect: "9:16" },
      },
      {
        slug: "youtube-shorts-size",
        tool: "resize",
        name: "YouTube Shorts size",
        short: "9:16 vertical",
        group: "For social",
        title: "Resize a video for YouTube Shorts",
        intro: "Turn a landscape video into a vertical Short.",
        about: ["Shorts are vertical 9:16 and up to 3 minutes long."],
        preset: { aspect: "9:16" },
      },
      {
        slug: "tiktok-size",
        tool: "resize",
        name: "TikTok size",
        short: "9:16 vertical",
        group: "For social",
        title: "Resize a video for TikTok",
        intro: "Make a video fit TikTok's vertical format.",
        about: [
          "Use pad with a blurred background to keep a landscape video whole.",
        ],
        preset: { aspect: "9:16" },
      },
      {
        slug: "square-video",
        tool: "resize",
        name: "Square video",
        short: "1:1 for feeds",
        group: "For social",
        title: "Make a square video",
        intro: "Crop or pad a video to a 1:1 square for feeds and profiles.",
        about: [
          "Square videos take up more space in feeds than landscape ones.",
        ],
        preset: { aspect: "1:1" },
      },
      {
        slug: "speed-up-video",
        tool: "speed",
        name: "Speed up video",
        short: "2× and more",
        group: "Edits",
        title: "Speed up a video",
        intro: "Make a video play faster, like a timelapse.",
        about: [
          "The sound keeps its natural pitch at any speed, or you can remove it.",
        ],
        preset: { speed: 2 },
      },
      {
        slug: "slow-motion-video",
        tool: "speed",
        name: "Slow motion",
        short: "0.5× and slower",
        group: "Edits",
        title: "Make a slow-motion video",
        intro: "Slow a video down for a slow-motion effect.",
        about: [
          "Slow motion looks smoothest with videos shot at 60 fps or more.",
        ],
        preset: { speed: 0.5 },
      },
      {
        slug: "cut-video",
        tool: "trim",
        name: "Cut a video",
        short: "Keep the part you need",
        group: "Edits",
        title: "Cut a video online",
        intro: "Cut out the part of a video you want to keep.",
        about: [
          "When possible the cut is made without re-encoding, which is instant and lossless.",
        ],
        preset: {},
      },
      {
        slug: "rotate-video-90",
        tool: "rotate",
        name: "Rotate 90°",
        short: "Sideways phone videos",
        group: "Edits",
        title: "Rotate a video 90 degrees",
        intro: "Fix a video that was recorded sideways.",
        about: ["Choose left or right; the video is turned without cropping."],
        preset: { turn: 90 },
      },
    ],
  },
  {
    id: "devtool",
    name: "Developer tools",
    brand: ["Dev", "Tool"],
    locales: ["en", "bn"],
    short: "Dev",
    tagline:
      "Format JSON, decode tokens, hash files and convert data. Everything runs on your device.",
    accent: {
      light: "#8e4ec6",
      dark: "#b07ce6",
      softLight: "#f3ebfb",
      softDark: "#2a1b3a",
    },
    live: true,
    devPort: 4324,
    toolGroups: [
      "Format",
      "Encode",
      "Generate",
      "Convert",
      "Text",
      "Reference",
    ],
    popular: [
      "json-formatter",
      "base64",
      "jwt-decoder",
      "uuid",
      "timestamp",
      "diff-checker",
      "regex-tester",
      "hash",
      "json-validator",
      "csv-to-json",
      "epoch-to-date",
    ],
    tools: [
      {
        slug: "json-formatter",
        title: "JSON formatter and validator",
        name: "JSON formatter",
        description:
          "Format, validate and minify JSON. Errors point to the exact line, and a tree view helps you explore.",
        blurb: "Format, validate, tree",
        icon: "braces",
        group: "Format",
        ready: true,
        steps: [
          "Paste JSON or open a file.",
          "Pick an indent, or minify it. Errors show the line and column.",
          "Copy or download the result.",
        ],
      },
      {
        slug: "yaml-json",
        title: "Convert YAML to JSON and back",
        name: "YAML ↔ JSON",
        description:
          "Turn YAML into JSON or JSON into YAML, with clear errors for bad indentation.",
        blurb: "Both directions",
        icon: "convert",
        group: "Format",
        ready: true,
        steps: [
          "Paste YAML or JSON.",
          "The other format appears as you type.",
          "Copy or download it.",
        ],
      },
      {
        slug: "xml-formatter",
        title: "XML formatter and validator",
        name: "XML formatter",
        description: "Indent, validate and minify XML, SVG and RSS.",
        blurb: "Indent, validate, minify",
        icon: "code",
        group: "Format",
        ready: true,
        steps: [
          "Paste XML or open a file.",
          "Choose the indent, or minify it.",
          "Copy or download the result.",
        ],
      },
      {
        slug: "sql-formatter",
        title: "SQL formatter",
        name: "SQL formatter",
        description:
          "Make long SQL readable: keywords in capitals, clauses on their own lines. Works with common dialects.",
        blurb: "Readable queries",
        icon: "list",
        group: "Format",
        ready: true,
        steps: [
          "Paste a query.",
          "Pick the dialect and keyword case.",
          "Copy the formatted SQL.",
        ],
      },
      {
        slug: "html-formatter",
        title: "HTML formatter and minifier",
        name: "HTML formatter",
        description: "Beautify messy HTML or minify it for production.",
        blurb: "Beautify or minify",
        icon: "code",
        group: "Format",
        ready: true,
        steps: [
          "Paste HTML.",
          "Beautify it, or minify it.",
          "Copy or download the result.",
        ],
      },
      {
        slug: "css-formatter",
        title: "CSS formatter and minifier",
        name: "CSS formatter",
        description: "Beautify or minify CSS, and see how many bytes you save.",
        blurb: "Beautify or minify",
        icon: "code",
        group: "Format",
        ready: true,
        steps: [
          "Paste CSS.",
          "Beautify it, or minify it.",
          "Copy or download the result.",
        ],
      },
      {
        slug: "js-formatter",
        title: "JavaScript formatter and minifier",
        name: "JavaScript formatter",
        description: "Beautify or minify JavaScript and TypeScript.",
        blurb: "Beautify or minify",
        icon: "terminal",
        group: "Format",
        ready: true,
        steps: [
          "Paste JavaScript or TypeScript.",
          "Beautify it, or minify it.",
          "Copy or download the result.",
        ],
      },
      {
        slug: "markdown-preview",
        title: "Markdown editor with live preview",
        name: "Markdown preview",
        description:
          "Write Markdown and see it rendered as you type. Copy the HTML or download it.",
        blurb: "Live preview, HTML out",
        icon: "type",
        group: "Format",
        ready: true,
        steps: [
          "Write or paste Markdown.",
          "The preview updates as you type.",
          "Copy the HTML or download the file.",
        ],
      },
      {
        slug: "base64",
        title: "Base64 encode and decode",
        name: "Base64",
        description:
          "Encode text or any file to Base64, or decode Base64 back to text or a file.",
        blurb: "Text and files",
        icon: "binary",
        group: "Encode",
        ready: true,
        steps: [
          "Paste text or Base64, or drop a file.",
          "Pick encode or decode. URL-safe Base64 is supported.",
          "Copy the result or download the file.",
        ],
      },
      {
        slug: "url-encode",
        title: "URL encode and decode",
        name: "URL encode",
        description:
          "Encode and decode URL components and full URLs, including query strings.",
        blurb: "Percent-encoding",
        icon: "link",
        group: "Encode",
        ready: true,
        steps: [
          "Paste text or an encoded URL.",
          "Pick encode or decode.",
          "Copy the result.",
        ],
      },
      {
        slug: "html-entities",
        title: "HTML entities encode and decode",
        name: "HTML entities",
        description:
          "Escape text for HTML (&lt; &amp; &quot;) or turn entities back into characters.",
        blurb: "Escape and unescape",
        icon: "code",
        group: "Encode",
        ready: true,
        steps: [
          "Paste text or HTML.",
          "Pick escape or unescape.",
          "Copy the result.",
        ],
      },
      {
        slug: "jwt-decoder",
        title: "JWT decoder",
        name: "JWT decoder",
        description:
          "Read a JSON Web Token's header and payload, see when it expires, and check an HS256 signature with your secret.",
        blurb: "Header, payload, expiry",
        icon: "key",
        group: "Encode",
        ready: true,
        steps: [
          "Paste a token.",
          "Read the header, payload and dates.",
          "Optionally check the signature with your secret.",
        ],
      },
      {
        slug: "unicode-escape",
        title: "Unicode escape and unescape",
        name: "Unicode escape",
        description:
          "Turn text into \\u escapes, code points or JSON string escapes, and back.",
        blurb: "\\u, code points, JSON",
        icon: "type",
        group: "Encode",
        ready: true,
        steps: [
          "Paste text or escapes.",
          "Pick the escape style.",
          "Copy the result.",
        ],
      },
      {
        slug: "text-hex",
        title: "Text to hex, binary and back",
        name: "Text to hex and binary",
        description:
          "Convert text to hex, binary or decimal bytes (UTF-8), and back to text.",
        blurb: "Hex, binary, bytes",
        icon: "binary",
        group: "Encode",
        ready: true,
        steps: [
          "Paste text or bytes.",
          "Pick hex, binary or decimal.",
          "Copy the result.",
        ],
      },
      {
        slug: "uuid",
        title: "UUID generator",
        name: "UUID generator",
        description:
          "Make UUID v4 and v7 or ULIDs, one or a thousand at a time.",
        blurb: "v4, v7, ULID",
        icon: "shuffle",
        group: "Generate",
        ready: true,
        steps: [
          "Pick the type and how many.",
          "Choose uppercase or no dashes if you need them.",
          "Copy them or download a list.",
        ],
      },
      {
        slug: "password-generator",
        title: "Password generator",
        name: "Password generator",
        description:
          "Strong random passwords and passphrases, made with your browser's secure random generator.",
        blurb: "Strong and random",
        icon: "lock",
        group: "Generate",
        ready: true,
        steps: [
          "Pick the length and the characters to use.",
          "See how strong it is.",
          "Copy it. It exists only on your screen.",
        ],
      },
      {
        slug: "hash",
        title: "Hash generator",
        name: "Hash generator",
        description:
          "MD5, SHA-1, SHA-256 and SHA-512 for text or files, plus HMAC with a secret key.",
        blurb: "SHA-256, MD5, HMAC",
        icon: "hash",
        group: "Generate",
        ready: true,
        steps: [
          "Paste text or drop a file.",
          "Every hash appears at once. Add a key for HMAC.",
          "Copy the one you need, or compare with a checksum.",
        ],
      },
      {
        slug: "lorem-ipsum",
        title: "Lorem ipsum generator",
        name: "Lorem ipsum",
        description:
          "Placeholder text by paragraphs, sentences or words, as plain text or HTML.",
        blurb: "Placeholder text",
        icon: "type",
        group: "Generate",
        ready: true,
        steps: [
          "Pick paragraphs, sentences or words.",
          "Choose how many, and plain text or HTML.",
          "Copy it.",
        ],
      },
      {
        slug: "fake-data",
        title: "Fake test data generator",
        name: "Fake data",
        description:
          "Realistic test data: names, emails, addresses, dates and IDs, as JSON, CSV or SQL.",
        blurb: "JSON, CSV or SQL",
        icon: "table",
        group: "Generate",
        ready: true,
        steps: [
          "Pick the fields you need.",
          "Choose how many rows and the format.",
          "Copy or download it.",
        ],
      },
      {
        slug: "timestamp",
        title: "Unix timestamp converter",
        name: "Timestamp converter",
        description:
          "Convert Unix timestamps to dates and back, in seconds or milliseconds, in your time zone and UTC.",
        blurb: "Epoch ↔ date",
        icon: "clock",
        group: "Convert",
        ready: true,
        steps: [
          "Paste a timestamp or pick a date.",
          "See it in local time, UTC and ISO 8601.",
          "Copy the format you need.",
        ],
      },
      {
        slug: "number-base",
        title: "Number base converter",
        name: "Number base converter",
        description:
          "Convert numbers between binary, octal, decimal, hex and any base up to 36, including very large numbers.",
        blurb: "Binary, hex, decimal",
        icon: "binary",
        group: "Convert",
        ready: true,
        steps: [
          "Type a number in any base.",
          "Every other base updates.",
          "Copy the one you need.",
        ],
      },
      {
        slug: "color-converter",
        title: "Color converter and contrast checker",
        name: "Color converter",
        description:
          "Convert colors between HEX, RGB, HSL and OKLCH, and check text contrast against WCAG.",
        blurb: "HEX, RGB, HSL, OKLCH",
        icon: "palette",
        group: "Convert",
        ready: true,
        steps: [
          "Type a color in any format, or pick one.",
          "Every format updates.",
          "Check the contrast with a second color.",
        ],
      },
      {
        slug: "case-converter",
        title: "Case converter",
        name: "Case converter",
        description:
          "Switch text between camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Title Case and more.",
        blurb: "camelCase, snake_case",
        icon: "type",
        group: "Convert",
        ready: true,
        steps: [
          "Paste text or identifiers.",
          "Every case appears at once.",
          "Copy the one you need.",
        ],
      },
      {
        slug: "csv-json",
        title: "CSV, JSON and Excel converter",
        name: "CSV ↔ JSON",
        description:
          "Convert CSV to JSON, JSON to CSV, and read Excel sheets, with a table preview.",
        blurb: "CSV, JSON, Excel",
        icon: "table",
        group: "Convert",
        ready: true,
        steps: [
          "Paste CSV or JSON, or drop a CSV or Excel file.",
          "Check the table preview and the options.",
          "Copy or download the result.",
        ],
      },
      {
        slug: "json-to-typescript",
        title: "JSON to TypeScript types",
        name: "JSON to TypeScript",
        description:
          "Turn sample JSON into TypeScript interfaces, with nested types and optional fields.",
        blurb: "Interfaces from samples",
        icon: "braces",
        group: "Convert",
        ready: true,
        steps: [
          "Paste a JSON sample.",
          "Name the root type and pick interface or type.",
          "Copy the TypeScript.",
        ],
      },
      {
        slug: "curl-converter",
        title: "cURL to code converter",
        name: "cURL converter",
        description:
          "Turn a cURL command into fetch, axios, Python requests or Go code.",
        blurb: "fetch, axios, Python",
        icon: "terminal",
        group: "Convert",
        ready: true,
        steps: [
          "Paste a cURL command.",
          "Pick the language.",
          "Copy the code.",
        ],
      },
      {
        slug: "diff-checker",
        title: "Text diff checker",
        name: "Diff checker",
        description:
          "Compare two texts and see what changed, line by line or word by word.",
        blurb: "Compare two texts",
        icon: "diff",
        group: "Text",
        ready: true,
        steps: [
          "Paste the original and the changed text.",
          "See additions and removals side by side or inline.",
          "Ignore spaces or case if you like.",
        ],
      },
      {
        slug: "regex-tester",
        title: "Regex tester",
        name: "Regex tester",
        description:
          "Test regular expressions live with highlighted matches, groups and a plain-English explanation.",
        blurb: "Matches, groups, replace",
        icon: "regex",
        group: "Text",
        ready: true,
        steps: [
          "Type a pattern and pick flags.",
          "Paste test text. Matches are highlighted.",
          "Try a replacement, then copy the pattern.",
        ],
      },
      {
        slug: "line-tools",
        title: "Sort, dedupe and count lines",
        name: "Line tools",
        description:
          "Sort, reverse, shuffle and remove duplicate or empty lines, and count words and characters.",
        blurb: "Sort, dedupe, count",
        icon: "list",
        group: "Text",
        ready: true,
        steps: [
          "Paste text.",
          "Pick what to do with the lines.",
          "Copy the result.",
        ],
      },
      {
        slug: "slug-generator",
        title: "URL slug generator",
        name: "Slug generator",
        description:
          "Make clean URL slugs from titles, with accents removed and your choice of separator.",
        blurb: "Clean URL slugs",
        icon: "link",
        group: "Text",
        ready: true,
        steps: [
          "Paste titles, one per line.",
          "Pick the separator and case.",
          "Copy the slugs.",
        ],
      },
      {
        slug: "cron-explainer",
        title: "Cron expression explainer",
        name: "Cron explainer",
        description:
          "Read a cron expression in plain English and see the next run times.",
        blurb: "Plain English, next runs",
        icon: "clock",
        group: "Reference",
        ready: true,
        steps: [
          "Type a cron expression.",
          "Read what it means.",
          "Check the next run times in your time zone.",
        ],
      },
      {
        slug: "chmod-calculator",
        title: "Chmod calculator",
        name: "Chmod calculator",
        description:
          "Work out Unix file permissions: tick boxes, get 755 and rwxr-xr-x, or the other way round.",
        blurb: "755 ↔ rwxr-xr-x",
        icon: "lock",
        group: "Reference",
        ready: true,
        steps: [
          "Tick read, write and run for owner, group and others.",
          "Or type a number like 644.",
          "Copy the chmod command.",
        ],
      },
      {
        slug: "url-parser",
        title: "URL parser",
        name: "URL parser",
        description:
          "Split a URL into its parts and edit the query string as a table.",
        blurb: "Parts and query",
        icon: "globe",
        group: "Reference",
        ready: true,
        steps: [
          "Paste a URL.",
          "See the protocol, host, path, query and hash.",
          "Edit the query and copy the new URL.",
        ],
      },
      {
        slug: "http-status",
        title: "HTTP status codes",
        name: "HTTP status codes",
        description:
          "Every HTTP status code with a plain explanation and when to use it.",
        blurb: "What each code means",
        icon: "book",
        group: "Reference",
        ready: true,
        steps: [
          "Search by number or name.",
          "Read what it means and when to use it.",
          "Copy the code or its name.",
        ],
      },
    ],
    tasks: [
      {
        slug: "json-validator",
        tool: "json-formatter",
        name: "JSON validator",
        short: "Find the error fast",
        group: "Format",
        title: "Validate JSON",
        intro:
          "Paste JSON to check it's valid. Errors show the exact line and column, with a hint for common mistakes.",
        about: [
          "Trailing commas and single quotes are the most common causes of invalid JSON.",
        ],
        preset: { mode: "validate" },
      },
      {
        slug: "json-minify",
        tool: "json-formatter",
        name: "Minify JSON",
        short: "Smallest valid JSON",
        group: "Format",
        title: "Minify JSON",
        intro: "Remove whitespace from JSON to make it as small as possible.",
        about: ["Minified JSON is still valid; it's just harder to read."],
        preset: { mode: "minify" },
      },
      {
        slug: "yaml-to-json",
        tool: "yaml-json",
        name: "YAML to JSON",
        short: "Configs to JSON",
        group: "Format",
        title: "Convert YAML to JSON",
        intro: "Paste YAML from a config file and get JSON.",
        about: ["Comments in YAML have no place in JSON, so they're dropped."],
        preset: { from: "yaml" },
      },
      {
        slug: "json-to-yaml",
        tool: "yaml-json",
        name: "JSON to YAML",
        short: "Readable configs",
        group: "Format",
        title: "Convert JSON to YAML",
        intro: "Paste JSON and get clean YAML for configs and CI files.",
        about: ["Keys keep their order."],
        preset: { from: "json" },
      },
      {
        slug: "base64-decode",
        tool: "base64",
        name: "Base64 decode",
        short: "Base64 back to text",
        group: "Encode",
        title: "Decode Base64",
        intro:
          "Paste Base64 and get the original text, or download it as a file.",
        about: ["URL-safe Base64 (with - and _) works too."],
        preset: { mode: "decode" },
      },
      {
        slug: "url-decode",
        tool: "url-encode",
        name: "URL decode",
        short: "Readable URLs",
        group: "Encode",
        title: "Decode a URL",
        intro: "Turn %20 and other percent-encoding back into readable text.",
        about: [
          "A + in a query string means a space; you can choose how to treat it.",
        ],
        preset: { mode: "decode" },
      },
      {
        slug: "sha256",
        tool: "hash",
        name: "SHA-256 hash",
        short: "Checksums and signatures",
        group: "Generate",
        title: "SHA-256 hash generator",
        intro:
          "Get the SHA-256 hash of text or a file, or check a download against its published checksum.",
        about: ["Files are hashed on your device, so they stay private."],
        preset: { algo: "SHA-256" },
      },
      {
        slug: "md5",
        tool: "hash",
        name: "MD5 hash",
        short: "Legacy checksums",
        group: "Generate",
        title: "MD5 hash generator",
        intro: "Get the MD5 hash of text or a file.",
        about: ["MD5 is fine for checksums but not for passwords or security."],
        preset: { algo: "MD5" },
      },
      {
        slug: "uuid-v4",
        tool: "uuid",
        name: "UUID v4",
        short: "Random IDs",
        group: "Generate",
        title: "UUID v4 generator",
        intro: "Random version 4 UUIDs, one or many at a time.",
        about: [
          "v4 UUIDs are random; v7 UUIDs sort by time, which suits database keys.",
        ],
        preset: { version: "v4" },
      },
      {
        slug: "epoch-to-date",
        tool: "timestamp",
        name: "Epoch to date",
        short: "Read Unix times",
        group: "Convert",
        title: "Convert epoch time to a date",
        intro:
          "Paste a Unix timestamp in seconds or milliseconds and see the date.",
        about: [
          "Ten digits are seconds; thirteen are milliseconds. Both are detected.",
        ],
        preset: {},
      },
      {
        slug: "hex-to-rgb",
        tool: "color-converter",
        name: "HEX to RGB",
        short: "Color codes",
        group: "Convert",
        title: "Convert HEX to RGB",
        intro: "Turn #ff8800 into rgb(255, 136, 0), HSL and OKLCH.",
        about: ["Short HEX like #f80 and HEX with alpha work too."],
        preset: { color: "#ff8800" },
      },
      {
        slug: "csv-to-json",
        tool: "csv-json",
        name: "CSV to JSON",
        short: "Spreadsheets to JSON",
        group: "Convert",
        title: "Convert CSV to JSON",
        intro:
          "Paste CSV or drop a file and get an array of objects, using the first row as keys.",
        about: ["Commas, tabs and semicolons are detected automatically."],
        preset: { from: "csv" },
      },
      {
        slug: "json-to-csv",
        tool: "csv-json",
        name: "JSON to CSV",
        short: "JSON to spreadsheets",
        group: "Convert",
        title: "Convert JSON to CSV",
        intro:
          "Turn an array of objects into CSV that opens in Excel and Google Sheets.",
        about: ["Nested objects are flattened into dotted column names."],
        preset: { from: "json" },
      },
      {
        slug: "excel-to-json",
        tool: "csv-json",
        name: "Excel to JSON",
        short: "Sheets to JSON",
        group: "Convert",
        title: "Convert Excel to JSON",
        intro: "Drop an .xlsx file and get each sheet as JSON.",
        about: [
          "The file is read in your browser; it never leaves your device.",
        ],
        preset: { from: "excel" },
      },
      {
        slug: "camel-case",
        tool: "case-converter",
        name: "camelCase converter",
        short: "Names for code",
        group: "Convert",
        title: "Convert text to camelCase",
        intro: "Turn phrases and snake_case names into camelCase.",
        about: ["Acronyms like ID and URL are kept readable."],
        preset: { case: "camel" },
      },
      {
        slug: "compare-text",
        tool: "diff-checker",
        name: "Compare text",
        short: "Two versions, side by side",
        group: "Text",
        title: "Compare two texts",
        intro: "Paste two versions and see exactly what changed.",
        about: ["Use word mode for prose and line mode for code."],
        preset: {},
      },
    ],
  },
  {
    id: "qrtool",
    name: "QR tools",
    brand: ["QR", "Tool"],
    locales: ["en", "bn"],
    short: "QR",
    tagline:
      "Make and scan QR codes and barcodes in your browser. No sign-up, no tracking links.",
    accent: {
      light: "#f76b15",
      dark: "#ff8b3e",
      softLight: "#feeee3",
      softDark: "#3a2312",
    },
    live: true,
    devPort: 4325,
    toolGroups: ["Create", "Scan", "Check and fix"],
    popular: [
      "generator",
      "scanner",
      "wifi-qr",
      "barcode",
      "bulk",
      "whatsapp-qr",
      "wifi-card",
      "checker",
      "event-qr",
      "upi-qr",
      "data-matrix",
    ],
    tools: [
      {
        slug: "generator",
        title: "QR code generator",
        name: "QR code generator",
        description:
          "QR codes for links, text, Wi-Fi, contacts and more. Style them, add a logo, download PNG or SVG.",
        blurb: "Links, Wi-Fi, contacts",
        icon: "grid",
        group: "Create",
        ready: true,
        steps: [
          "Pick what the code is for: a link, Wi-Fi, a contact, text and more.",
          "Fill it in. The code updates as you type. Choose colours and a style.",
          "Download PNG for printing or SVG for designs. The code never expires.",
        ],
      },
      {
        slug: "scanner",
        title: "Scan a QR code or barcode",
        name: "QR scanner",
        description:
          "Read QR codes and barcodes with your camera or from a photo or screenshot.",
        blurb: "Camera or image",
        icon: "scanFace",
        group: "Scan",
        ready: true,
        steps: [
          "Allow the camera and point it at a code, or drop a photo or screenshot.",
          "The code is read on your device.",
          "Copy the result, join the Wi-Fi, or check the link before you open it.",
        ],
      },
      {
        slug: "barcode",
        title: "Barcode generator",
        name: "Barcode generator",
        description:
          "Code 128, EAN-13, UPC-A, Code 39 and more, as PNG or SVG.",
        blurb: "EAN, UPC, Code 128",
        icon: "hash",
        group: "Create",
        ready: true,
        steps: [
          "Pick the barcode type you need.",
          "Type the number or text. Check digits are added for you.",
          "Download PNG or SVG.",
        ],
      },
      {
        slug: "bulk",
        title: "Bulk QR code generator",
        name: "Bulk QR codes",
        description:
          "Paste a list and get a QR code for every line, all in one zip.",
        blurb: "One per line, zipped",
        icon: "layers",
        group: "Create",
        ready: true,
        steps: [
          "Paste links or text, one per line. Optionally add a name before a comma.",
          "Pick the size, colours and format.",
          "Download every code in one zip, named by line.",
        ],
      },
      {
        slug: "codes-2d",
        title: "Data Matrix, PDF417 and Aztec generator",
        name: "2D code generator",
        description:
          "Data Matrix, PDF417, Aztec and Micro QR codes for labels, parts, tickets and IDs, as PNG or SVG.",
        blurb: "Data Matrix, PDF417, Aztec",
        icon: "layout",
        group: "Create",
        ready: true,
        steps: [
          "Pick the code type: Data Matrix, PDF417, Aztec or Micro QR.",
          "Type the text or number. The code updates as you type.",
          "Download PNG or SVG.",
        ],
      },
      {
        slug: "wifi-card",
        title: "Wi-Fi card maker",
        name: "Wi-Fi card",
        description:
          "A printable card with your Wi-Fi QR code, network name and password, for guests, cafés and offices.",
        blurb: "Print it for guests",
        icon: "idCard",
        group: "Create",
        ready: true,
        steps: [
          "Type the network name and password.",
          "Pick a size, a title and colours.",
          "Print it, or download PNG or PDF.",
        ],
      },
      {
        slug: "batch-scan",
        title: "Scan many QR codes and barcodes at once",
        name: "Batch scanner",
        description:
          "Drop many photos or screenshots and read every code in them, as one list you can copy or save as CSV.",
        blurb: "Many images, one list",
        icon: "camera",
        group: "Scan",
        ready: true,
        steps: [
          "Drop or paste images. Each can hold several codes.",
          "Every code is read on your device and listed with its file.",
          "Copy the list or download it as CSV.",
        ],
      },
      {
        slug: "checker",
        title: "QR code checker",
        name: "QR code checker",
        description:
          "Test a QR code before you print it: does it scan, how small can it go, and are the contrast and margins right.",
        blurb: "Test before you print",
        icon: "shield",
        group: "Check and fix",
        ready: true,
        steps: [
          "Drop your QR code design or a photo of it.",
          "It's read at several sizes and checked for contrast and margins.",
          "Fix anything marked, then check again.",
        ],
      },
      {
        slug: "fix-qr",
        title: "Turn a blurry QR code into a sharp one",
        name: "QR code cleaner",
        description:
          "Make a crisp, print-ready copy of a QR code from a screenshot or photo, as PNG or SVG.",
        blurb: "Blurry photo to sharp SVG",
        icon: "magic",
        group: "Check and fix",
        ready: true,
        steps: [
          "Drop a photo or screenshot that has the QR code.",
          "The code is read and redrawn exactly, with clean edges.",
          "Pick colours and size, then download PNG or SVG.",
        ],
      },
    ],
    tasks: [
      {
        slug: "wifi-qr",
        tool: "generator",
        name: "Wi-Fi QR code",
        short: "Guests join without typing",
        group: "Popular codes",
        title: "Make a Wi-Fi QR code",
        intro:
          "Guests scan it with their phone camera and join your Wi-Fi without typing the password. Print it for your home, café or office.",
        about: [
          "Works with the built-in camera on iPhone and Android. Your network name and password stay on your device.",
        ],
        preset: { type: "wifi" },
      },
      {
        slug: "whatsapp-qr",
        tool: "generator",
        name: "WhatsApp QR code",
        short: "Start a chat in one scan",
        group: "Popular codes",
        title: "Make a WhatsApp QR code",
        intro:
          "People scan it and a WhatsApp chat with you opens, with an optional message already typed. Great for shops and business cards.",
        about: [
          "Use your number with the country code, for example 8801712345678.",
        ],
        preset: { type: "whatsapp" },
      },
      {
        slug: "contact-qr",
        tool: "generator",
        name: "Contact QR code",
        short: "Save your details in one scan",
        group: "Popular codes",
        title: "Make a contact (vCard) QR code",
        intro:
          "Put your name, phone, email and company in a QR code. Scanning it offers to save you as a contact.",
        about: ["Add it to business cards, name badges and email signatures."],
        preset: { type: "vcard" },
      },
      {
        slug: "link-qr",
        tool: "generator",
        name: "Link QR code",
        short: "Website, menu, form",
        group: "Popular codes",
        title: "Make a QR code for a link",
        intro:
          "Point people to a website, menu, form or video. The code is permanent: no sign-up, no redirect, no expiry.",
        about: [
          "Many free QR sites use their own redirect links that stop working or show ads. These codes contain your link directly.",
        ],
        preset: { type: "url" },
      },
      {
        slug: "email-qr",
        tool: "generator",
        name: "Email QR code",
        short: "Pre-filled email",
        group: "More codes",
        title: "Make an email QR code",
        intro:
          "Scanning opens a new email to you with the subject and message filled in.",
        about: ["Handy for feedback, support and sign-up sheets."],
        preset: { type: "email" },
      },
      {
        slug: "sms-qr",
        tool: "generator",
        name: "SMS QR code",
        short: "Text message ready to send",
        group: "More codes",
        title: "Make an SMS QR code",
        intro:
          "Scanning opens a text message to your number with the message already written.",
        about: ["Good for votes, sign-ups and opt-in keywords."],
        preset: { type: "sms" },
      },
      {
        slug: "location-qr",
        tool: "generator",
        name: "Location QR code",
        short: "Open a place in maps",
        group: "More codes",
        title: "Make a map location QR code",
        intro: "Scanning opens a location in the phone's maps app.",
        about: [
          "Paste coordinates from your maps app, for example 23.8103, 90.4125.",
        ],
        preset: { type: "geo" },
      },
      {
        slug: "ean-13",
        tool: "barcode",
        name: "EAN-13 barcode",
        short: "Retail product codes",
        group: "Barcodes",
        title: "Make an EAN-13 barcode",
        intro:
          "Make the 13-digit barcode used on retail products. Type 12 digits and the check digit is added.",
        about: [
          "Shops can only sell products with EAN numbers registered to your company through GS1. This makes the barcode image for a number you already have.",
        ],
        preset: { format: "EAN13" },
      },
      {
        slug: "code-128",
        tool: "barcode",
        name: "Code 128 barcode",
        short: "Labels, shipping, inventory",
        group: "Barcodes",
        title: "Make a Code 128 barcode",
        intro:
          "Code 128 holds letters and numbers in a compact barcode, ideal for labels, inventory and shipping.",
        about: [
          "Any scanner reads Code 128. It's the safest choice when you're not told which type to use.",
        ],
        preset: { format: "CODE128" },
      },
      {
        slug: "scan-qr-from-image",
        tool: "scanner",
        name: "Scan QR from image",
        short: "Screenshots and photos",
        group: "Scan",
        title: "Scan a QR code from an image or screenshot",
        intro:
          "Got a QR code in a screenshot or a photo? Drop it here to read it, no second phone needed.",
        about: [
          "Paste a screenshot straight from the clipboard. Several codes in one image are all read.",
        ],
        preset: { mode: "image" },
      },
      {
        slug: "event-qr",
        tool: "generator",
        name: "Event QR code",
        short: "Add to calendar in one scan",
        group: "More codes",
        title: "Make a calendar event QR code",
        intro:
          "Put a date, time and place in a QR code. Scanning it offers to add the event to the phone's calendar.",
        about: [
          "Good for invitations, posters, classes and meetings. Times are saved in the scanner's own time zone.",
        ],
        preset: { type: "event" },
      },
      {
        slug: "instagram-qr",
        tool: "generator",
        name: "Instagram QR code",
        short: "Open your profile",
        group: "Social",
        title: "Make an Instagram QR code",
        intro:
          "Type your username and get a QR code that opens your Instagram profile.",
        about: ["Put it on flyers, packaging and shop counters."],
        preset: { type: "social", platform: "instagram" },
      },
      {
        slug: "facebook-qr",
        tool: "generator",
        name: "Facebook QR code",
        short: "Page or profile",
        group: "Social",
        title: "Make a Facebook QR code",
        intro:
          "A QR code that opens your Facebook page or profile. Type the page name from its link.",
        about: ["For pages, use the name after facebook.com/ in the address."],
        preset: { type: "social", platform: "facebook" },
      },
      {
        slug: "youtube-qr",
        tool: "generator",
        name: "YouTube QR code",
        short: "Channel or video",
        group: "Social",
        title: "Make a YouTube QR code",
        intro:
          "A QR code that opens your YouTube channel. For one video, paste its link in the Link type instead.",
        about: ["Use your handle, for example @kmra."],
        preset: { type: "social", platform: "youtube" },
      },
      {
        slug: "telegram-qr",
        tool: "generator",
        name: "Telegram QR code",
        short: "Chat, group or channel",
        group: "Social",
        title: "Make a Telegram QR code",
        intro:
          "A QR code that opens a chat with you, or your public group or channel, on Telegram.",
        about: ["Use the username from your Telegram profile, without the @."],
        preset: { type: "social", platform: "telegram" },
      },
      {
        slug: "upi-qr",
        tool: "generator",
        name: "UPI payment QR",
        short: "Get paid in any UPI app",
        group: "Payments",
        title: "Make a UPI payment QR code",
        intro:
          "Customers scan it with Google Pay, PhonePe, Paytm or any UPI app and pay your UPI ID, with an optional fixed amount.",
        about: [
          "The code holds your UPI ID and name only. Payments go straight to you; nothing passes through this site.",
        ],
        preset: { type: "pay", method: "upi" },
      },
      {
        slug: "sepa-qr",
        tool: "generator",
        name: "Bank transfer QR (SEPA)",
        short: "EPC code for invoices",
        group: "Payments",
        title: "Make a SEPA bank transfer QR code (EPC / GiroCode)",
        intro:
          "Add an EPC QR code to invoices. Banking apps in the euro area fill in the IBAN, name, amount and reference when it's scanned.",
        about: [
          "Follows the European Payments Council standard (also called GiroCode). Amounts are in euros.",
        ],
        preset: { type: "pay", method: "epc" },
      },
      {
        slug: "bitcoin-qr",
        tool: "generator",
        name: "Bitcoin QR code",
        short: "Wallet address and amount",
        group: "Payments",
        title: "Make a Bitcoin payment QR code",
        intro:
          "A QR code with your wallet address and, if you like, an amount and label. Wallet apps read it to send payment.",
        about: [
          "Double-check the address: anything sent to a wrong address can't be recovered.",
        ],
        preset: { type: "pay", method: "bitcoin" },
      },
      {
        slug: "data-matrix",
        tool: "codes-2d",
        name: "Data Matrix code",
        short: "Small parts and labels",
        group: "Barcodes",
        title: "Make a Data Matrix code",
        intro:
          "Data Matrix fits a lot of text into a tiny square. It's used on electronics, medicine packs and part labels.",
        about: [
          "Scanners and phone apps that read QR codes usually read Data Matrix too.",
        ],
        preset: { format: "DataMatrix" },
      },
      {
        slug: "pdf417",
        tool: "codes-2d",
        name: "PDF417 barcode",
        short: "IDs, tickets, boarding passes",
        group: "Barcodes",
        title: "Make a PDF417 barcode",
        intro:
          "PDF417 is the stacked barcode on ID cards, driving licences and boarding passes. It holds long text in a wide strip.",
        about: [
          "Make it wide enough to print: each row needs to stay readable.",
        ],
        preset: { format: "PDF417" },
      },
      {
        slug: "upc-a",
        tool: "barcode",
        name: "UPC-A barcode",
        short: "US and Canada products",
        group: "Barcodes",
        title: "Make a UPC-A barcode",
        intro:
          "The 12-digit barcode on products sold in the US and Canada. Type 11 digits and the check digit is added.",
        about: [
          "Like EAN, UPC numbers come from GS1. This makes the barcode image for a number you already have.",
        ],
        preset: { format: "UPC" },
      },
      {
        slug: "isbn-barcode",
        tool: "barcode",
        name: "ISBN barcode",
        short: "Book covers",
        group: "Barcodes",
        title: "Make an ISBN barcode for a book",
        intro:
          "Turn a 13-digit ISBN into the EAN-13 barcode printed on book covers. Type it with or without dashes.",
        about: [
          "ISBN-13 numbers start with 978 or 979. Older 10-digit ISBNs need converting first.",
        ],
        preset: { format: "EAN13" },
      },
      {
        slug: "barcode-scanner",
        tool: "scanner",
        name: "Barcode scanner",
        short: "Read product barcodes",
        group: "Scan",
        title: "Scan a barcode online",
        intro:
          "Read EAN, UPC, Code 128 and other barcodes with your phone or laptop camera, or from a photo.",
        about: ["Hold the barcode flat and fill most of the frame with it."],
        preset: { mode: "camera" },
      },
    ],
  },
  {
    id: "ocrtool",
    name: "OCR tools",
    brand: ["OCR", "Tool"],
    locales: ["en", "bn"],
    short: "OCR",
    tagline:
      "Copy text from images, screenshots and scanned PDFs. Everything runs on your device.",
    accent: {
      light: "#30a46c",
      dark: "#3dd68c",
      softLight: "#e6f6eb",
      softDark: "#132d21",
    },
    live: true,
    devPort: 4326,
    toolGroups: ["Images", "PDFs"],
    popular: [
      "image-to-text",
      "pdf-to-text",
      "searchable-pdf",
      "screenshot-to-text",
      "batch-ocr",
      "photo-to-text",
    ],
    tools: [
      {
        slug: "image-to-text",
        title: "Extract text from an image (OCR)",
        name: "Image to text",
        description:
          "Copy the text out of photos, screenshots and scans. Two engines: one for documents, one for photos and screenshots.",
        blurb: "Photos, screenshots, scans",
        icon: "scanText",
        group: "Images",
        ready: true,
        steps: [
          "Drop or paste an image. PDFs work too.",
          "Pick the language. The right engine is chosen for you; switch it if you like.",
          "Edit the text, then copy it or download .txt.",
        ],
      },
      {
        slug: "pdf-to-text",
        title: "Extract text from a PDF, including scanned pages",
        name: "PDF to text",
        description:
          "Get the text out of any PDF. Real text is copied exactly; scanned pages are read with OCR.",
        blurb: "Scanned or not",
        icon: "file",
        group: "PDFs",
        ready: true,
        steps: [
          "Drop a PDF.",
          "Pages with a text layer are copied as they are; scanned pages are read with OCR.",
          "Copy the text or download it, page by page or as one file.",
        ],
      },
      {
        slug: "searchable-pdf",
        title: "Make a scanned PDF searchable",
        name: "Searchable PDF",
        description:
          "Add an invisible text layer to scanned PDFs, so you can search, select and copy the text. The pages look exactly the same.",
        blurb: "Search and copy scans",
        icon: "search",
        group: "PDFs",
        ready: true,
        steps: [
          "Drop a scanned PDF, or images to turn into one.",
          "Each page is read with OCR and the text is placed under the picture.",
          "Download the searchable PDF.",
        ],
      },
      {
        slug: "batch-ocr",
        title: "Extract text from many images at once",
        name: "Batch OCR",
        description:
          "Read text from many images or PDFs in one go, and download one file per image or everything combined.",
        blurb: "Many files, one zip",
        icon: "layers",
        group: "Images",
        ready: true,
        steps: [
          "Drop many images or PDFs.",
          "They're read one after another on your device.",
          "Download a zip of text files, or one combined file.",
        ],
      },
    ],
    tasks: [
      {
        slug: "screenshot-to-text",
        tool: "image-to-text",
        name: "Screenshot to text",
        short: "Copy text from a screenshot",
        group: "Images",
        title: "Copy text from a screenshot",
        intro:
          "Paste a screenshot and get the text, ready to copy. Works with chats, error messages, slides and web pages.",
        about: [
          "The photo and screenshot engine handles small, coloured and anti-aliased text best.",
        ],
        preset: { engine: "photo" },
      },
      {
        slug: "photo-to-text",
        tool: "image-to-text",
        name: "Photo to text",
        short: "Signs, labels, whiteboards",
        group: "Images",
        title: "Extract text from a photo",
        intro:
          "Take a picture of a sign, label, whiteboard or page and get the text.",
        about: [
          "Hold the camera straight and close enough that the text fills most of the picture.",
        ],
        preset: { engine: "photo" },
      },
      {
        slug: "receipt-to-text",
        tool: "image-to-text",
        name: "Receipt to text",
        short: "Shop and restaurant receipts",
        group: "Images",
        title: "Receipt to text",
        intro:
          "Read the items and totals from a photo of a receipt, line by line.",
        about: [
          "Flatten the receipt and photograph it in good light for the best result.",
        ],
        preset: { engine: "photo" },
      },
      {
        slug: "scan-to-text",
        tool: "image-to-text",
        name: "Scanned page to text",
        short: "Letters, forms, book pages",
        group: "Images",
        title: "Scanned document to text",
        intro: "Turn a scanned letter, form or book page into editable text.",
        about: ["Scans at 300 dpi give the most accurate results."],
        preset: { engine: "document" },
      },
      {
        slug: "chinese-ocr",
        tool: "image-to-text",
        name: "Chinese OCR",
        short: "Simplified Chinese text",
        group: "Languages",
        title: "Extract Chinese text from an image",
        intro: "Read Simplified Chinese text from images and scans.",
        about: ["Traditional Chinese is in the language list too."],
        preset: { lang: "chi_sim" },
      },
      {
        slug: "japanese-ocr",
        tool: "image-to-text",
        name: "Japanese OCR",
        short: "Japanese text",
        group: "Languages",
        title: "Extract Japanese text from an image",
        intro:
          "Read Japanese text from images and scans, including vertical text in document mode.",
        about: ["Pick Japanese (vertical) for vertical layouts."],
        preset: { lang: "jpn" },
      },
      {
        slug: "arabic-ocr",
        tool: "image-to-text",
        name: "Arabic OCR",
        short: "Arabic text",
        group: "Languages",
        title: "Extract Arabic text from an image",
        intro:
          "Read Arabic text from images and scans. The result keeps right-to-left order.",
        about: [
          "Clear, printed text works best; handwriting is not supported.",
        ],
        preset: { lang: "ara" },
      },
      {
        slug: "hindi-ocr",
        tool: "image-to-text",
        name: "Hindi OCR",
        short: "Devanagari text",
        group: "Languages",
        title: "Extract Hindi text from an image",
        intro: "Read Hindi and other Devanagari text from images and scans.",
        about: ["Marathi and Nepali are in the language list too."],
        preset: { lang: "hin" },
      },
      {
        slug: "russian-ocr",
        tool: "image-to-text",
        name: "Russian OCR",
        short: "Cyrillic text",
        group: "Languages",
        title: "Extract Russian text from an image",
        intro: "Read Russian and other Cyrillic text from images and scans.",
        about: ["Ukrainian and Bulgarian are in the language list too."],
        preset: { lang: "rus" },
      },
      {
        slug: "spanish-ocr",
        tool: "image-to-text",
        name: "Spanish OCR",
        short: "Spanish text",
        group: "Languages",
        title: "Extract Spanish text from an image",
        intro: "Read Spanish text from images and scans, accents included.",
        about: ["Add English as a second language for mixed text."],
        preset: { lang: "spa" },
      },
      {
        slug: "scanned-pdf-to-text",
        tool: "pdf-to-text",
        name: "Scanned PDF to text",
        short: "OCR every page",
        group: "PDFs",
        title: "Scanned PDF to text",
        intro: "Read the text from a scanned PDF, page by page.",
        about: [
          "Pages that already have real text are copied exactly, without OCR.",
        ],
        preset: { force: "ocr" },
      },
      {
        slug: "ocr-pdf",
        tool: "searchable-pdf",
        name: "OCR a PDF",
        short: "Search inside scans",
        group: "PDFs",
        title: "OCR a PDF",
        intro:
          "Run OCR on a PDF so you can search and copy its text in any PDF reader.",
        about: [
          "The pages look the same; the text sits invisibly under each page.",
        ],
        preset: {},
      },
    ],
  },
] as const satisfies readonly App[];

export type AppId = (typeof apps)[number]["id"];

/**
 * IndexNow key (Bing, Yandex and others). Each app serves it at /<key>.txt (from its public folder), which
 * proves the site owns it when URLs are submitted to https://api.indexnow.org.
 */
export const INDEXNOW_KEY = "0f0695727b67e3fb00b1dc4dd4f0ff4f";

export function getApp(id: AppId): App {
  const app = apps.find((a) => a.id === id);
  if (!app) throw new Error(`Unknown app: ${id}`);
  // Use cases of tools that aren't built yet stay hidden everywhere (menus, lists, pages)
  const ready = new Set<string>(
    app.tools.filter((t) => t.ready).map((t) => t.slug),
  );
  return { ...app, tasks: app.tasks.filter((t) => ready.has(t.tool)) };
}

/** Origin for an app: localhost:<port> in dev, https://<id>.kmra.dev in production. */
export function appOrigin(id: AppId, dev = false): string {
  const app = getApp(id);
  return dev
    ? `http://localhost:${app.devPort}`
    : `https://${app.id}.${ROOT_DOMAIN}`;
}

/**
 * kmra.dev itself: the hub that lists every app (apps/kmra). It isn't in `apps` because it has no
 * tools of its own. Apps link to it only once `live` is true (the domain serves).
 */
export const HUB = {
  id: "kmra",
  name: "kmra.dev",
  brand: ["kmra", ".dev"],
  short: "kmra.dev",
  tagline:
    "Free tools for images, PDFs, video, QR codes, text in pictures and code. Everything runs in your browser.",
  accent: {
    light: "#18181b",
    dark: "#f4f4f5",
    softLight: "#f4f4f5",
    softDark: "#1d1d21",
  },
  live: false,
  devPort: 4320,
  locales: ["en", "bn"],
} as const;

export type BrandId = AppId | "kmra";

/** Name, colours and wordmark of an app or of the hub */
export function brandOf(id: BrandId): Pick<
  App,
  "id" | "name" | "brand" | "tagline" | "accent"
> {
  return id === "kmra" ? HUB : getApp(id);
}

/** http://localhost:4320 in dev, https://kmra.dev in production */
export function hubOrigin(dev = false): string {
  return dev ? `http://localhost:${HUB.devPort}` : `https://${ROOT_DOMAIN}`;
}

export function hubUrl(path = "/", dev = false): string {
  return new URL(path, hubOrigin(dev)).toString();
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

/** Items grouped by `group`, in `order` when given (unknown groups go last), else first-seen order. */
export function groupBy<T extends { group: string }>(
  items: readonly T[],
  order?: readonly string[],
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  const entries = [...map.entries()];
  if (!order) return entries;
  const rank = (g: string) =>
    order.includes(g) ? order.indexOf(g) : order.length;
  return entries.sort((a, b) => rank(a[0]) - rank(b[0]));
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

export function allPages(locale = "en"): PageLink[] {
  const out: PageLink[] = [];
  for (const raw of apps as readonly App[]) {
    if (!raw.live) continue;
    const app = localizeApp(raw, locale);
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
