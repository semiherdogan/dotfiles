# Toolbox keeps global CLI tools in an isolated Devbox environment instead of
# installing them directly on the machine.
# Use it for tools that should be available globally on the computer.
# Run `toolbox init` once to create ~/toolbox/devbox.json.
toolbox() {
    local toolbox_dir=~/toolbox
    local config="$toolbox_dir/devbox.json"
    local bin_dir=~/.local/bin
    local command="$1"

    if [ "$command" = "init" ]; then
        if [ -f "$config" ]; then
            echo "toolbox already initialized at $config"
            return 0
        fi

        mkdir -p "$toolbox_dir"
        devbox init "$toolbox_dir"
        return
    fi

    [ -f "$config" ] || {
        echo "toolbox not initialized at $config; run: toolbox init" >&2
        return 1
    }

    case "$command" in
        run)
            shift
            (
                local shellenv

                shellenv="$(devbox shellenv --config "$toolbox_dir" --quiet)" || exit 1
                eval "$shellenv"
                exec "$@"
            )
            ;;
        update)
            devbox update --config "$toolbox_dir"
            ;;
        shell)
            devbox shell --config "$toolbox_dir"
            ;;
        add|rm|list)
            if [ "$command" != "list" ]; then
                shift
            fi
            devbox "$command" --config "$toolbox_dir" "$@"
            ;;
        search)
            shift
            devbox search "$@"
            ;;
        links)
            local runner="$DOTFILES_BASE/scripts/toolbox-run"
            local links

            links="$(
                find "$bin_dir" -maxdepth 1 -type l -print 2>/dev/null | while IFS= read -r target; do
                    [ "$(readlink "$target")" = "$runner" ] || continue
                    basename "$target"
                done | sort
            )"

            if [ -n "$links" ]; then
                printf '%s\n' "$links"
            else
                echo "no toolbox links"
            fi
            ;;
        link)
            shift
            mkdir -p "$bin_dir"

            local runner="$DOTFILES_BASE/scripts/toolbox-run"
            [ -x "$runner" ] || {
                echo "toolbox runner not found at $runner" >&2
                return 1
            }

            for tool in "$@"; do
                local target="$bin_dir/$tool"

                ln -sf "$runner" "$target"
                echo "linked $tool -> $target"
            done
            ;;
        unlink)
            shift
            for tool in "$@"; do
                local target="$bin_dir/$tool"

                if [ -e "$target" ] || [ -L "$target" ]; then
                    rm "$target"
                    echo "unlinked $tool"
                else
                    echo "not found: $tool" >&2
                fi
            done
            ;;
        *)
            (
                local shellenv

                shellenv="$(devbox shellenv --config "$toolbox_dir" --quiet)" || exit 1
                eval "$shellenv"
                exec "$@"
            )
            ;;
    esac
}

_toolbox_command_list_for_autocomplete() {
    _arguments '1: :(init run shell add install search list rm update link links unlink)'
}

if command -v compdef >/dev/null 2>&1; then
    compdef _toolbox_command_list_for_autocomplete toolbox
fi
