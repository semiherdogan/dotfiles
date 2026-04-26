## AI Instructions Setup

Shared AI instructions are stored in:

```bash
/absolute/path/to/dotfiles/ai/instructions.md
```

They define the default behavior for coding agents: direct communication, scoped edits, project style matching, performance awareness, syntax-aware search and verification.

Tool-specific additions are stored in:

```bash
/absolute/path/to/dotfiles/ai/codex.md
/absolute/path/to/dotfiles/ai/claude.md
```

Install them:

```bash
/absolute/path/to/dotfiles/bin/setup-ai
```

That writes:

```bash
~/.codex/AGENTS.md   # instructions.md + codex.md
~/.claude/CLAUDE.md  # instructions.md + claude.md
```

Run it again after changing any file in `ai/`.
