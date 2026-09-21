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
/absolute/path/to/dotfiles/ai/kiro.md
```

Agent-specific extensions are stored by target in:

```bash
/absolute/path/to/dotfiles/ai/extensions/pi/
```

Pi agent definitions are stored in:

```bash
/absolute/path/to/dotfiles/ai/agents/pi/
```

Managed settings overlays are stored in:

```bash
/absolute/path/to/dotfiles/ai/config/
```

Shared skills are stored in:

```bash
/absolute/path/to/dotfiles/ai/skills/
```

Skills that support only selected agents list those agents in a matching file under:

```bash
/absolute/path/to/dotfiles/ai/skill-targets/
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

For Kiro only:

```bash
/absolute/path/to/dotfiles/bin/setup-ai --force --only kiro
```

Depending on which agent directories exist, that writes:

```bash
~/.codex/AGENTS.md   # instructions.md + codex.md
~/.pi/agent/AGENTS.md  # instructions.md + pi.md
~/.kiro/steering/dotfiles-instructions.md  # instructions.md + kiro.md
~/.codex/skills/     # shared skills
~/.agents/skills/    # preferred shared skills path for Pi/global agents
~/.pi/agent/skills/  # Pi skills fallback or Pi-specific manual additions
~/.pi/agent/extensions/context-rollover/  # global Pi context rollover extension
~/.pi/agent/extensions/git-guard/         # blocks agent-run git commands except status, log, diff
~/.pi/agent/extensions/claude-usage/      # Claude subscription usage status and /usage command
~/.pi/agent/extensions/skill-newline/     # lets /skill:name expand when its args start on a new line
~/.pi/agent/extensions/architect-guard/   # blocks the architect's own edit/write outside *.md and .pi/, so code goes through implementer
~/.pi/agent/agents/       # Pi agent definitions for pi-open-agents
~/.pi/agent/settings.json  # existing settings merged with managed Pi settings
~/.pi/agent/i-have-adhd.json  # i-have-adhd extension config, always-on for every Pi session
~/.kiro/skills/      # shared skills for Kiro
```

Claude is opt-in. Nothing is written to `~/.claude` unless the run explicitly asks for it:

```sh
/absolute/path/to/dotfiles/bin/setup-ai --only claude
```

That installs `~/.claude/CLAUDE.md` (instructions.md + claude.md) and `~/.claude/skills/`.

The `handoff` skill is installed only for Claude and Codex. It does not install hooks.

The `claude-usage` extension only shows its status entry when the selected model is a Claude model
or the provider is `claude-bridge` or `anthropic`. Usage data comes from the Claude Code keychain
credentials, so it requires a working `claude` login.

The `packages` list in `ai/config/pi-settings.json` is authoritative: the settings merge replaces the
array wholesale, so a package added with `pi install` is reverted on the next `setup-ai` run. Add it
to the overlay instead.

The `i-have-adhd` package is enabled for every Pi session through `ai/config/pi-i-have-adhd.json`
(`alwaysOn: true`). A per-session choice still wins, so `/i-have-adhd off` or `stop adhd mode`
keeps that session disabled. The extension reads the file at startup, so restart Pi after changing it.

The Pi agents come from `pi-open-agents` (listed in that `packages` array). `architect` runs on Fable
and holds the conversation; it delegates to three read-scoped or write-scoped subagents: `explorer`
(Sonnet, read-only) answers "where is X, who calls Y" lookups so those file reads stay out of the main
session; `implementer` (Sonnet) does the file work; `reviewer` (Opus, read-only, `code-review` skill)
reviews the working tree after each implementer slice and reports findings that the architect filters
and routes back as one corrective task. The `architect-guard` extension enforces the split: in a
session where `architect` is active, `edit`/`write` on anything other than Markdown or the `.pi/` tree
is blocked at call time with a reason pointing at `implementer`. A project opts in by setting `"defaultAgent": "architect"` in
its own `.pi/settings.json`; without that, the agents are still selectable with `/agent` but nothing
routes automatically. A project can override any agent by name with a full file in `.pi/agents/`, for
example a `reviewer` that carries a project-specific review skill instead of `code-review`.

Pi uses the global `context-rollover` extension instead. It disables automatic compaction through
a settings merge, shows advisory context usage at a 70% threshold, and provides a user-approved
`/handoff` workflow. The extension never creates a handoff file or copies the old transcript into
the fresh session.

Run it again after changing any file in `ai/`.

## References

These files are personal defaults, but some parts are adapted from public agent-instruction and skill collections:

- [mattpocock/skills](https://github.com/mattpocock/skills): several shared skills in `ai/skills/` are adapted from this repo, with wording shortened and adjusted for this dotfiles setup.
- [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills): reference material for the general AI coding-agent instruction style used in `ai/instructions.md`.
