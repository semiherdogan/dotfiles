#!/usr/bin/env zsh

app="$1"

if [ -z "$app" ]; then
	printf 'Usage: %s <app-name> <path>...\n' "$0" >&2
	exit 2
fi

shift

case "${app:l}" in
	kitty|ghostty)
		"$(dirname "$0")/open-terminal.sh" "$app" "$@"
		exit $?
		;;
esac

for f in "$@"; do
	open -a "$app" "$f"
done
