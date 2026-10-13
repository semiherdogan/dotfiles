# Pi setup

`pi/` mirrors `~/.pi/agent`; `bin/setup-pi` installs it.

## Layout

```
pi/
  AGENTS.md                     global instructions, copied verbatim
  agents/                       agent definitions for pi-open-agents
  extensions/                   one directory per Pi extension
  skills/                       shared skills
  skills-local/                 machine-local skills (gitignored, override shared ones by name)
  profiles/                     per-agent model profiles (claude-bridge.json, codex.json)
    active.json                 symlink to the selected profile (gitignored)
  settings.json                 managed Pi settings
  settings.local.json           machine-specific settings (gitignored, see settings.local.example.json)
  i-have-adhd.json              i-have-adhd extension config
  keybindings.json              managed keybindings
  models.local.json             custom endpoints (gitignored, see models.local.example.json)
```

## Install

```sh
/absolute/path/to/dotfiles/bin/setup-pi [--profile NAME]
```

Rerun it after changing anything in `pi/`. It writes:

- `~/.pi/agent/AGENTS.md`, `agents/`, `extensions/`, `skills/`
- `~/.pi/agent/settings.json`, `i-have-adhd.json`, `keybindings.json` (merged into existing files)
- `~/.pi/agent/models.json` (merged, only when `models.local.json` exists)

## Profiles

Agent models and thinking levels come from `profiles/*.json`, keyed by the filenames in `agents/` without `.md`. A profile must set `model` for every agent; `thinking` and `escalationModel` are optional. `escalationModel` defaults to the `architect` model.

Prompts reference effective values as `{{agent.field}}` (for example `{{implementer.escalationModel}}`); setup substitutes them at install time, so no prompt hardcodes a model id.

`profiles/active.json` is the selected profile. Select one with `bin/setup-pi --profile NAME`, or inside Pi with `/profile [name]`, which runs the same command and reloads. The command needs `DOTFILES_BASE`, exported by `bootstrap.sh`. Invalid values, unknown agent names, a missing model, or an unresolved placeholder fail the install.

## Agents

The agents come from `pi-open-agents`: `architect` holds the conversation and delegates to `explorer` (read-only lookups), `implementer` (file work), and `reviewer` (read-only review of the working tree). `architect` denies `edit` and `write`, so every file change goes through `implementer`. A project opts in with `"defaultAgent": "architect"` in its `.pi/settings.json`, and can override any agent with a full file in `.pi/agents/`.

## Settings merge

The `packages` array in `settings.json` is authoritative and replaced wholesale, so a package added with `pi install` is reverted on the next run. `settings.local.json` is deep-merged on top; its `packages` are concatenated with the shared ones and deduplicated. This is how `pi-claude-bridge` is installed on one machine only.

## Extensions

- `context-rollover`: disables auto compaction, shows context usage at 70%, and provides a user-approved `/handoff`.
- `git-guard`: blocks agent-run git commands except status, log, diff.
- `claude-usage`: shows Claude usage only for the `claude-bridge` or `anthropic` provider; reads the Claude Code keychain item.
- `skill-newline`: lets `/skill:name` expand when its args start on a new line.
- `agent-profile`: `/profile` command to switch the agent profile and reload.

## Keybindings

Overrides in `keybindings.json` are merged per action id, so bindings set directly in `~/.pi/agent/keybindings.json` survive unless the overlay defines the same action. `super+backspace` needs a terminal that reports Command through the Kitty keyboard protocol (Kitty, Ghostty, WezTerm, iTerm2 with Left Command = Super); the VS Code terminal never does. `ctrl+u` stays bound as the fallback.

## i-have-adhd

`i-have-adhd.json` sets `alwaysOn: true`. A per-session choice still wins (`/i-have-adhd off`). Restart Pi after editing it.

## Custom endpoints

Put custom OpenAI-, Anthropic- or Google-compatible endpoints in `models.local.json`. Keep keys out of it: `apiKey` accepts `$ENV_NAME`, resolved at request time, so export the variable in `local.sh`. A provider's `models` array is replaced wholesale on every run.

## References

These files are personal defaults, but some parts are adapted from public agent-instruction and skill collections:

- [mattpocock/skills](https://github.com/mattpocock/skills): several shared skills in `pi/skills/` are adapted from this repo, with wording shortened and adjusted for this dotfiles setup.
- [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills): reference material for the general AI coding-agent instruction style used in `pi/AGENTS.md`.
