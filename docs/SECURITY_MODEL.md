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

### Optional companion service

An organization may deploy the optional, self-hosted companion service
(`companion/`, distributed as a container) next to the SPA. It provides
exactly four capabilities, each disabled unless configured:

| Capability     | Route                                 | Configuration                        |
| -------------- | ------------------------------------- | ------------------------------------ |
| CRDT relay     | `/ws?room=<fileId>`                   | none (always on)                     |
| Drive webhooks | `/v1/drive/watch`, `/v1/drive/notify` | `PUBLIC_URL`, `DRIVE_WEBHOOK_SECRET` |
| AI proxy       | `/v1/ai/generate`                     | `GEMINI_API_KEY`                     |
| Search index   | `/v1/search`, `/v1/search/index`      | `SEARCH_INDEX_PATH` (optional)       |
| Integrations   | `/v1/integrations/notify`             | `SLACK_WEBHOOK_URL`                  |

Trust rules for the companion:

- The SPA never requires it. A deployment without the companion serves
  every P0 and P1 feature; depending on it for core behavior is a
  release-blocking rule, not a preference.
- The client supplies its own short-lived OAuth access token when
  registering a Drive watch; the companion never persists tokens.
- Drive webhook callbacks are accepted only with the shared
  `DRIVE_WEBHOOK_SECRET` token header.
- Relay documents live in memory only; Drive remains the durability
  layer through client-side snapshots.
- The search index stores document content outside Drive, which is why
  it exists only in the organization's own deployment - never in a
  MarkQuire-operated service.
- The audit log (`/v1/audit/export`, JSONL, pruned by `RETENTION_DAYS`)
  records what this service can see: relay joins, webhook receipts,
  watch registrations, and integration deliveries.
- Collaborative editing traffic rides the same origin through the nginx
  `/ws`, `/events`, and `/v1/` proxies, so no additional CORS surface
  opens.

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

Exported HTML and exported static sites are self-contained: KaTeX and
highlight styles, including fonts, are inlined as data, so published files
make no outbound requests.

Diagrams and math render locally in the browser: Mermaid and Graphviz
(`dot` fenced blocks) run WebAssembly engines, and Excalidraw scenes embed
as view-only islands. None of them call a rendering service. PlantUML has
no browser renderer and stays reserved for the optional companion service
rather than a third-party endpoint; documents show the fenced source until
then.

### AI assistant (opt-in)

The Gemini assistant is the first feature that sends document content to a
party other than Google. It follows three rules:

1. Off by default. The toggle sits in settings and ships disabled.
2. Compiled out by default. The production artifact is built without
   `VITE_ENABLE_AI`, so neither the panel nor the service calls are in the
   bundle. A self-hoster builds with `VITE_ENABLE_AI=1` to include it.
3. Only the configured endpoint sees content. The panel states this before
   the first run.

Connection modes:

| Mode      | Endpoint                                                                          | Key location                                          |
| --------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| apiKey    | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Browser local storage, visible to any injected script |
| firebase  | A self-hosted Firebase AI Logic proxy URL the operator configures                 | None in this client                                   |
| companion | `{companionBaseUrl}/v1/ai/generate` on the optional companion service             | Server side                                           |

The firebase and companion modes accept the same JSON request and response
shape as the Gemini `generateContent` REST call (`contents` with parts,
response `candidates[0].content.parts[].text`), so a proxy can forward
verbatim. Keys entered for the apiKey mode are stored in browser local
storage next to the OAuth client ID and are never logged or sent anywhere
except the Google endpoint above.

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
