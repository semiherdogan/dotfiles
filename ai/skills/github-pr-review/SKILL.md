---
name: github-pr-review
description: Use when the user provides a GitHub PR number or asks for a local PR review using gh checkout and gh diff, with a copyable Markdown review output.
---

# GitHub PR Review

Review a GitHub pull request locally and produce a Markdown review the user can copy.

Allowed actions:
- Check local git status.
- Run `gh pr checkout <number>` when needed.
- Run `gh pr diff <number>` to inspect the patch.
- Read changed files and nearby code.
- Run narrow local checks when useful and available.

Forbidden actions:
- Do not push.
- Do not commit.
- Do not merge, rebase, or cherry-pick.
- Do not approve, request changes, comment on, edit, close, or label the PR remotely.
- Do not modify files unless the user explicitly asks for a fix.

Workflow:
- Require a PR number if the user has not provided one.
- Before checkout, inspect `git status --short`. If local changes exist, report them and avoid overwriting them.
- Checkout the PR with `gh pr checkout <number>` if the branch is not already checked out.
- Capture the diff with `gh pr diff <number>`.
- Review from the diff first, then inspect full files for context where needed.
- Focus on correctness, regressions, security, data loss, performance, concurrency, API contracts, and missing tests.
- Prefer concrete findings over style comments.
- Verify claims with local code inspection or commands where feasible.

Output format:

```md
## Review

### Findings

1. **[severity] Title**
   - File: `path/to/file.ext`
   - Lines: `start-end`
   - Problem: ...
   - Impact: ...
   - Recommendation: ...

### Tests

- Ran: `command`
- Result: ...

### Summary

...
```

Rules:
- If there are no findings, say `No blocking findings found.`
- Keep findings ordered by severity.
- Include file paths and line numbers whenever possible.
- If checks were not run, state exactly why.
- Keep the final output copyable Markdown with no tool logs.
