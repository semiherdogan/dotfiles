# Terminal

Terminal emulator and prompt configs.

## Kitty

```sh
mkdir -p ~/.config/kitty
ln -s /absolute/path/to/dotfiles/terminal/kitty.conf ~/.config/kitty/kitty.conf
```

Wallpaper source is currently unknown. If you are the original artist and want attribution or removal, please open an issue.

## WezTerm

```sh
ln -s /absolute/path/to/dotfiles/terminal/wezterm.lua ~/.wezterm.lua
```

## Starship

```sh
mkdir -p ~/.config
ln -s /absolute/path/to/dotfiles/terminal/starship.toml ~/.config/starship.toml
```

VS Code terminal can use the simpler config to avoid powerline/icon rendering issues:

```json
"terminal.integrated.env.osx": {
  "STARSHIP_CONFIG": "/Users/semih/dotfiles/terminal/starship-vscode.toml"
}
```
