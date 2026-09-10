# Security Policy

## Supported versions

Security fixes target the latest release on the default branch.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Older releases | No        |

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities.

Use [GitHub private vulnerability reporting](https://github.com/comarch/MarkQuire/security/advisories/new).

Include:

- affected version or commit;
- minimal reproduction;
- expected security impact;
- suggested mitigation, when known.

Do not include Google OAuth client secrets, access tokens, personal data, or private document links.

## Response targets

| Severity | Acknowledge      | Triage           | Fix or mitigation    |
| -------- | ---------------- | ---------------- | -------------------- |
| Critical | 1 business day   | 2 business days  | As soon as practical |
| High     | 2 business days  | 5 business days  | Next patch release   |
| Medium   | 5 business days  | 10 business days | Planned patch        |
| Low      | 10 business days | 20 business days | Planned maintenance  |

## Scope

This policy covers source code, generated artifacts, workflows, PromptScript
instructions, release assets, and project-hosted infrastructure. Third-party
services remain outside project control unless explicitly integrated.

Architecture, data handling, external endpoints, residual risk, and incident
response are documented in the [security model](./docs/SECURITY_MODEL.md).
