---
name: handoff
description: Write a project-root HANDOFF.md that preserves active work across a context rollover or fresh coding session. Use when context usage is high, a rollover warning appears, or the user asks to hand off, roll over, clear, or continue the work in a new Claude Code or Codex session.
---

# Context rollover handoff

Write `HANDOFF.md` at the project root so a fresh session can continue without guessing.

## Capture current state

Before writing, inspect the current conversation and capture live repository state with read-only commands:

- Current date and time
- Repository root and current branch
- Working tree status
- Diff summary, including staged changes
- Five most recent commits
- Known test, lint, build, or verification results from this session

If the working directory is not a Git repository, mark Git-specific fields as not applicable. Do not modify repository state while collecting context.

## Write the handoff

Read [references/HANDOFF.template.md](references/HANDOFF.template.md), then overwrite `HANDOFF.md` at the project root using the same headings and order.

Fill every section from the current conversation, current plan, tool results, and live repository state:

- Use concrete file paths, commands, errors, and outcomes. Avoid filler.
- Keep the file at 150 lines or fewer.
- Preserve unfinished work and current task items, excluding completed items.
- Record failed approaches and why they failed so the next session does not repeat them.
- Make `Next Concrete Step` one immediately executable action with a file and command when relevant.
- Put only session-specific requests under `User Preferences / Constraints`; do not repeat project instructions.
- Write `None.` when a section has no content.
- Include invocation notes supplied by the user when relevant.
- Never include secrets, credentials, tokens, customer data, or sensitive environment values. Reference variable names or config paths instead.
- Write the handoff in English.
- Do not commit or stage `HANDOFF.md`.

## Finish

Confirm that `HANDOFF.md` is ready and give the platform-appropriate next action:

- In Claude Code, tell the user to run `/clear`; the session-start hook will load the handoff.
- In Codex, tell the user to start a new task in the same project; the session-start hook will load the handoff.
- If the platform is unclear, tell the user to start a fresh session in the same project and continue from `HANDOFF.md`.
