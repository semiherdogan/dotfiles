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

By default, this installs only Pi, and only when `~/.pi/agent` already exists. To create
the missing directory first, run:

```bash
/absolute/path/to/dotfiles/bin/setup-ai --force
```

Codex and Claude are opt-in. Name them explicitly to install them, with or without Pi:

```bash
/absolute/path/to/dotfiles/bin/setup-ai --only pi,codex
/absolute/path/to/dotfiles/bin/setup-ai --only claude
```

Depending on which agents are selected and which directories exist, that writes:

```bash
~/.pi/agent/AGENTS.md  # instructions.md + pi.md
~/.agents/skills/    # preferred shared skills path for Pi/global agents
~/.pi/agent/skills/  # Pi skills fallback or Pi-specific manual additions
~/.pi/agent/extensions/context-rollover/  # global Pi context rollover extension
~/.pi/agent/extensions/git-guard/         # blocks agent-run git commands except status, log, diff
~/.pi/agent/extensions/claude-usage/      # Claude subscription usage status and /usage command
~/.pi/agent/extensions/skill-newline/     # lets /skill:name expand when its args start on a new line
~/.pi/agent/extensions/architect-guard/   # blocks the architect's own edit/write outside *.md and .pi/, so code goes through implementer
~/.pi/agent/extensions/agent-profile/     # /profile command: switch the agent profile and reload
~/.pi/agent/agents/       # Pi agent definitions for pi-open-agents
~/.pi/agent/settings.json  # existing settings merged with managed Pi settings
~/.pi/agent/models.json   # custom providers merged from ai/config/pi-models.local.json, if present
~/.pi/agent/i-have-adhd.json  # i-have-adhd extension config, always-on for every Pi session
~/.pi/agent/keybindings.json  # existing keybindings merged with managed Pi keybindings
~/.codex/AGENTS.md   # instructions.md + codex.md, only with --only codex
~/.codex/skills/     # shared skills, only with --only codex
~/.claude/CLAUDE.md  # instructions.md + claude.md, only with --only claude
~/.claude/skills/    # shared skills, only with --only claude
```

The `claude-usage` extension only shows its status entry when the selected model is a Claude model
or the provider is `claude-bridge` or `anthropic`. Usage data comes from the Claude Code keychain
credentials, so it requires a working `claude` login.

The `packages` list in `ai/config/pi-settings.json` is authoritative: the settings merge replaces the
array wholesale, so a package added with `pi install` is reverted on the next `setup-ai` run. Add it
to the overlay instead.

Machine-specific settings go into the git-ignored `ai/config/pi-settings.local.json`; copy
`pi-settings.local.example.json` to start. It is deep-merged on top of the shared overlay before the
install, with one exception: `packages` is the shared list followed by the local list, deduplicated,
so a local file can add a package without repeating the shared ones. This is how `pi-claude-bridge`
is installed only on the machine that has a Claude Code login. The `claude-usage` extension is
installed everywhere but stays silent unless the selected model is a Claude model.

The `i-have-adhd` package is enabled for every Pi session through `ai/config/pi-i-have-adhd.json`
(`alwaysOn: true`). A per-session choice still wins, so `/i-have-adhd off` or `stop adhd mode`
keeps that session disabled. The extension reads the file at startup, so restart Pi after changing it.

Keybinding overrides live in `ai/config/pi-keybindings.json` and are merged per action id, so
bindings set directly in `~/.pi/agent/keybindings.json` survive unless the overlay defines the same
action. `super+backspace` needs a terminal that reports Command as a separate modifier through the
Kitty keyboard protocol (Kitty, Ghostty, WezTerm with `enable_kitty_keyboard`, iTerm2 with
**Profiles > Keys > General > Left Command = Super**). The VS Code integrated terminal never reports
it. `ctrl+u` stays bound everywhere as the fallback.

