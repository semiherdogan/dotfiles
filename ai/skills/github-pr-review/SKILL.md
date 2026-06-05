---
name: github-pr-review
description: Use when the user provides a GitHub PR number, asks for a local PR review, or asks to prepare a PR review prompt using GitHub PR context, diff-first inspection, optional temporary worktrees for checks, and a copyable Markdown review output.
---

# GitHub PR Review

Review a GitHub pull request locally and produce a Markdown review the user can copy.

Allowed actions:
- Check local git status.
- Run `gh pr view <number> --comments` to inspect the PR description and conversation comments.
- Run read-only `gh api` calls to inspect review summaries and inline review comments.
- Run `gh pr diff <number> --patch --color=never` to inspect the patch without switching branches.
- Create a temporary review worktree outside the current checkout when full files or checks are needed.
- Read changed files and nearby code in the temporary worktree.
- Run narrow local checks when useful and available.

Forbidden actions:
- Do not push.
- Do not commit.
- Do not merge, rebase, or cherry-pick.
- Do not approve, request changes, comment on, edit, close, or label the PR remotely.
- Do not modify files unless the user explicitly asks for a fix.
- Do not switch the user's current branch unless the user explicitly asks.
- Do not apply PR patches to the user's current worktree.

Workflow:
- Require a PR number if the user has not provided one.
- Inspect `git status --short` and preserve any local changes.
- Read PR context:
  - `gh pr view <number> --comments`
  - `gh api repos/:owner/:repo/pulls/<number>/reviews`
  - `gh api repos/:owner/:repo/pulls/<number>/comments`
- Capture the diff with `gh pr diff <number> --patch --color=never`.
- Review from the diff and PR comments first, then inspect full files for context where needed.
- If full files, lint, or tests are needed, create a temporary worktree outside the current checkout:
  - Prefer the PR merge ref so checks run against the proposed merge result.
  - If the merge ref is unavailable, use the PR head ref and state that the merge result was not checked.
  - Run checks inside the temporary worktree only.
- Use this worktree pattern when needed:
  - `git fetch origin pull/<number>/merge:refs/remotes/origin/pr/<number>-merge`
  - `git worktree add --detach <tmp-dir> refs/remotes/origin/pr/<number>-merge`
  - Fallback to `pull/<number>/head` only when the merge ref cannot be fetched.
- Consider existing reviewer comments before adding a finding. If a concern is already covered, mention it only when adding new evidence or impact.
- Focus on correctness, regressions, security, data loss, performance, concurrency, API contracts, and missing tests.
- Prefer concrete findings over style comments.
- Separate must-fix findings from nice-to-have notes. Do not let nits obscure blocking issues.
- Verify claims with local code inspection or commands where feasible.
- Keep the final review concise and direct. Cut filler, repeated context, generic advice, and non-actionable commentary.

Output format:

```md
## Review

### Findings

#### Must Fix

1. **[severity] Title**
   - File: `path/to/file.ext`
   - Lines: `start-end`
   - Problem: ...
   - Impact: ...
   - Recommendation: ...

#### Nice To Have

1. **Title**
   - File: `path/to/file.ext`
   - Lines: `start-end`
   - Note: ...

### Tests

- Ran: `command`
- Result: ...

### Summary

...
```

Rules:
- Put correctness, regression, security, data loss, performance, concurrency, broken contracts, and missing critical tests under `Must Fix`.
- Put readability, minor maintainability, naming, small duplication, and non-blocking cleanup under `Nice To Have`.
- Omit `Nice To Have` entirely when it would be noise.
- If there are no must-fix findings, say `No blocking findings found.`
- Keep must-fix findings ordered by severity.
- Include file paths and line numbers whenever possible.
- If checks were not run, state exactly why.
- Keep the final output copyable Markdown with no tool logs.
