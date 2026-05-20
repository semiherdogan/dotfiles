#!/usr/bin/env zsh

app="$1"

if [ -z "$app" ]; then
	printf 'Usage: %s <app-name> <path>...\n' "$0" >&2
	exit 2
fi

shift

for f in "$@"; do
	if [ "$app" = Ghostty ]; then
		if [ -f "$f" ]; then
			dir=$(cd "$(dirname "$f")" && pwd)
		else
			dir=$(cd "$f" && pwd)
		fi

		open -a "$app.app" --args --working-directory="$dir"
		# sleep 0.1
		"$(dirname "$0")/center-window.swift" "$app"
	else
		open -a "$app" "$f"
	fi
done
