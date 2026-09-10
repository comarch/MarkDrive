# Contributing

Thank you for contributing to MarkQuire.

## Requirements

- Node.js 22 (see `.nvmrc`)
- npm
- Git

## Setup

```bash
git clone https://github.com/comarch/MarkQuire.git
cd MarkQuire
npm ci
```

## Development workflow

1. Create a branch from `main`.
2. Make a focused change.
3. Add or update tests.
4. Update documentation and generated artifacts (`prs compile` when `.promptscript/` is modified).
5. Run the complete validation contract.
6. Open a pull request using the template.

## Validation

Run the complete validation contract before submitting changes:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run verify:artifact
npm run verify:repository
npm run validate
```

PromptScript validation (when changing `.promptscript/`):

```bash
npm run promptscript:validate
npm run promptscript:compile
```

## Data and security

Use minimal redacted fixtures. Never include Google OAuth credentials, client
secrets, personal access tokens, or private Google Drive document URLs.

Use stable `.invalid` domains and synthetic identities in tests and demos.

## Commits

Use Conventional Commits:

```text
feat(scope): add behavior
fix(scope): correct regression
docs(scope): update guide
test(scope): cover branch
chore(scope): maintain tooling
ci(scope): update automation
```

## Pull requests

- Explain behavior, scope, validation, and release impact.
- Keep unrelated refactors out.
- Request CODEOWNERS review for protected paths.
- Do not merge with missing or failing required checks.

## Generated files

Edit the documented source of truth and regenerate outputs. Do not hand-edit
compiled instructions (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.factory/`),
bundles (`dist/`), or release changelogs.

CI recompiles PromptScript and fails when generated output drifts from
`.promptscript/`.
