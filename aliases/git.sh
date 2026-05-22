##
#
# Git Helpers
#
##

alias g='git'

alias push='g push'
alias pull='g pull'
alias diff='g diff'

gpull() {
	local stash_msg="gpull-wip-$(date +%s)"
	local stashed=0

	if [ -n "$(git status --porcelain)" ]; then
		git stash push -u -m "$stash_msg" || return 1
		stashed=1
	fi

	git pull "$@" || {
		[ "$stashed" -eq 1 ] && echo "pull failed; changes are in stash: $stash_msg" >&2
		return 1
	}

	if [ "$stashed" -eq 1 ]; then
		git stash pop --index || {
			echo "stash pop failed; resolve manually, stash kept: $stash_msg" >&2
			return 1
		}
	fi
}

alias ss='echo "Current branch: $(git branch --show-current)" && echo "Status: " && git status -s'

alias dev='git switch dev && git pull'

alias stage='git switch stage && git pull'
alias stg='stage'

nah() {
	echo "This will discard tracked changes and delete untracked files."
	read -r "?Continue? [y/N] " reply
	[ "$reply" = "y" ] || return 1

	git reset --hard && git clean -df
}

add() {
	if [ "$#" -eq 0 ]; then
		git add .
		return
	fi

	git add "$@"
}

alias wip='commit .'
commit() {
	if [ "$1" = "." ]; then
		shift 1

		git add .
	fi

	local commit_message="${*:-wip}"

	if [ -z "$commit_message" ]; then
		commit_message='wip'
	fi

	git commit -m "$commit_message"
}

alias branch='git -P branch'
alias branchs='git -P branch -a'
alias branch-delete='git branch -D'
alias branch-delete-remote='git push origin --delete'

branch-set-upstream() {
	local branch
	branch="$(git branch --show-current)" || return 1

	if [ -z "$branch" ]; then
		echo "Not on a branch." >&2
		return 1
	fi

	git branch --set-upstream-to="origin/$branch" "$branch"
}

branch-create() {
	if [ "$#" -ne 2 ]; then
		echo "Usage: branch-create <remote-branch> <new-branch>"
		return 1
	fi

	git fetch -pq && git checkout -b "$2" --no-track "origin/$1"
}

release-tag() {
	if [ "$#" -ne 1 ]; then
		echo "Usage: release-tag <tag>"
		return 1
	fi

	git tag "$1" && git push origin "$1"
}
