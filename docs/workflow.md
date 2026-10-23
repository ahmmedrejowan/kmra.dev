# Workflow: branches, pull requests, CI and deployment

## The short version

1. Branch off `main` with a name that says what it is: `feat/…`, `fix/…`, `docs/…`, `chore/…`,
   `ci/…`, `test/…` or `refactor/…`.
2. Commit, signed, and push the branch.
3. Open a pull request into `main`. GitHub Actions runs the checks.
4. When they pass, squash and merge. Vercel deploys `main`; nothing else is ever deployed.

## Branches

`main` is what's live: every site deploys from it. It's protected:

- changes arrive only through pull requests,
- the pull request checks must pass,
- every commit must be signed,
- `main` can't be force-pushed or deleted.

Work happens on short-lived branches named by kind (`feat/pdf-page-numbers`,
`fix/heic-orientation`, `docs/wiki-faq`). The prefixes matter: Vercel is told not to deploy
branches with them (see below), so pushing a branch costs nothing.

## Pull requests

[`.github/workflows/pr.yml`](../.github/workflows/pr.yml) runs on every pull request:

| Check                        | What it does                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Types and format             | `pnpm check` (astro check + tsc in every package) and `pnpm format:check` (Prettier)                          |
| Dependency review            | Fails if the pull request adds or upgrades a package with a known vulnerability (moderate or worse)           |
| End to end (1 of 4 … 4 of 4) | Builds every site, then runs the Playwright tests against the builds, split across four machines              |
| CodeQL                       | GitHub's code scanning for security problems in the TypeScript (cross-site scripting, unsafe HTML, injection) |

The end-to-end jobs set up `ffmpeg` (the video and audio test files are generated with it, and
outputs checked with `ffprobe`) from a pinned static build on GitHub rather than apt, whose mirror
stalled on some runners, and install the browsers (downloaded from Playwright; only their system
libraries come from apt, after a quick mirror check that falls back to Ubuntu's main archive). ffmpeg, the browsers and the generated test files are cached between runs, so a run
downloads or makes them only after a version or a fixture generator changes. If a job fails, its
`test-results/` (traces and screenshots) is attached to the run.

Merge with **squash and merge**, so `main` gets one commit per change. GitHub signs the squash
commit, which keeps every commit on `main` verified.

Also on every pull request, as advice rather than a gate: **CodeRabbit** reviews the change
against the project's rules (in `.coderabbit.yaml`): nothing leaves the browser, interface text
translated, heavy work in workers, the copy style.

## Security

- **Secret scanning with push protection:** a push containing an API key or token is blocked.
- **Dependabot security updates:** a pull request when a dependency has a security fix (its
  `dependabot/…` branches aren't deployed). Routine version bumps aren't opened.
- **CodeQL** scans every pull request and `main`; high-severity findings block a merge.
- **Private vulnerability reporting:** see [SECURITY.md](../SECURITY.md).

## Deployment

Each site is its own Vercel project, connected to this repository with its Root Directory set to
`apps/<site>`. Pushing to `main` starts a deployment for every project, and each one decides
whether to build:

- **Only `main` builds.** `git.deploymentEnabled` in each site's `vercel.json` (written from
  `packages/config/src/vercel.ts`) turns off deployments for the branch prefixes above, and the
  ignore command skips the build on any branch that isn't `main`.
- **Only changed sites build.** On `main`, a site builds only when its own folder,
  `packages/` or the lockfile changed since its last deployment. A change to `apps/pdftool`
  rebuilds PDFTool and nothing else; a change to `packages/ui` rebuilds all eleven.

Vercel's free plan allows 100 deployments a day, and every push to `main` starts one per site
(skipped or not). Keep pushes to `main` few: one merged pull request is one push.

When a production deployment finishes, Vercel reports it to GitHub, and
[`.github/workflows/deployed.yml`](../.github/workflows/deployed.yml) tells the IndexNow search
engines (Bing, Yandex and others) about that site's pages, read from its live sitemap.

## Signed commits

`main` accepts only signed commits. Set up commit signing once (GPG or SSH, see
[GitHub's guide](https://docs.github.com/en/authentication/managing-commit-signature-verification)),
then `git config commit.gpgsign true`. Squash merges made on GitHub are signed by GitHub.

## Releases

The sites are continuously deployed, so there are no version tags. Notable changes are listed in
[CHANGELOG.md](../CHANGELOG.md).
