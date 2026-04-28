---
name: pre-commit-setup
description: Use when adding or reviewing pre-commit hooks, staged formatting, lint checks, type checks, or commit-time test automation.
---

# Pre-Commit Setup

Add commit-time checks that are fast enough to keep enabled.

Workflow:
- Detect the language, package manager, and existing scripts.
- Prefer staged-only formatting for speed.
- Run type checks and tests only when the repo already has reliable commands.
- Keep hooks deterministic and local.
- Verify the hook directly after setup.

Rules:
- Do not add heavy full-suite checks unless the user asks.
- Do not create commits unless explicitly asked.
- Do not overwrite existing hook config; merge with it.
- Document any skipped check and why.

Avoid:
- Installing one ecosystem's tooling into an unrelated repo.
- Blocking commits on flaky or slow commands by default.
- Hiding generated hook behavior behind unexplained scripts.
