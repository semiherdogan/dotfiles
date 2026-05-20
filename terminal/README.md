# Terminal

Terminal emulator and prompt configs.

## Ghostty

```sh
mkdir -p ~/.config/ghostty
ln -s /absolute/path/to/dotfiles/terminal/ghostty/config.ghostty ~/.config/ghostty/config.ghostty
```

Ghostty also reads `~/Library/Application Support/com.mitchellh.ghostty/config.ghostty` on macOS. If both files exist, the macOS-specific file is loaded after the XDG file and overrides matching settings.

## WezTerm

```sh
ln -s /absolute/path/to/dotfiles/terminal/wezterm.lua ~/.wezterm.lua
```

## Starship

```sh
mkdir -p ~/.config
ln -s /absolute/path/to/dotfiles/terminal/starship.toml ~/.config/starship.toml
```