The Pi agents come from `pi-open-agents` (listed in that `packages` array). `architect` runs on the
strongest configured model and holds the conversation; it delegates to three read-scoped or
write-scoped subagents: `explorer` (read-only) answers "where is X, who calls Y" lookups so those file
reads stay out of the main session; `implementer` does the file work; `reviewer` (read-only, `code-review` skill)
reviews the working tree after each implementer slice and reports findings that the architect filters
and routes back as one corrective task. The `architect-guard` extension enforces the split: in a
session where `architect` is active, `edit`/`write` on anything other than Markdown or the `.pi/` tree
is blocked at call time with a reason pointing at `implementer`. A project opts in by setting `"defaultAgent": "architect"` in
its own `.pi/settings.json`; without that, the agents are still selectable with `/agent` but nothing
routes automatically. A project can override any agent by name with a full file in `.pi/agents/`, for
example a `reviewer` that carries a project-specific review skill instead of `code-review`.

Agent models and thinking levels come from profiles in `ai/config/pi-profiles/`. Each profile is a
JSON file keyed by the filenames in `ai/agents/pi/` without `.md`. The shared agent files carry no
`model`, so a profile must set one for every agent; `thinking` and `escalationModel` are optional and
fall back to the shared frontmatter and the `architect` model. Without a selected profile, or with an
agent left without a model, `setup-ai` fails instead of installing agents that point at a provider
this machine may not have. Profiles are committed, so one profile can mix providers (for example `claude-bridge` for
`architect`, `openrouter` for `implementer`) and every machine can pick from the same set. Choose
models available through your Pi login. Thinking levels are `off`, `minimal`, `low`, `medium`, `high`,
`xhigh`, and `max`, subject to the selected model's support.

The active profile is the git-ignored symlink `ai/config/pi-agents.local.json`. Select one with:

```bash
/absolute/path/to/dotfiles/bin/setup-ai --profile claude-bridge
```

or from inside Pi with `/profile [name]`, which runs the same command and then reloads the session,
so the active agent and new subagent spawns use the new models. The extension locates the repo
through `DOTFILES_BASE`, which `bootstrap.sh` exports. Subagents already running finish on the old
model. `setup-ai` refuses to replace a hand-written `pi-agents.local.json` that is a regular file;
move it into `pi-profiles/` first.

Custom OpenAI-, Anthropic- or Google-compatible endpoints go into the git-ignored
`ai/config/pi-models.local.json`; copy `pi-models.local.example.json` and edit it. `setup-ai` merges it
into `~/.pi/agent/models.json`, the file Pi reads for compatible endpoints. Keep API keys out of the
file: `apiKey` accepts `$ENV_NAME`, which Pi resolves at request time, so export the variable in
`local.sh`. A provider's `models` array is replaced wholesale on every run. Built-in providers such as
`openrouter` need no entry here, only their credentials (`OPENROUTER_API_KEY` or `/login`).

Agent prompts never hardcode a model id. They reference the effective values as `{{agent.field}}`,
for example `{{implementer.escalationModel}}` in the architect's upgrade rule, and `bin/setup-ai`
substitutes them at install time from the frontmatter plus the local overrides. `escalationModel`
has no frontmatter counterpart: unset, it falls back to the `architect` model. An unresolved
placeholder fails the install rather than shipping a prompt with a model that does not exist on
this machine.

Profile values are applied only to the installed frontmatter, leaving shared files and prompt bodies
unchanged. Every setup run uses the latest shared prompts and reapplies the active profile.
Remove `thinking` from a profile entry and rerun setup to restore its shared default. Invalid values,
unsupported fields, and unknown agent filenames fail installation instead of silently ignoring a typo.
Project agents in `.pi/agents/` still take precedence over these installed global agents.

Context rollover is handled by the global `context-rollover` extension. It disables automatic compaction through
a settings merge, shows advisory context usage at a 70% threshold, and provides a user-approved
`/handoff` workflow. The extension never creates a handoff file or copies the old transcript into
the fresh session.

Run it again after changing any file in `ai/`.

## References

These files are personal defaults, but some parts are adapted from public agent-instruction and skill collections:

- [mattpocock/skills](https://github.com/mattpocock/skills): several shared skills in `ai/skills/` are adapted from this repo, with wording shortened and adjusted for this dotfiles setup.
- [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills): reference material for the general AI coding-agent instruction style used in `ai/instructions.md`.
