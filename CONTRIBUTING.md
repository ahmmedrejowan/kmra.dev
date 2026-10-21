# Contributing

Thanks for helping make kmra.dev better. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

[Open an issue](https://github.com/ahmmedrejowan/kmra.dev/issues/new/choose) with:

- the page address (for example `https://imgtool.kmra.dev/compress`),
- what you did, what you expected and what happened,
- your browser and device,
- a sample file if the problem depends on one, and only if it's fine to share publicly.

For anything security-related, follow [SECURITY.md](SECURITY.md) instead.

## Suggesting a tool

Open a feature request describing the job it does and who it's for. Tools must run completely in
the browser: if an idea needs a server, say so in the issue so we can talk it through first.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Set up as described in [docs/development.md](docs/development.md).
3. Make your change, keeping to the rules in that guide: everything runs in the browser, no
   requests to other hosts, interface text through `T()` with a Bangla translation, heavy work in
   workers.
4. Add or update an end-to-end test that checks the real output (see
   [docs/testing.md](docs/testing.md)).
5. Run these locally (there's no CI on this repository):

   ```bash
   pnpm check
   pnpm format:check
   pnpm test:e2e
   ```

6. Open a pull request saying what changed and why, with a screenshot for visual changes.

Keep pull requests focused: one fix or feature each is easier to review.

## Licence

kmra.dev is licensed under the [AGPL-3.0](LICENSE). By sending a pull request you agree that
your contribution is licensed the same way.

## Conduct

Please follow the [code of conduct](CODE_OF_CONDUCT.md).
