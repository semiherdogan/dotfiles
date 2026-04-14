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

## Layout

- `bootstrap.sh`: entrypoint, resolves the repo path dynamically.
- `aliases/`: tracked shell aliases and functions.
- `scripts/`: small project helpers.
- `work.sh`: optional untracked work-specific commands.
- `local.sh`: optional untracked machine-specific commands.
- `bin/setup-git`: configures Git include and global ignore paths for the current repo location.

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
- [bb](https://github.com/bb-cli/bb-cli)

## Apps

Daily apps and tools are listed in [APPS.md](APPS.md).
