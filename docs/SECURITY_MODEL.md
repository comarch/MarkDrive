# Security model

This document records MarkQuire trust boundaries, data handling, threats, and
maintainer response.

## Architecture and trust boundaries

MarkQuire is a browser SPA. This repository provides no application backend.

```text
Browser
  -> Google Identity Services
  -> Google OAuth user profile
  -> Google Drive API v3
  -> static application host
```

The deployment host serves compiled static files. Google receives OAuth and
Drive requests directly from the browser.

## Data handling

| Data                 | Production location                          | Local demo location     |
| -------------------- | -------------------------------------------- | ----------------------- |
| Markdown content     | Google Drive file                            | Browser local storage   |
| File metadata        | Google Drive                                 | Browser local storage   |
| Comment threads      | Google Drive Comments API                    | Browser local storage   |
| OAuth access token   | Browser session storage                      | Synthetic session token |
| User profile         | Browser session storage                      | Synthetic profile       |
| OAuth client ID      | Build configuration or browser local storage | Browser local storage   |
| Application settings | Browser local storage                        | Browser local storage   |

MarkQuire contains no telemetry or analytics.

## External network dependencies

Runtime may connect to:

- `accounts.google.com` for Google Identity Services;
- `www.googleapis.com` for Drive and user profile APIs;
- image hosts referenced by Markdown authors.

Exported HTML may connect to `cdn.jsdelivr.net` and `cdnjs.cloudflare.com` for
KaTeX and code highlighting styles.

Self-hosters should review these endpoints, Content Security Policy, proxy
rules, and privacy requirements before production deployment.

## Threats and controls

| Threat                                            | Preventive control                                               | Detection                     | Recovery                                     |
| ------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- | -------------------------------------------- |
| Malicious Markdown executes script                | Rendered HTML allowlist, Mermaid strict mode, attribute escaping | Unit tests, CodeQL, review    | Patch, regression test, corrective release   |
| Malformed Drive URL state changes file operations | Action and identifier validation with bounded input              | Unit tests and browser errors | Reject input and patch parser                |
| OAuth token disclosure                            | Session storage, no token logging, HTTPS deployment              | Secret scanning and review    | Sign out, revoke token, patch exposure       |
| Compromised dependency                            | Lockfile, production audit, Renovate, dependency review          | GitHub alerts and CI          | Pin or remove dependency, corrective release |
| Compromised workflow action                       | Commit SHA pins and least-privilege permissions                  | Renovate and workflow review  | Disable workflow, rotate credential          |
| Malicious pull request changes release controls   | CODEOWNERS, protected branch, no fork secrets                    | Required checks and audit log | Revert and revoke affected credentials       |
| Tampered release artifact                         | Build from release tag and SHA-256 checksum                      | Artifact verification         | Withdraw guidance and publish patch          |

## Residual risk

- Any same-origin script can access session storage. XSS prevention remains a
  critical control.
- Google Identity Services and public stylesheets used by exported HTML remain
  supply-chain dependencies.
- Browser extensions and compromised endpoints remain outside project control.
- `drive.file` limits Drive access but still grants access to files opened or
  created through the app.
- Demo mode is for evaluation, not confidential production data.
- Self-hosters own server hardening, TLS, CSP, OAuth consent, retention, and
  Workspace policy.

## Incident response

1. Move sensitive discussion to
   [private vulnerability reporting](https://github.com/comarch/MarkQuire/security/advisories/new).
2. Identify affected source, workflow, dependency, release, credential, and
   versions.
3. Disable unsafe automation and contain distribution.
4. Revoke or rotate credentials when exposure is plausible.
5. Preserve only redacted evidence.
6. Fix source and add a regression test or detection rule.
7. Run the complete validation contract.
8. Publish a corrective release and clear user guidance.
9. Update this model with the learned control.

Do not publish exploit details while users remain exposed.

## Reporting

Follow [SECURITY.md](../SECURITY.md). Do not include access tokens, OAuth
secrets, private Drive URLs, document content, personal data, or unrelated
diagnostics.
