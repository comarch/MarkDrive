# bugfix

<!-- PromptScript 2026-09-10T09:56:31.153Z | source: .promptscript/project.prs | target: claude - do not edit -->

> Reproduce and fix an editor or Drive integration regression

1. Create a minimal deterministic reproduction.
2. Write a failing focused test in `src/\_\_tests\_\_/`.
3. Find the first incorrect boundary or assumption.
4. Fix the root cause without widening unrelated behavior.
5. Run focused tests and the complete validation contract (`npm run validate`).
6. Update release notes or documentation when needed.
