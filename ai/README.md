## AI Instructions Setup

Shared AI instructions are stored in:

```bash
/absolute/path/to/dotfiles/ai/instructions.md
```

They define the default behavior for coding agents: direct communication, scoped edits, project style matching, performance awareness, careful search and verification.

Tool-specific additions are stored in:

```bash
/absolute/path/to/dotfiles/ai/codex.md
/absolute/path/to/dotfiles/ai/claude.md
/absolute/path/to/dotfiles/ai/pi.md
```

Shared skills are stored in:

```bash
/absolute/path/to/dotfiles/ai/skills/
```

Machine-local skills can be stored in:

```bash
/absolute/path/to/dotfiles/ai/skills-local/
```

`skills-local` is ignored by git. Local skills are installed after shared skills, so a local
skill with the same name overrides the shared one on this machine.

Install them:

```bash
/absolute/path/to/dotfiles/bin/setup-ai
```

By default, this updates only agent directories that already exist on the current
machine. To create missing agent directories first, run:

```bash
/absolute/path/to/dotfiles/bin/setup-ai --force
```

To create and install only selected agents:

```bash
/absolute/path/to/dotfiles/bin/setup-ai --force --only codex,pi
```

Depending on which agent directories exist, that writes:

```bash
~/.codex/AGENTS.md   # instructions.md + codex.md
~/.claude/CLAUDE.md  # instructions.md + claude.md
~/.pi/agent/AGENTS.md  # instructions.md + pi.md
~/.codex/skills/     # shared skills
~/.claude/skills/    # shared skills
~/.agents/skills/    # preferred shared skills path for Pi/global agents
~/.pi/agent/skills/  # Pi skills fallback or Pi-specific manual additions
```

Run it again after changing any file in `ai/`.

## References

These files are personal defaults, but some parts are adapted from public agent-instruction and skill collections:

- [mattpocock/skills](https://github.com/mattpocock/skills): several shared skills in `ai/skills/` are adapted from this repo, with wording shortened and adjusted for this dotfiles setup.
- [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills): reference material for the general AI coding-agent instruction style used in `ai/instructions.md`.
