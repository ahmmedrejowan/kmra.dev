# Development

## Setup

- Node 22.12 or newer
- pnpm 12, installed on its own (`npm i -g pnpm`). Corepack can't run pnpm 11 and later. The
  exact version is pinned in `package.json`.

```bash
pnpm install
pnpm dev                    # every site at once
pnpm --filter imgtool dev   # one site
```

| Site      | Dev URL               |
| --------- | --------------------- |
| hub       | http://localhost:4320 |
| imgtool   | http://localhost:4321 |
| pdftool   | http://localhost:4322 |
| vidtool   | http://localhost:4323 |
| devtool   | http://localhost:4324 |
| qrtool    | http://localhost:4325 |
| ocrtool   | http://localhost:4326 |
| audiotool | http://localhost:4327 |
| calctool  | http://localhost:4328 |
| colortool | http://localhost:4329 |
| musictool | http://localhost:4330 |

## Commands

```bash
pnpm build           # static output in apps/*/dist
pnpm check           # astro check + tsc across the repo
pnpm format          # Prettier
pnpm test:e2e        # build, then the end-to-end tests
pnpm test:e2e:only   # the tests on the existing builds
```

Test PDFs on a production build (`pnpm --filter pdftool preview`): pdf.js's worker doesn't load
through the Vite dev server. If a library suddenly fails to load in `pnpm dev`, clear Vite's
cache: `rm -rf apps/<site>/node_modules/.vite`.

## Rules every change keeps

- **Everything runs in the browser.** No servers, uploads or backend APIs. If something truly
  can't run client-side, raise it in an issue rather than adding a server.
- **No requests to other hosts.** The CSP allows `connect-src 'self'`. Bundle libraries from npm;
  don't load them from CDNs.
- **Ship only what works.** Tools stay `ready: false` (hidden) until they work end to end.
- **Heavy work off the main thread**, heavy libraries loaded lazily on the page that needs them.
- **Links between sites** use `appUrl()` from the registry, never a hard-coded URL.
- **Shared code** used by more than one site belongs in `packages/`.
- **All interface text** goes through `T()` / `t()` and gets a Bangla translation.

## Writing style for the interface

Sentence case, plain verbs, no ALL-CAPS labels, no arrows in buttons, and say what happens.
Phrase things positively ("Your files stay on your device") rather than as a missing feature.

## Adding a tool to a site

1. Add an entry to the site's `tools` in `packages/registry/src/index.ts` with `group`, `icon`
   and `steps`.
2. Build it in the site's tool component (ImageTool for image tools) or as
   `src/tools/<slug>.tsx` in the island-per-tool sites (DevTool, CalcTool, ColorTool, MusicTool).
3. Add its Bangla name and steps in `packages/registry/src/locales/bn.ts`.
4. Add an end-to-end test that checks the real output, then set `ready: true`.

## Adding a landing page

Add an entry to the site's `tasks` with a `preset` for its tool and its own `title`, `intro` and
`about` text. No code is needed when the tool already supports the preset.

## Adding a site

1. Add it to `apps` in the registry with an unused `devPort` and `live: false`.
2. Copy `apps/qrtool` as a template; update `package.json`'s name, `astro.config.mjs` (the
   `appOrigin` id and port) and the app id in its pages.
3. Create its hosting project (see [deployment.md](deployment.md)) and set `live: true` once its
   subdomain serves, so no other site links to a dead address.

## Adding a language

1. Add it to `LOCALES` in `packages/ui/src/lib/i18n.ts`.
2. Write `packages/ui/src/i18n/<code>.ts` (interface text, keyed by the English text; missing keys
   fall back to English) and the registry's content file in `packages/registry/src/locales/`.
3. List it in each site's `locales` in the registry and in its Astro `i18n.locales`, and add
   `src/pages/<code>/`.

## Keyboard shortcuts

`packages/ui/src/lib/keys.ts` holds the list shown in the `?` panel. Keep it in sync when you add
a shortcut.
