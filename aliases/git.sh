##
# Git Aliases
##

alias g='git'
alias nah='git reset --hard && git clean -df'

alias pull='git pull'
alias push='git push'
alias status='git status'
alias fetch='git fetch'
alias stash='git stash --include-untracked'
alias stash-list='git stash list'
alias pop='git stash pop'
alias unstage='git restore --staged'
alias diff='git diff'
alias checkout='git checkout'

alias dev='git checkout dev && git pull'

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
alias branch-merged="php $DOTFILES_BASE/scripts/php/git-merged-branches.php"
alias branch-authors='git for-each-ref --format="%(color:cyan)%(authordate:format:%Y-%m-%d %H:%M)   %(align:23,left)%(color:yellow)%(authorname)%(end) %(color:reset)%(refname:strip=3)" --sort=authordate refs/remotes'
branch-create() {
    git fetch -pq && git checkout -b $2 --no-track origin/$1
}

alias last-commit-diff='git diff HEAD@{1}'

alias yolo-message='curl -s whatthecommit.com/index.txt'

merge() {
    git merge "origin/$1"
}

github-config() {
    git config user.name "Semih ERDOGAN"
    git config user.email "hasansemiherdogan@gmail.com"
}

revert-to() {
    # Reset the index and working tree to the desired tree
    # Ensure you have no uncommitted changes that you want to keep
    git reset --hard $1

    # Move the branch pointer back to the previous HEAD
    git reset --soft HEAD@{1}

    echo "git commit -m 'Revert to $1'"
    echo 'git push -f'
}
