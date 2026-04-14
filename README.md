# dotfiles

Shell bootstrap, aliases, git config, and a few helper scripts.

## Setup

Clone the repo anywhere, then source `bootstrap.sh` from your shell startup file:

```sh
source /absolute/path/to/dotfiles/bootstrap.sh
```

Include the shared Git config from `~/.gitconfig`:

```ini
[include]
    path = /absolute/path/to/dotfiles/gitconfig
```

If the repo is not at `~/dotfiles`, update the `core.excludesfile` path inside `gitconfig` too.

## Layout

- `bootstrap.sh`: entrypoint, resolves the repo path dynamically.
- `aliases/`: tracked shell aliases and functions.
- `scripts/`: small project helpers.
- `work.sh`: optional untracked work-specific commands.
- `local.sh`: optional untracked machine-specific commands.

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
- [Slackadays/Clipboard](https://github.com/Slackadays/Clipboard)
- [pwgen](https://formulae.brew.sh/formula/pwgen)
- [delta](https://github.com/dandavison/delta)
- [gh](https://cli.github.com/)
- [bb](https://github.com/bb-cli/bb-cli)
