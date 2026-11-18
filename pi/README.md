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
  profiles/                     per-agent model profiles (claude-bridge.json, codex-bridge.json, openai.json)
  settings.json                 managed Pi settings
  settings.local.json           machine-specific settings (gitignored, see settings.local.example.json)
  permissions.json              shared pi-open-agents permission policy
  permissions.local.json        machine-specific policy, e.g. trustedProjects (gitignored, see permissions.local.example.json)
  i-have-adhd.json              i-have-adhd extension config
  keybindings.json              managed keybindings
  models.local.json             custom endpoints (gitignored, see models.local.example.json)
```

## Install

```sh
/absolute/path/to/dotfiles/bin/setup-pi [--profile NAME]
```

Rerun it after changing anything in `pi/`. It writes:

- `~/.pi/agent/AGENTS.md`, `agents/`, `profiles/`, `extensions/`, `skills/`
- `~/.pi/agent/settings.json`, `i-have-adhd.json`, `keybindings.json` (merged into existing files)
- `~/.pi/agent/permissions.json` (`permissions.json` plus `permissions.local.json`, written whole; edits made directly in the installed file are lost)
- `~/.pi/agent/models.json` (merged, only when `models.local.json` exists)

## Profiles

Agent models and thinking levels come from `profiles/*.json`, keyed by the filenames in `agents/` without `.md`. Each entry needs `model`; `thinking` and `escalationModel` are optional. Setup installs the files as they are to `~/.pi/agent/profiles/`; validation and resolution happen in `pi-open-agents`, see its `PROFILES.md` for the format and the error cases.

The selection lives in `~/.pi/agent/profile-state.json` (`{"active": "<name>"}`). Set it with `bin/setup-pi --profile NAME`, or inside Pi with `/profile [name]`. Switching applies to all running sessions on their next request: no reload and no setup rerun. An edited or new profile file still needs `bin/setup-pi` to be installed.

An agent follows the profile unless its frontmatter sets `model:`. Escalation routes exist only where a profile entry sets `escalationModel`.

### Project override

A project can override the global profile with `.pi/profile.json`:

```json
{
  "profile": "openai",
  "agents": {
    "implementer": { "model": "openai/gpt-6-astra", "thinking": "high" }
  }
}
```

Both fields are optional. `profile` selects any installed profile by name; `agents` applies field-wise overrides on top of that profile, or of the global one when `profile` is absent. An agent not present in the profile needs its own `model`.

The file is read at session start from the working directory, only in a trusted project. Subagents never read it: they inherit the parent's project override and resolve it live against the current profile, whatever their own cwd is. The footer shows `[name · project]` while an override is active. An invalid file or an unknown `profile` name is ignored with a warning and the global profile stays active; an override without `model` for an agent the profile does not define is ignored with a warning while the rest of the file still applies. `/profile` keeps switching the global profile; the project file still takes precedence in that project.

Keep the file out of shared repositories: model ids are machine-specific. Agents cannot write it, since `.pi` is write-protected.

## Agents

The agents come from `pi-open-agents`, installed from the personal fork per machine through `settings.local.json` (a local checkout path during the trial; the shared settings will later use `https://github.com/semiherdogan/pi-open-agents`). A machine without that local entry has no agent extension. `architect` holds the conversation and delegates to `explorer` (read-only lookups), `researcher` (web lookups), `implementer` (file work), and `reviewer` (read-only review of the working tree).

Permissions come from the fork's runtime policy (see its `PERMISSIONS.md`): `permissions.json` turns on strict mode, and its `agents["*"]` block holds the read-only bash rules shared by every agent (and by sessions without an agent). Each agent's frontmatter `permission` block lists only what is specific to that agent; unlisted bash commands, edits and writes are denied, git writes are hard denied for every agent. The `alwaysDeny` paths are protected from reads and writes by every agent, and the built-in protected paths (`.git`, `.pi`, `.opencode`, `.agents`, the agent dir) are write-protected. `architect` denies `edit` and `write` and delegates in `role` mode, so each child runs with its own permissions instead of being capped by the architect's, and every file change goes through `implementer`. During the trial `architect` also keeps `readOnly: true` for the write-guard extension. A project opts in with `"defaultAgent": "architect"` in its `.pi/settings.json`, and can override any agent with a full file in `.pi/agents/`, which gets the shared rules too, so it only needs its own specifics. The fork must be a version that supports `agents` in the user file: an older one rejects the file as invalid and blocks bash, edit and write until it is updated.

## Settings merge

The `packages` array in `settings.json` is authoritative and replaced wholesale, so a package added with `pi install` is reverted on the next run. `settings.local.json` is deep-merged on top; its `packages` are concatenated with the shared ones and deduplicated. This is how `pi-claude-bridge` and the local `pi-open-agents` fork are installed on one machine only.

`permissions.local.json` is merged into `permissions.json` the same way: objects deep-merged, `trustedProjects` and the `alwaysDeny` lists concatenated and deduplicated. The result must have `"version": 1` or the install fails.

## Extensions

- `context-rollover`: disables auto compaction, shows context usage at 70%, and provides a user-approved `/handoff`.
- `git-guard`: blocks agent-run git commands except read-only inspection (status, log, diff, show, grep, blame, branch/tag listing, config reads, ...).
- `write-guard`: blocks `edit`, `write` and shell file writes for agents marked `readOnly: true` or without edit/write tools.
- `claude-usage`: shows Claude usage only for the `claude-bridge` or `anthropic` provider; reads the Claude Code keychain item.
- `skill-newline`: lets `/skill:name` expand when its args start on a new line.
- `review-gate`: when the active agent is `architect` and `implementer` changed the working tree, asks for one `reviewer` round if the architect gives its final answer without one, and never after two `reviewer` rounds in a run. Other agents get no automatic review.
- `change-review`: `/review-summary [focus]` asks the agent for a pinpoint review of the working tree and opens the report. It never runs on its own.
- `codex-bridge`: `codex-bridge/*` models that run through the Codex CLI app-server, so turns use the ChatGPT/Codex subscription bucket while pi's own tools run in pi. Needs `codexBridge.codexPath` (the Codex CLI binary) in `settings.local.json`; without it the provider is not registered. Codex built-in tools are disabled and threads run read-only. pi's tools reach the model through Codex code mode (`functions.exec`); Codex's multi-agent `collaboration.*` tools are turned off with a generated `model_catalog_json` override.

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
