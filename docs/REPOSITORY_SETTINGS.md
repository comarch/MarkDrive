# GitHub repository settings

Apply this checklist to `comarch/MarkQuire` before accepting outside
contributions. These settings are remote controls and are not configured by
repository files.

## General

- Repository name: `MarkQuire`
- Default branch: `main`
- Description: `Drive-native Markdown editing, rich previews, and anchored review comments for Google Workspace teams.`
- Homepage: project documentation or deployed application URL
- License: MIT
- Issues: enabled
- Discussions: disabled until moderation ownership exists
- Wiki: disabled while documentation lives in `docs/`

Recommended topics:

```text
markdown
google-drive
google-workspace
react
typescript
codemirror
mermaid
katex
documentation
collaboration
```

## Pull requests

- allow squash merge;
- use pull request title and number as the default squash message;
- disable merge commits;
- disable rebase merge unless the team documents a need;
- enable auto-merge;
- delete head branches after merge;
- require conversation resolution.

## Actions

- keep default workflow permissions read-only;
- allow local and approved third-party actions;
- review fork pull request approval policy;
- do not expose secrets to fork pull requests;
- use protected environments for future production deployment.

## Pages

The Google Workspace manifest points Drive at
`https://comarch.github.io/MarkQuire/`, so the Drive entry points only work once
this deployment exists.

- set Pages source to `GitHub Actions`;
- keep the `github-pages` environment limited to the default branch;
- set the `ENABLE_GITHUB_PAGES` variable to `true` when the deployment is approved;
- update the manifest and the setup guide when the app moves to another origin.

## Security

- enable dependency graph;
- enable Dependabot alerts and security updates;
- enable secret scanning and push protection;
- enable private vulnerability reporting;
- enable CodeQL;
- keep dependency review required on pull requests;
- assign a security advisory owner.

## Variables and secrets

| Name                          | Type     | Purpose                                                           |
| ----------------------------- | -------- | ----------------------------------------------------------------- |
| `RELEASE_PAT`                 | Secret   | Release Please branches, pull requests, tags, and releases        |
| `CODECOV_TOKEN`               | Secret   | Coverage upload when the repository requires authenticated upload |
| `ENABLE_RELEASE_PLEASE`       | Variable | Keep `false` until the release token passes a manual test         |
| `ENABLE_RELEASE_PR_AUTOMERGE` | Variable | Keep `false` until one manual release succeeds                    |
| `ENABLE_GITHUB_PAGES`         | Variable | Keep `false` until the Pages deployment is reviewed               |

No Google OAuth client secret belongs in this repository. Browser deployment
uses a public OAuth client ID supplied at build time.

## Default branch ruleset

Create an active ruleset named `Protect default branch` for `main`.

- require a pull request;
- require at least one approving review;
- require CODEOWNERS review;
- dismiss stale approvals;
- require approval of the latest push;
- require conversation resolution;
- block force pushes;
- block branch deletion;
- require branches to be up to date when queue cost is acceptable.

Verify these checks on a test pull request before making them required:

```text
Quality and build
Validate PromptScript
Production dependency audit
Dependency review
CodeQL
```

Do not require a check that is skipped for the repository visibility or pull
request source. Keep bypass actors empty unless an audited release process
needs a narrow exception.

## Labels

Create:

```text
bug
enhancement
documentation
dependencies
automerge
security
breaking-change
good first issue
help wanted
wontfix
duplicate
```

Keep Release Please labels unchanged.

## Bootstrap verification

Before enabling broad automation:

1. Open a test pull request from a repository branch.
2. Open a test pull request from a fork.
3. Confirm every required job reports a conclusion.
4. Confirm CODEOWNERS requests review.
5. Confirm a major Renovate update does not auto-merge.
6. Complete one manual Release Please release.
7. Install and run the uploaded static release artifact.
8. Record the result before enabling release pull request auto-merge.
