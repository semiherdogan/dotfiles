#!/usr/bin/env zsh

app="${1:-Kitty}"

if [ "$#" -gt 0 ]; then
	shift
fi

script_dir="$(dirname "$0")"

toggle_app="$script_dir/toggle-app"
if [ ! -x "$toggle_app" ]; then
	toggle_app="$script_dir/toggle-app.swift"
fi

center_window="$script_dir/center-window.swift"

toggle_args=("$app")
toggle_stderr=/dev/null

if [ -n "${OPEN_TERMINAL_DEBUG_LOG:-}" ]; then
	toggle_args=(--debug "$app")
	toggle_stderr="$OPEN_TERMINAL_DEBUG_LOG"
	printf '\n[%s] open-terminal %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$app" >>"$OPEN_TERMINAL_DEBUG_LOG"
fi

if pgrep -if "$app" >/dev/null; then
	toggle_result=$("$toggle_app" "${toggle_args[@]}" 2>>"$toggle_stderr" || printf not-running)

	if [ "$toggle_result" = hidden ] || [ "$toggle_result" = activated ]; then
		exit 0
	fi
fi

if [ "$#" -eq 0 ]; then
	open -a "$app.app"
	"$center_window" "$app"
	exit 0
fi

for f in "$@"; do
	if [ -f "$f" ]; then
		dir=$(cd "$(dirname "$f")" && pwd)
	else
		dir=$(cd "$f" && pwd)
	fi

	open -a "$app.app" --args --working-directory="$dir"
	"$center_window" "$app"
done
