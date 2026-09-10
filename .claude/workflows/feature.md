# feature

<!-- PromptScript 2026-09-10T09:56:31.153Z | source: .promptscript/project.prs | target: claude - do not edit -->

> Implement a focused user-facing or editor feature

1. Read project instructions, README, relevant source, tests, and current workflows.
2. Identify the smallest correct architecture boundary.
3. Add focused tests before or with the behavior change.
4. Implement the smallest compatible change.
5. Update documentation, sample documents, and generated artifacts.
6. Run narrow checks, then the complete validation contract (`npm run validate`).
7. Review the diff for secrets, private data, unsafe input, and drift.
8. Stop before commit, push, release, or publication unless authorized.
