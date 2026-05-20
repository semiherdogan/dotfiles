# dotfiles

Shell bootstrap, aliases, git config, and a few helper scripts.

## Setup

Clone the repo anywhere, then source `bootstrap.sh` from your shell startup file:

```sh
source /absolute/path/to/dotfiles/bootstrap.sh
```

Set up Git with the helper script:

```sh
/absolute/path/to/dotfiles/bin/setup-git
```

That writes:

```ini
[include]
    path = /absolute/path/to/dotfiles/gitconfig
```

If you already maintain `~/.gitconfig`, keep your extra sections there and only include the shared file from this repo. See [gitconfig.home.example](gitconfig.home.example) for the shape.

Set up AI coding-agent instructions:

```sh
/absolute/path/to/dotfiles/bin/setup-ai
```

That writes:

```sh
~/.codex/AGENTS.md
~/.claude/CLAUDE.md
~/.codex/skills/
~/.claude/skills/
```

Terminal emulator and prompt setup lives in [terminal/README.md](terminal/README.md).

## Layout

- `bootstrap.sh`: entrypoint, resolves the repo path dynamically.
- `aliases/`: tracked shell aliases and functions.
- `alfred/`: Alfred workflow scripts and setup notes.
- `ai/`: shared AI coding-agent instructions, skills, and setup notes.
- `scripts/`: small project helpers.
- `terminal/`: terminal emulator and prompt configs. See [terminal/README.md](terminal/README.md).
- `work.sh`: optional untracked work-specific commands.
- `local.sh`: optional untracked machine-specific commands.
- `bin/setup-git`: configures Git include and global ignore paths for the current repo location.
- `bin/setup-ai`: installs shared plus tool-specific AI instructions and skills.

Use the example files as a starting point:

```sh
cp /absolute/path/to/dotfiles/work.example.sh /absolute/path/to/dotfiles/work.sh
cp /absolute/path/to/dotfiles/local.example.sh /absolute/path/to/dotfiles/local.sh
```

## Validation

Run:

```sh
/absolute/path/to/dotfiles/bin/check
```

## Common Dependencies

- [jq](https://jqlang.org/)
- [delta](https://github.com/dandavison/delta)
- [gh](https://cli.github.com/)

## Apps

Daily apps and tools are listed in [APPS.md](APPS.md).
