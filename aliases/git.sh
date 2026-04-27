##
#
# Git Helpers
#
##

alias g='git'

alias push='g push'
alias pull='g pull'
alias diff='g diff'

alias ss='echo "Current branch: $(git branch --show-current)" && echo "Status: " && git status -s'

alias dev='git switch dev && git pull'

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

branch-create() {
    if [ "$#" -ne 2 ]; then
        echo "Usage: branch-create <remote-branch> <new-branch>"
        return 1
    fi

    git fetch -pq && git checkout -b "$2" --no-track "origin/$1"
}
