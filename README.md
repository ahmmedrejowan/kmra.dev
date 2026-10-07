# kmra.dev

Free utility tools that run entirely in your browser. Files are never uploaded.

| App         | URL                                          | Tools                                              |
| ----------- | -------------------------------------------- | -------------------------------------------------- |
| Image Tools | [imgtool.kmra.dev](https://imgtool.kmra.dev) | resize, convert · _soon:_ compress, crop, rotate   |
| PDF Tools   | [pdftool.kmra.dev](https://pdftool.kmra.dev) | _soon:_ merge, split, rotate, PDF→image, image→PDF |

## Development

Requires Node 22.12+ and corepack (pnpm is pinned in `package.json`).

```bash
corepack enable
pnpm install
pnpm dev
```

- imgtool → http://localhost:4321
- pdftool → http://localhost:4322

```bash
pnpm build   # static sites in apps/*/dist
pnpm check
```

## Structure

- `apps/*`: one Astro site per subdomain
- `packages/registry`: list of all apps and tools; used for cross-app links
- `packages/ui`: shared layout, components and helpers

## Deployment

Each app is a static site. Deploy each one as its own project (Cloudflare Pages, Vercel, etc.) with
root directory `apps/<app>`, build command `pnpm build` and output `dist`, then attach the
`<app>.kmra.dev` subdomain.
