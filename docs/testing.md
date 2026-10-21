# Testing

The tests are Playwright end-to-end tests that run against the **production builds** in a real
browser.

```bash
pnpm test:e2e        # build every site, then run all tests
pnpm test:e2e:only   # run on the existing builds
npx playwright test -c tests/playwright.config.ts --project=imgtool   # one site
npx playwright test -c tests/playwright.config.ts --project=imgtool-firefox --project=imgtool-webkit
```

## Browsers

Every site is tested in Chromium. The image tools also run in Firefox and WebKit (Safari's
engine) as the `imgtool-firefox` and `imgtool-webkit` projects, because their results depend on
the browser's own image encoders: Safari can't write WebP and its JPEGs are far bigger, Firefox's
JPEGs stay big at low quality. Install those browsers once with
`pnpm exec playwright install firefox webkit`.

Firefox on Linux (the CI machines) now and then gives a new page whose first navigation
Playwright never hears back from, although the page loads. In Firefox, each test's page is
first tried on `/robots.txt` and swapped for a new one if it's stuck (see the `page` fixture in
`tests/helpers.ts`). `openTool` waits until every island has hydrated (`hydrated()`), since a
click or event sent to an island before that is lost.

When a test fails on CI, even one that passes on retry, its trace and screenshots are uploaded
with the run as `playwright-report-<shard>`. Open a trace with `npx playwright show-trace`.

## How they run

`tests/serve.ts` serves each site's `dist` the way production does: clean URLs, the 404 page and
the real headers, including the Content Security Policy from `@kmra/config`. A tool that tried to
reach another host fails its test. Each site has its own project and port (imgtool 4601, pdftool
4602, qrtool 4603, devtool 4604, ocrtool 4605, vidtool 4606, kmra 4607, audiotool 4608,
calctool 4609, colortool 4610, musictool 4611).

The `test` fixture in `tests/helpers.ts` fails a test on any console error or page error. Pass
`allowConsole` for messages a test expects.

Keyboard shortcuts use ⌘ where the page thinks it's on an Apple device and Ctrl elsewhere
(`isApple()` in `@kmra/ui/lib/keys`). Chromium's test browser reports Windows, WebKit's a Mac,
and Firefox the real machine, so a test that presses shortcuts in several browsers asks the
page which one it expects (see the undo test in `tests/imgtool/workspace.spec.ts`).

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
