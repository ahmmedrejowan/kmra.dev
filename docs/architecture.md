# Architecture

kmra.dev is a pnpm + Turborepo monorepo of static websites. Every site is an Astro project that
builds to plain HTML, CSS, JavaScript and WebAssembly. There is no backend: every tool runs in
the visitor's browser.

## Sites and packages

```
apps/
  kmra/        kmra.dev, the hub: every site, one drop box for any file, search across all tools
  imgtool/     imgtool.kmra.dev     images
  pdftool/     pdftool.kmra.dev     PDFs
  vidtool/     vidtool.kmra.dev     video
  audiotool/   audiotool.kmra.dev   audio
  qrtool/      qrtool.kmra.dev      QR codes and barcodes
  ocrtool/     ocrtool.kmra.dev     text from images and scans
  devtool/     devtool.kmra.dev     developer tools
  calctool/    calctool.kmra.dev    calculators
  colortool/   colortool.kmra.dev   colours
  musictool/   musictool.kmra.dev   music
packages/
  registry/    @kmra/registry: every site, tool and landing page, accents, URL helpers
  ui/          @kmra/ui: layout, header and footer, components, styles, helpers, translations
  media/       @kmra/media: video and audio engine and its player and timeline components
  config/      @kmra/config: shared Vercel config (headers, CSP, caching)
```

Packages are used as TypeScript source (no build step) through subpath imports such as
`@kmra/ui/components/Dropzone` or `@kmra/ui/lib/files`.

### The registry drives everything

`packages/registry/src/index.ts` lists every site (`apps`) and, for each, its tools and task
pages. A **tool** is one job (Compress). A **task** is a landing page for a common need built on a
tool with a preset (Compress to 100 KB). Menus, the home page, the command palette (⌘K), the
sitemap, links between sites and social preview images are all generated from it. A tool with
`ready: false`, or a site with `live: false`, stays hidden everywhere.

Links between sites always go through `appUrl(id, path, dev)`, so they point to
`localhost:<port>` in development and to the real subdomain in production.

## Pages

Every site has the same pages: `/` (home), `/[slug]` (one page per tool and per task),
`/tools`, `/use-cases`, `/more-tools`, `/how-it-works`, `/privacy`, `/about` and a 404. Pages are
thin wrappers around shared views, rendered for each language (English at the root, Bangla under
`/bn`). Favicons, app icons, the web manifest, `robots.txt` and an Open Graph image per page are
generated at build time with satori and resvg.

Interactive parts are React islands. Heavy libraries (WASM codecs, ffmpeg.wasm, pdf.js, AI
runtimes) are imported lazily on the pages that need them, and heavy work runs in Web Workers.

## Engines

| Site                                    | Engine                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ImgTool                                 | A render pipeline in a worker: redact → crop/rotate → signature ink → resize → background → colour → text → watermark → frame → print sheet → encode. JPEG/PNG/WebP via canvas, AVIF via jSquash, GIF/BMP/TIFF/ICO written by hand, HEIC decoded with libheif. AI: MODNet, U²-Net and UltraFace on onnxruntime-web. Metadata removal edits EXIF, IPTC and XMP field by field without re-encoding. |
| PDFTool                                 | pdf.js to open and draw pages, pdf-lib to build new PDFs.                                                                                                                                                                                                                                                                                                                                         |
| VidTool, AudioTool                      | `@kmra/media`: WebCodecs through Mediabunny when the browser can, ffmpeg.wasm (single thread) otherwise.                                                                                                                                                                                                                                                                                          |
| OCRTool                                 | tesseract.js for documents, PaddleOCR (PP-OCRv5 mobile ONNX) for photos, in a worker pool.                                                                                                                                                                                                                                                                                                        |
| QRTool                                  | A QR renderer of its own, zxing-wasm for reading and for other 2D codes.                                                                                                                                                                                                                                                                                                                          |
| DevTool, CalcTool, ColorTool, MusicTool | One island per site that lazy-loads each tool from `src/tools/<slug>.tsx`.                                                                                                                                                                                                                                                                                                                        |

## Moving files between pages and sites

Files never travel over the network. Between pages of one site, a file is kept briefly in
IndexedDB (`@kmra/ui/lib/handoff`) for the page it's meant for. From the hub to another site, the
hub opens that site's `/handoff` page in a hidden frame and passes the files with `postMessage`;
the site stores them in its own IndexedDB and the tool takes them on load. Only the hub's origin
may frame `/handoff`.

## Design

Neutral zinc palette and the Geist font (self-hosted), light and dark themes, one accent colour
per site. Tokens live in `packages/ui/src/styles.css`. Tool pages open in a Simple mode with a
few controls; image tools also have an Advanced workspace (`/editor?t=<tool>`) with every tool,
a list of changes, undo and redo, and per-photo changes for batches.
