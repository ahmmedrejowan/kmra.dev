# How files stay on your device

Every tool on kmra.dev works on files inside the browser tab. This page explains what makes
that true, so it can be checked rather than taken on trust.

## Nothing to send files to

The sites are static files: HTML, CSS, JavaScript, WebAssembly and AI model files. There is no
application server, database or upload endpoint behind them.

## The browser blocks it anyway

Every page is served with a Content Security Policy (see `packages/config/src/vercel.ts`) that
includes:

```
connect-src 'self' blob: data:
```

This tells the browser that scripts may only make network requests to the site itself. Even a
bug or a compromised library couldn't send a file to another server: the browser would refuse.
The end-to-end tests run every tool with these exact headers, so a tool that tried to reach
another host would fail.

## Where the work happens

- Images, PDFs, video and audio are decoded and encoded in the page or in Web Workers, with the
  browser's own codecs (canvas, WebCodecs) or WebAssembly builds of open-source libraries.
- AI models (background removal, face detection, OCR) are downloaded from the same site the
  first time they're needed and run locally with onnxruntime-web or tesseract.js.
- Files passed between pages stay in the browser's own storage (IndexedDB) for a few minutes,
  for the page they were meant for.

## Device features

The camera is allowed only on QRTool (for scanning), screen capture only on VidTool's screen
recorder, and the microphone only on the recorders and the tuner, through each site's
`Permissions-Policy` header. Every other site has them turned off.

## Analytics

The sites use Vercel Web Analytics, which is cookieless, served from the site's own domain and
counts page views. It never receives file names or contents.
