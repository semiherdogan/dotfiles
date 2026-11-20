# OpenCode setup

`opencode/` mirrors `~/.config/opencode`; `bin/setup-opencode` installs it. Config uses the OpenCode v2 keys (`agents`, `plugins`, `providers`, `permissions`, `policies`).

## Layout

```
opencode/
  AGENTS.md                     global instructions, copied verbatim
  opencode.json                 managed config (instructions, plugins, permissions, policies, compaction)
  opencode.local.json           machine-specific config (optional, gitignored)
  agents/                       agent definitions (architect, implementer, reviewer)
  commands/                     slash commands (/review)
  instructions/                 extra instruction files loaded through `instructions`
  providers/9router.json        static 9router provider block (models are fetched at setup time)
  9router-models.jq             maps the 9router /models response to OpenCode models
  profiles/                     per-agent model profiles (openai.json, 9router.json)
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
| `openai` | `openai/gpt-6-astra` | `gpt-6-luna#low` | `gpt-6.1-sol#medium` | `gpt-6.1-sol#high` | `gpt-6-astra#medium` |
| `9router` | `9router/cc/claude-opus-5-5` | `cc/claude-sonnet-5-5#low` | `cc/claude-sonnet-5-5#medium` | `cc/claude-opus-5-5#high` | `cc/claude-opus-5-5#high` |

`openai` uses the built-in ChatGPT sign-in (`/connect`, OpenAI, Sign in with ChatGPT), so no bridge is needed.

The root `model` takes no `#variant`: OpenCode V2 drops it for the default model. Set variants per agent.

`profiles/active.json` is a symlink to the selected profile. `bin/setup-opencode --profile NAME` repoints it; without a selected profile the install fails. `active` is a reserved name, and a regular file at that path is never replaced.

The overlay is `opencode.json`, then the active profile, then `opencode.local.json`, deep-merged in that order, then deep-merged into the installed file.

The jq deep merge replaces arrays wholesale at both stages: a `permissions`, `plugins`, `instructions`, or `policies` array in a profile or in `opencode.local.json` replaces the base array entirely. Keep those arrays in `opencode/opencode.json` only; `opencode.local.json` should carry only `providers`.

## 9router provider

Set these in `local.sh` (values are never written to a file; the config holds `{env:...}` references):

- `NINE_ROUTER_BASE_URL` (must start with `https://` and include `/v1`)
- `NINE_ROUTER_API_KEY`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

`bin/setup-opencode` fetches `$NINE_ROUTER_BASE_URL/models` and writes the model list into the installed config, replacing the old `9router` provider completely. Rerun setup to refresh the list.

If a variable is missing, curl is missing, 9router is unreachable, or the response has no usable models, setup prints one warning, leaves any installed `9router` provider untouched, and continues.

## Local overlay

`opencode.local.json` is an optional, gitignored, machine-specific overlay, deep-merged after the active profile; the fetched `9router` provider is applied on top of it, so a `providers["9router"]` key here loses to the fetched block. Keep only `providers` in it.

## Behavior

- `plugins` is intentionally `[]` in `opencode.json`: setup replaces arrays wholesale, so this clears the plugin entries from the installed `~/.config/opencode/opencode.json`. Plugin files under `~/.config/opencode/plugins/` are not touched.
- `policies` denies `provider.use` for the built-in OpenCode providers (`opencode`, `opencode-go`), so they and their models are hidden.
- `shell` is `/bin/zsh` for the terminal and shell tools.
- `compaction.auto` is `false`; compact manually with `/compact`.
- `permissions` denies every `git` shell command except read-only inspection: `status`, `log`, `diff`, `show`, `ls-files`, `blame`, `describe`, `shortlog`, `rev-parse`, `rev-list`, `cat-file`, `ls-tree`, `merge-base`, `for-each-ref`, `show-ref`, `check-ignore`, `stash list/show`, `worktree list`, `config --get`, plus the exact forms `git branch`, `git branch --show-current`, `git tag`, `git remote`, `git remote -v`. `--output` is denied globally and in `reviewer` (wildcard match on the command text, so best effort). Wildcards cannot check flags the way pi's git-guard does, so `git grep` stays denied (grouped short flags such as `-iOsh` run a pager command) and `branch`, `tag`, `remote` are limited to those exact forms.
- `default_agent` is `architect`.
- `/review` runs the `reviewer` subagent on the uncommitted working tree.
- `architect` is a read-only primary agent: it designs, delegates code changes to `implementer`, and verifies them with `reviewer`.

## Not ported from pi

- `claude-usage`: no equivalent.
- `write-guard`: `reviewer` denies `edit` and its shell is an allowlist of read-only git commands. `implementer` and `build` are not shell-restricted beyond the global git rules.
- `skill-newline`: the `skill` tool loads skills, no slash expansion to fix.
- `agent-profile`: use `bin/setup-opencode --profile NAME` from a shell.
- `researcher` agent: built-in `webfetch` and `websearch` tools replace it.
- `review-gate`: no plugin; the `architect` prompt requires one `reviewer` round per request.
- `change-review` (`/review-summary`): use `/review`.
- `subagent-status`: the TUI already shows child sessions.
- `codex-bridge`: the `openai` profile uses the built-in ChatGPT sign-in.
