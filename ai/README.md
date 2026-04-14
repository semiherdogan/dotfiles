## AI Instructions Setup

Shared AI instructions are stored in:

```bash
~/dotfiles/ai/instructions.md
```

Symlink them:

```bash
mkdir -p ~/.claude ~/.codex

ln -sf ~/dotfiles/ai/instructions.md ~/.claude/CLAUDE.md
ln -sf ~/dotfiles/ai/instructions.md ~/.codex/AGENTS.md
```

Paste the same content into Claude Desktop custom instructions manually.
