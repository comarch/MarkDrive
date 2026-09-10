# AGENTS.md

<!-- PromptScript 2026-09-10T13:01:09.305Z | source: .promptscript/project.prs | target: factory - do not edit -->

## Project

You are a senior open-source maintainer working on MarkQuire.

MarkQuire is an open-source Markdown editor for Google Drive with rich preview,
math, diagrams, and anchored review comments.

Make small, reviewable changes. Preserve public contracts, security
boundaries, contributor experience, and release reproducibility. Inspect
source instructions, relevant code, tests, generated artifacts, workflows,
and repository policy before changing behavior. Run the narrowest relevant
checks, then the complete validation contract when the change is broad.

Treat generated files as build output. Keep secrets and private user data out
of source, logs, fixtures, issue reports, pull requests, and release assets.
Stop before remote actions unless the project policy and user request
explicitly authorize them.

## Tech Stack

Node.js 22 (browser SPA build)

## Architecture

source: src/ (React 18, CodeMirror 6, markdown-it, KaTeX, Mermaid, Tailwind CSS), services: src/services/ (googleAuth, googleDrive, googleComments, driveState), tests: src/\_\_tests\_\_/ (Vitest unit and integration tests), docs: README.md, CONTRIBUTING.md, GOOGLE_WORKSPACE_SETUP.md, automation: .github/workflows (ci, security, release-please), promptscript: .promptscript source of truth for agent instructions, generated: dist/ compiled production SPA bundle

## Context

### Runtime flow

MarkQuire is loaded as a web application either standalone or via Google Drive UI integration
(New -> MarkQuire or Open with -> MarkQuire). The URL query parameter `state` contains the file ID
or target folder ID. The app authenticates with Google Identity Services (GIS), fetches the
file content via Drive API v3, displays an interactive CodeMirror 6 editor alongside a live
markdown-it/KaTeX/Mermaid preview, and syncs comments using the Drive Comments API.

### Change boundaries

- Pure markdown parsing and rendering logic belongs in `src/components/Preview/markdownParser.ts`.
- Google Drive REST communication belongs strictly in `src/services/googleDrive.ts` and `src/services/googleComments.ts`.
- OAuth and GIS token management belongs in `src/services/googleAuth.ts`.
- UI components and modals belong in `src/components/`.
- Unit tests belong in `src/\_\_tests\_\_/`.
- Instructions source belongs in `.promptscript/`.

- Project: markquire
- Purpose: Open-source Markdown editor integrated with Google Drive and Google Workspace Marketplace
- Language: TypeScript
- Package Manager: npm

## Conventions & Patterns

### Architecture

- Prefer existing shared types, adapters, helpers, and test utilities over duplicate abstractions
- Keep pure logic separate from I/O, framework code, and external services
- Keep Google Drive REST and OAuth interactions behind explicit service boundaries
- Keep generated output tied to a documented source and build command

### Quality

- Use strict language and compiler settings where supported
- Validate untrusted input at every external boundary (URL parameters, Google API responses)
- Preserve backward compatibility for document formats and exported assets
- Make unsupported, unavailable, offline, and empty states safe

### Testing

- Add focused regression coverage for every behavior change
- Keep fixtures deterministic, minimal, and redacted
- Run fast checks during development and the complete validation contract before merge
- Mock external Google API calls in automated test suites

### Formatting

- Use Prettier for source, Markdown, JSON, YAML, and configuration
- Use English for code comments, generated text, and user-facing copy
- Use hyphens only in generated documentation and comments
- Keep line endings and whitespace deterministic

## Git Workflows

- Format: Conventional Commits
- Subject Limit: 72
- Allowed Types: feat, fix, docs, test, refactor, chore, ci, perf, revert

## Don'ts

- Don't commit Google Client IDs, Client Secrets, tokens, cookies, private keys, or personal data
- Don't print, upload, or transmit OAuth credentials or user access tokens
- Don't add hidden telemetry, tracking, remote code, or unapproved external network requests
- Don't execute untrusted downloaded code without explicit review
- Don't interpolate untrusted issue, pull request, or fixture data into shell commands unsafely
- Don't assume an optional capability exists without checking the live contract
- Don't bypass tests, lint, typecheck, security, or artifact checks to make CI green
- Don't edit generated instruction files or bundles by hand
- Don't use mutable GitHub Action references when immutable pins are available
- Don't publish, push, release, alter permissions, or change remote settings without explicit authorization
- Don't use production credentials in pull request code from forks
