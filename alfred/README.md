# Alfred

Small Alfred workflow scripts that are easier to version than Alfred's generated workflow state.

## Finder Actions

Create Universal Actions in Alfred and point each Run Script node to the matching script.

Use `/bin/zsh` and pass input as arguments.

```sh
/Users/semih/dotfiles/alfred/scripts/open-in.sh "Visual Studio Code" "$@"
/Users/semih/dotfiles/alfred/scripts/open-in.sh "VSCodium" "$@"
/Users/semih/dotfiles/alfred/scripts/open-in.sh "Sublime Text" "$@"
/Users/semih/dotfiles/alfred/scripts/open-in.sh "Ghostty" "$@"
/Users/semih/dotfiles/alfred/scripts/copy-path.sh "$@"
```

The Ghostty action opens the selected folder, or the parent directory when the selected item is a file.
