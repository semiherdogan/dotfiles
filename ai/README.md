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

Shared skills are stored in:

```bash
/absolute/path/to/dotfiles/ai/skills/
```

Install them:

```bash
/absolute/path/to/dotfiles/bin/setup-ai
```

That writes:

```bash
~/.codex/AGENTS.md   # instructions.md + codex.md
~/.claude/CLAUDE.md  # instructions.md + claude.md
~/.codex/skills/     # shared skills
~/.claude/skills/    # shared skills
```

Run it again after changing any file in `ai/`.

## References

These files are personal defaults, but some parts are adapted from public agent-instruction and skill collections:

- [mattpocock/skills](https://github.com/mattpocock/skills): several shared skills in `ai/skills/` are adapted from this repo, with wording shortened and adjusted for this dotfiles setup.
- [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills): reference material for the general AI coding-agent instruction style used in `ai/instructions.md`.
