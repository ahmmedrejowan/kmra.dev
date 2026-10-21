# Third-party notices

kmra.dev's own code is licensed under the GNU Affero General Public License v3.0 (see
[LICENSE](LICENSE)). The sites also ship the following third-party software, models and fonts,
each under its own licence. Packages come unmodified from npm unless noted.

## Code that runs in the browser

| Component | Used for | Licence |
|---|---|---|
| [FFmpeg](https://ffmpeg.org/) via [@ffmpeg/core](https://github.com/ffmpegwasm/ffmpeg.wasm) (ffmpeg.wasm core) | Video and audio fallback engine (VidTool, AudioTool); copied into the build, not stored in this repo | GPL-2.0-or-later (notice served at `/ffmpeg/NOTICE.txt`) |
| [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) | Loads the core above | MIT |
| [Mediabunny](https://github.com/Vanilagy/mediabunny) and @mediabunny/mp3-encoder | WebCodecs media engine; MP3 encoding (VidTool, AudioTool, MusicTool) | MPL-2.0 |
| [LAME](https://lame.sourceforge.io/) (inside the MP3 encoders) | MP3 encoding | LGPL (notice served at `/NOTICE-mp3.txt`) |
| [libheif-js](https://github.com/catdad-experiments/libheif-js) | Opening HEIC photos (ImgTool) | LGPL-3.0 |
| [onnxruntime-web](https://github.com/microsoft/onnxruntime) | Running the AI models | MIT |
| [tesseract.js](https://github.com/naptha/tesseract.js) | Document OCR (OCRTool) | Apache-2.0 |
| [pdf.js](https://github.com/mozilla/pdf.js) (pdfjs-dist) | Opening and drawing PDFs | Apache-2.0 |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | Building PDFs | MIT |
| [SheetJS](https://sheetjs.com/) (xlsx 0.20.3, from cdn.sheetjs.com) | Reading spreadsheets (DevTool) | Apache-2.0 |
| [@jsquash/avif](https://github.com/jamsinclair/jSquash) | AVIF encoding (ImgTool) | Apache-2.0 |
| [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) | Reading and writing barcodes and 2D codes (QRTool) | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Cleaning Markdown previews | MPL-2.0 or Apache-2.0 |
| exifr, fflate, gifenc, gifuct-js, hash-wasm, jsbarcode, marked, qrcode, sql-formatter, prettier, React, idb-keyval | Metadata, zip, GIF, hashes, barcodes, Markdown, QR, formatting, UI, storage | MIT / Apache-2.0 |
| diff (jsdiff), terser, yaml | Text diff, JS minify, YAML | BSD-3-Clause, BSD-2-Clause, ISC |

## Used at build time

Astro, Tailwind CSS, satori and @resvg/resvg-js (social preview images, MPL-2.0), Vercel's
config and analytics packages (MIT).

## AI models (in `apps/*/public/models`)

| Model | Used for | Licence |
|---|---|---|
| [MODNet](https://github.com/ZHKKKe/MODNet) | Removing backgrounds from portraits (ImgTool) | Apache-2.0 |
| [U²-Net](https://github.com/xuebinqin/U-2-Net) (u2netp) | Removing backgrounds from objects (ImgTool) | Apache-2.0 |
| [UltraFace](https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB) (RFB-320) | Finding faces (ImgTool) | MIT |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv5 mobile, in [RapidOCR](https://github.com/RapidAI/RapidOCR)'s ONNX conversions | Photo OCR (OCRTool); sources and checksums in `apps/ocrtool/public/models/README.md` | Apache-2.0 |
| [Tesseract](https://github.com/tesseract-ocr/tessdata_best) "best" language data | Document OCR (OCRTool) | Apache-2.0 |

## Fonts

[Geist](https://vercel.com/font), Dancing Script and Noto Sans Bengali (via Fontsource): SIL Open
Font License 1.1.

## Name and logo

The licence covers the code. The kmra.dev name, the app names (ImgTool, PDFTool and the others)
and their logos identify the official sites; please use your own name and logo for a copy you run.
