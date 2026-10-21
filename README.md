# kmra.dev

Free utility tools that run entirely in your browser. Files are never uploaded.

| App         | URL                                          | Tools                                                                                                                                                            |
| ----------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image tools | [imgtool.kmra.dev](https://imgtool.kmra.dev) | compress, convert, resize, strip metadata, plus task pages (compress to 100 KB, PNG to JPG, Instagram sizes…) · _soon:_ crop, rotate, remove background, upscale |
| PDF Tools   | [pdftool.kmra.dev](https://pdftool.kmra.dev) | _soon:_ merge, split, rotate, PDF→image, image→PDF                                                                                                               |

## Development

Requires Node 22.12+ and pnpm 12 (`npm i -g pnpm`; the exact version is pinned in `package.json`).

```bash
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
- `packages/config`: shared Vercel config (security headers, caching)

## Deployment

Vercel, one project per app (Root Directory `apps/<app>`), connected to this repo. Settings come
from `apps/<app>/vercel.ts`. Pushing to `main` deploys to production; other branches get previews.

## License

[GNU Affero General Public License v3.0](LICENSE). If you run a changed copy of these sites for
others, you share its source under the same licence. Third-party code, AI models and fonts keep
their own licences, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The kmra.dev name
and logos aren't covered by the licence.
