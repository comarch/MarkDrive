# Validation

MarkQuire exposes one complete local quality contract.

```bash
npm ci
npm run validate
```

## Contract stages

| Stage                 | Command                      | Failure condition                                                      |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Formatting            | `npm run format:check`       | Source, docs, or config differs from Prettier output                   |
| Lint                  | `npm run lint`               | ESLint error or warning                                                |
| Types                 | `npm run typecheck`          | Strict TypeScript error                                                |
| Tests and coverage    | `npm run test:coverage`      | Test failure or missing coverage report                                |
| Production build      | `npm run build`              | TypeScript or Vite build failure                                       |
| Artifact verification | `npm run verify:artifact`    | Required static file missing, source map present, or bundle incomplete |
| Repository contract   | `npm run verify:repository`  | Required policy file, metadata sync, pin, or privacy check fails       |
| PromptScript drift    | `npm run promptscript:check` | Invalid source or generated instruction drift                          |

The contract uses local fixtures and browser storage. It does not require Google
credentials or live Drive access.

## Focused commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm run verify:artifact
npm run verify:repository
npm run promptscript:validate
npm run promptscript:compile
```

Use focused commands during development. Run the complete contract before every
commit and release.

## End-to-end tests

```bash
npm run test:e2e
```

Playwright drives a real Chromium browser against the Vite dev server in demo
mode on port 3111, so no Google credentials are required. Coverage includes
the editor and preview shell, view modes, the comments workflow, export, search
and replace, interactive task checkboxes, and Drive version history. CI runs
the same suite in the End-to-end tests job.

## CI checks

- **Quality and build** runs the complete npm contract.
- **End-to-end tests** runs the Playwright suite against the dev server in demo mode.
- **Validate PromptScript** checks source and generated outputs independently.
- **Production dependency audit** checks npm advisories.
- **Dependency review** evaluates pull request dependency changes.
- **CodeQL** analyzes JavaScript and TypeScript.
- Codecov enforces the configured patch coverage policy.
- Release publishing validates again from the release tag.

## Security checks

Production dependency audit:

```bash
npm audit --omit=dev --audit-level=high
```

GitHub secret scanning, push protection, CodeQL, and dependency alerts require
the remote settings from [Repository settings](./REPOSITORY_SETTINGS.md).

## Manual checks

Before a user-facing release:

1. start `npm run dev`;
2. open the sample document in a maintained Chromium browser;
3. verify split, editor, and preview modes;
4. create, reply to, resolve, and reopen a demo comment;
5. verify Markdown, HTML, and print export;
6. check light and dark themes;
7. inspect the browser console for errors.

Cross-browser coverage beyond Chromium and a hard bundle-size budget are not
yet part of the validation contract. Vite may warn about chunks above its
default size threshold while the build still passes.
