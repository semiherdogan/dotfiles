##
#
# Git Aliases
#
##

alias g='git'
alias gs='git status'
alias nah='git reset --hard && git clean -df'
alias pull='git pull'
alias push='git push'
alias status='git status'
alias ss='echo "Current branch: $(git branch --show-current)" && echo "Status: " && git status -s'
alias fetch='git fetch'
alias stash='git stash --include-untracked'
alias stash-list='git stash list'
alias pop='git stash pop'
alias unstage='git restore --staged'
alias diff='git diff'
alias checkout='git checkout'
alias switch='git switch'
alias restore='git restore'
alias revert-file-to-previous='git checkout HEAD^'
alias amend='git commit --amend'
alias undo-commit='git reset HEAD~ '

clone() {
    if [[ "$2" == "" ]]; then
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

add() {
    git add ${@:-.}
}

alias wip='commit .'
commit() {
    if [[ "$1" == "." ]]; then
        shift 1

        git add .
    fi

    commitMessage="$1"

    if [ "$commitMessage" = "" ]; then
        commitMessage='wip'
    fi

    eval "git commit -m '${commitMessage}'"
}

alias branch='git -P branch'
alias branchs='git -P branch -a'
alias branch-name='git symbolic-ref --short HEAD'
alias branch-rename='git branch -m'
alias branch-delete='git branch -D'
alias branch-delete-remote='git push origin --delete'
alias branch-authors='git for-each-ref --format="%(color:cyan)%(authordate:format:%Y-%m-%d %H:%M)   %(align:23,left)%(color:yellow)%(authorname)%(end) %(color:reset)%(refname:strip=3)" --sort=authordate refs/remotes'

branch-create() {
    git fetch -pq && git checkout -b $2 --no-track origin/$1
}

alias last-commit-diff='git diff HEAD@{1}'

merge() {
    git merge "origin/$1"
}

rebase() {
    git rebase "origin/$1"
}

revert-to-hash() {
    # Reset the index and working tree to the desired tree
    # Ensure you have no uncommitted changes that you want to keep
    git reset --hard $1

    # Move the branch pointer back to the previous HEAD
    git reset --soft HEAD@{1}

    echo "git commit -m 'Revert to $1'"
    echo 'git push -f'
}
