# Alfred

Small Alfred workflow scripts that are easier to version than Alfred's generated workflow state.

## Finder Actions

Create Universal Actions in Alfred and point each Run Script node to the matching script.

Use `/bin/zsh` and pass input as arguments.

```sh
/Users/semih/dotfiles/alfred/scripts/open-in.sh "Visual Studio Code" "$@"
/Users/semih/dotfiles/alfred/scripts/open-in.sh "VSCodium" "$@"
/Users/semih/dotfiles/alfred/scripts/open-in.sh "Sublime Text" "$@"
/Users/semih/dotfiles/alfred/scripts/open-terminal.sh "Kitty" "$@"
/Users/semih/dotfiles/alfred/scripts/copy-path.sh "$@"
```

The Kitty action toggles the app when it is already running. When opening a new window, it uses the selected folder, or the parent directory when the selected item is a file, then centers the new window.

`open-in.sh` delegates Kitty and Ghostty to `open-terminal.sh` so selected paths open as terminal working directories.

## Center Window

`center-window.swift` moves the focused or main window of a running app to the center of the current display.

```sh
/Users/semih/dotfiles/alfred/scripts/center-window.swift Kitty
/Users/semih/dotfiles/alfred/scripts/center-window.swift "Visual Studio Code"
```

The app must already be running. macOS Accessibility permission is required for the app that runs the script, such as Terminal or Alfred:

`System Settings -> Privacy & Security -> Accessibility`

Use `--debug` to print the selected app, window position, target position, and move result:

```sh
/Users/semih/dotfiles/alfred/scripts/center-window.swift --debug Kitty
```
