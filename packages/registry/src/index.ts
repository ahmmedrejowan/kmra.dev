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
  | "languages";

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
    toolGroups: ["Create", "Scan"],
    popular: [
      "generator",
      "scanner",
      "wifi-qr",
      "barcode",
      "bulk",
      "whatsapp-qr",
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
