# Testing

The tests are Playwright end-to-end tests that run against the **production builds** in a real
browser.

```bash
pnpm test:e2e        # build every site, then run all tests
pnpm test:e2e:only   # run on the existing builds
npx playwright test -c tests/playwright.config.ts --project=imgtool   # one site
```

## How they run

`tests/serve.ts` serves each site's `dist` the way production does: clean URLs, the 404 page and
the real headers, including the Content Security Policy from `@kmra/config`. A tool that tried to
reach another host fails its test. Each site has its own project and port (imgtool 4601, pdftool
4602, qrtool 4603, devtool 4604, ocrtool 4605, vidtool 4606, kmra 4607, audiotool 4608,
calctool 4609, colortool 4610, musictool 4611).

The `test` fixture in `tests/helpers.ts` fails a test on any console error or page error. Pass
`allowConsole` for messages a test expects.

Note: the test browser reports itself as Windows, so keyboard shortcuts in tests use `Control`,
not `Meta`.

## Inputs

Test files are generated on each run by `tests/fixtures/make.ts` (with `imgtool.ts`, `docs.ts`,
`hard.ts` and others) into `tests/fixtures/gen/`, which isn't committed. Only files we made
ourselves are committed (`tests/fixtures/static/`). Real photos can be placed in
`tests/fixtures/local/` (not committed, since their licences are unknown); tests that need them
skip without them.

## Writing a test

- Assert real output: magic bytes, pixel dimensions, page counts, zip contents, codes decoded
  back. A page that merely loads isn't a passing tool.
- Every ready tool needs at least one test. For ImgTool, `tests/imgtool/coverage.spec.ts` lists
  the tested tools and fails when a ready tool is missing from it (it checks names, not depth).
- Put normal cases in `tests/<site>/` and unusual files (huge, damaged, odd formats) in
  `tests/hard/<site>-*.spec.ts`.

## Layout check

`npx tsx tests/layout-sweep.ts [site…]`, after a build, clicks every setting of every tool and
reports anything in the editor that moves or changes size.
