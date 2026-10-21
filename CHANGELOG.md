# Changelog

The sites are deployed continuously from `main`, so changes are grouped by date rather than by
version. Every change is a commit in the history; this lists the ones worth knowing about.

## 2026-10-21

**Open source**

- kmra.dev is open source under the AGPL-3.0, with notices for third-party code, AI models and
  fonts
- README, docs (architecture, development, testing, deployment, privacy, workflow, design,
  translations), contributing, security, support and conduct guides, issue forms, wiki and
  Discussions
- Source code links on every site: footer, About and Privacy pages, and the hub
- Pull requests are checked by GitHub Actions (types, formatting, every tool end to end); only
  `main` is deployed, and search engines are told about each production deployment
- VidTool gets its own logo, a clapperboard; it showed a placeholder letter before

**ImgTool**

- Strip metadata lists every field in the photo (location, dates, camera, serial numbers, editing
  data, captions), in groups with "Sensitive" tags. Remove everything, only the sensitive fields,
  or pick field by field. EXIF, IPTC and XMP are edited without re-encoding the picture
- The Advanced workspace is rebuilt around the picked tool: a rail of every tool with names, the
  tool's own panel first, other edits folded under "More edits"
- Advanced has its own address (`/editor?t=<tool>`), works before a photo is added, and Back
  returns to Simple mode
- A Changes list (hide, remove, open its settings, start over), undo and redo, and a History list
  to jump to any step; edits survive a refresh
- Batches: changes for all photos or one photo, markers on photos with their own changes, copy to
  all, progress on downloads, and a failing photo is skipped instead of cancelling the batch
- Compress quality and format show up as changes; the before/after view appears only where the
  look changes
- Simple mode lists changes made in Advanced, so nothing changes a file out of sight

**Every site**

- Files handed between pages open only in the page they were meant for, and expire after a few
  minutes
- Zips never overwrite a file with the same name
- Remove buttons where a mistaken file couldn't be removed before; clearer messages for files
  that can't be read
- PDF: per-file failures in batches, picks cleared with their pages, metadata edits kept, progress
  on downloads
- OCR: a second PDF stops the first one's work, Retry in batch OCR, honest labels for blank scans
- Video and audio: audio Compress never makes a file bigger, overall batch progress, unique names
  in batches, the zip shown even when the selected file failed
- QR: a broken image no longer hides the codes from the good ones; Simple mode shows styling added
  in Advanced
- Developer tools: downloads are named after the opened file

## 2026-10-20

- Editors keep their size: settings panels scroll inside the card and the preview never jumps
- Download names follow one pattern everywhere: `<your file>-<tool>-kmra.<ext>`
- ImgTool Convert: AVIF, GIF, BMP, TIFF and ICO, never the image's own format; Compress gains AVIF
- CalcTool: a scientific mode for the calculator

## 2026-10-10

- **CalcTool** (17 calculators) and **ColorTool** (8 colour tools) go live
- **MusicTool**: tuner, metronome, tap tempo, tone generator, drone, chords, scales, ear trainer,
  and a beat maker with eight drums, swing and WAV or MP3 export

## 2026-10-09

- **OCRTool**: Tesseract for documents and PaddleOCR for photos, 43 languages, searchable PDFs
- **VidTool**: 14 tools on WebCodecs with ffmpeg.wasm as the fallback, including a screen recorder
- **AudioTool**: 15 tools, including a voice recorder
- **kmra.dev**, the hub: drop any file to see every tool that opens it, and search across all
  tools
- Vercel builds only the sites a push changes

## 2026-10-08

- **ImgTool** with 30 tools: compress, resize, convert, crop, rotate, HEIC, effects, standalone
  tools, and on-device AI (remove or change background, blur faces, passport photos)
- **PDFTool** with 14 tools and **QRTool** with 9
- **DevTool** with 34 developer tools
- Bangla on every site
- End-to-end tests for every tool
