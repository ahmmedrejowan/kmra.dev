# Deployment

Every site builds to a folder of static files (`apps/<site>/dist`), so it can be hosted anywhere
that serves files. The official sites run on Vercel, one project per site.

## Vercel

- One project per site, all connected to this repository, with **Root Directory** `apps/<site>`
  and "Include source files outside of the Root Directory" turned on.
- Settings come from `apps/<site>/vercel.ts`, which calls `appConfig()` from `@kmra/config`:
  security headers, the Content Security Policy, caching and clean URLs. It also sets an ignore
  command, so a site only rebuilds when its folder, `packages/` or the lockfile changed.
- Pushing to `main` deploys to production; other branches get preview deployments.
- Node 24.

## Hosting elsewhere

Build with `pnpm build` and serve `apps/<site>/dist`. To match production:

- **Clean URLs:** `/compress` serves `compress.html` (Astro builds with `build.format: "file"`
  and no trailing slashes).
- **Headers:** send the same headers as `packages/config/src/vercel.ts`. The Content Security
  Policy is what guarantees files never leave the device; keep `connect-src 'self' blob: data:`.
- **`/handoff`** is the only page that may be framed, and only by the hub's origin.
- Some tools copy runtime files into `public/` during the build (pdf.js, ffmpeg.wasm and
  tesseract.js cores). They aren't committed, so always deploy a fresh build.

## Domains

The hub serves the root domain and each site its own subdomain (`imgtool.<domain>` and so on).
`ROOT_DOMAIN` in the registry sets the domain used in links, canonical URLs and the sitemap. If
you run a copy under your own domain, change it, and use your own name and logos (see
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)).
