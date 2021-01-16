##
# Git Aliases
##

alias g='git'
alias nah='git reset --hard && git clean -df'

alias pull='git pull'
alias push='git push'
alias status='git status'
alias fetch='git fetch'
alias checkout='git checkout'
alias stash='git stash --include-untracked'
alias stash-list='git stash list'
alias pop='git stash pop'
alias unstage='git restore --staged'
alias diff='git diff'

add() {
    git add ${@:-.}
}

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

alias branch-name='git symbolic-ref --short HEAD'
alias branch-rename='git branch -m'
alias branch-merged="php $DOTFILES_BASE/scripts/php/git-merged-branches.php"
alias branch-authors='git for-each-ref --format="%(color:cyan)%(authordate:format:%Y-%m-%d %H:%M)   %(align:23,left)%(color:yellow)%(authorname)%(end) %(color:reset)%(refname:strip=3)" --sort=authordate refs/remotes'
branch-create() {
    git fetch -pq && git checkout -b $2 --no-track origin/$1
}

alias last-commit-diff='git diff HEAD@{1}'

alias yolo-message='curl -s whatthecommit.com/index.txt'

github-config() {
    git config user.name "Semih ERDOGAN"
    git config user.email "hasansemiherdogan@gmail.com"
}
