##
#
# Git Aliases
#
##

alias g='git'
alias gs='git status'
alias ss='echo "Current branch: $(git branch --show-current)" && echo "Status: " && git status -s'
alias fetch='git fetch'
alias stash='git stash --include-untracked'
alias stash-list='git stash list'
alias pop='git stash pop'
alias unstage='git restore --staged'

clone() {
    if [ -z "$2" ]; then
        git clone "$1"
        return
    fi

    git clone --branch "$2" "$1"
}

alias dev='git switch dev && git pull'
alias testb='git switch test && git pull'
alias releaseb='git switch release && git pull'
alias main='git switch main && git pull'
alias master='git switch master && git pull'

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
alias branch-name='git symbolic-ref --short HEAD'
alias branch-rename='git branch -m'
alias branch-delete='git branch -D'
alias branch-delete-remote='git push origin --delete'
alias branch-authors='git for-each-ref --format="%(color:cyan)%(authordate:format:%Y-%m-%d %H:%M)   %(align:23,left)%(color:yellow)%(authorname)%(end) %(color:reset)%(refname:strip=3)" --sort=authordate refs/remotes'

branch-create() {
    if [ "$#" -ne 2 ]; then
        echo "Usage: branch-create <remote-branch> <new-branch>"
        return 1
    fi

    git fetch -pq && git checkout -b "$2" --no-track "origin/$1"
}

alias last-commit-diff='git diff HEAD@{1}'

merge-branch() {
    if [ "$#" -ne 1 ]; then
        echo "Usage: merge-branch <branch>"
        return 1
    fi

    git merge "origin/$1"
}

rebase-branch() {
    if [ "$#" -ne 1 ]; then
        echo "Usage: rebase-branch <branch>"
        return 1
    fi

    git rebase "origin/$1"
}
