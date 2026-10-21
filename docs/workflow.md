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

| Check                               | What it does                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| Types and format                    | `pnpm check` (astro check + tsc in every package) and `pnpm format:check` (Prettier)              |
| End to end (1 of 3, 2 of 3, 3 of 3) | Builds every site, then runs the Playwright tests against the builds, split across three machines |

The end-to-end jobs install `ffmpeg` (the video and audio test files are generated with it) and
Chromium. If a job fails, its `test-results/` (traces and screenshots) is attached to the run.

Merge with **squash and merge**, so `main` gets one commit per change. GitHub signs the squash
commit, which keeps every commit on `main` verified.

## After a merge

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the same checks on `main` itself.
Two branches that each passed can still be wrong together; this is where that shows up. It also
drives the CI badge in the README.

## Deployment

Each site is its own Vercel project, connected to this repository with its Root Directory set to
`apps/<site>`. Pushing to `main` starts a deployment for every project, and each one decides
whether to build:

- **Only `main` builds.** `git.deploymentEnabled` in `packages/config/src/vercel.ts` turns off
  deployments for the branch prefixes above, and the ignore command skips the build on any
  branch that isn't `main`.
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
