# OpenCode setup

`opencode/` mirrors `~/.config/opencode`; `bin/setup-opencode` installs it. Config uses the OpenCode v2 keys (`agents`, `plugins`, `providers`, `permissions`).

## Layout

```
opencode/
  AGENTS.md                     global instructions, copied verbatim
  opencode.json                 managed config (instructions, plugins, permissions, compaction)
  opencode.local.json           machine-specific config (gitignored, see opencode.local.example.json)
  agents/                       agent definitions (architect, implementer, reviewer)
  commands/                     slash commands (/review)
  instructions/                 extra instruction files loaded through `instructions`
  profiles/                     per-agent model profiles (claude-code.json)
    active.json                 symlink to the selected profile (gitignored)
    work*.json                  machine-specific profiles (gitignored)
```

Skills are not duplicated here: they are installed from `pi/skills` (and `pi/skills-local`).

## Install

```sh
/absolute/path/to/dotfiles/bin/setup-opencode --profile NAME
```

Rerun it after changing anything in `opencode/` or `pi/skills`. It writes:

- `~/.config/opencode/AGENTS.md`, `agents/`, `commands/`, `instructions/`, `skills/`
- `~/.config/opencode/opencode.json` (deep-merged into the existing file)

It never touches `service.json`. Arrays such as `plugins` and `permissions` are replaced wholesale on every run.

## Profiles

| Profile | Default model | `explore` | `implementer` | `reviewer` | `architect` |
| --- | --- | --- | --- | --- | --- |
| `claude-code` | `claude-code/claude-opus-5-5[1m]` | `claude-sonnet-5-5#low` | `claude-sonnet-5-5#medium` | `claude-opus-5-5[1m]#high` | `claude-opus-5-5[1m]#high` |

The root `model` takes no `#variant`: OpenCode V2 drops it for the default model. Set variants per agent.

`profiles/active.json` is a symlink to the selected profile. `bin/setup-opencode --profile NAME` repoints it; without a selected profile the install fails. `active` is a reserved name, and a regular file at that path is never replaced.

The overlay is `opencode.json`, then the active profile, then `opencode.local.json`, deep-merged in that order, then deep-merged into the installed file.

The jq deep merge replaces arrays wholesale at both stages: a `permissions`, `plugins`, or `instructions` array in a profile or in `opencode.local.json` replaces the base array entirely. Keep those arrays in `opencode/opencode.json` only; `opencode.local.json` should carry only `providers`.

## Local provider

`opencode.local.json` defines the `llm-gateway` provider (OpenAI-compatible, base URL and model ids from `pi/models.local.json`). Copy `opencode.local.example.json` and fill in the base URL. The key is never written: the provider reads `LLM_GATEWAY_API_KEY`, exported from `local.sh`.

## Behavior

- `compaction.auto` is `false`; compact manually with `/compact`.
- `permissions` denies every `git` shell command except `status`, `log`, `diff`, `show`, `ls-files`.
- `/review` runs the `reviewer` subagent on the uncommitted working tree.
- `architect` is a read-only primary agent: it designs, delegates code changes to `implementer`, and verifies them with `reviewer`.

## Not ported from pi

- `claude-usage`: no equivalent; the `claude-code` plugin owns Claude auth.
- `write-guard`: `reviewer` denies `edit` and its shell is an allowlist of read-only git commands. `implementer` and `build` are not shell-restricted beyond the global git rules.
- `context-rollover` and `/handoff`: auto compaction is off, `/compact` is manual.
- `skill-newline`: the `skill` tool loads skills, no slash expansion to fix.
- `agent-profile`: use `bin/setup-opencode --profile NAME` from a shell.
- `researcher` agent: built-in `webfetch` and `websearch` tools replace it.
