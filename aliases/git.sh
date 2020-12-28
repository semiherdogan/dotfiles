##
# Git Aliases
##

alias g='git'
alias nah='git reset --hard && git clean -df'

commit() {
    commitMessage="$1"

    if [ "$commitMessage" = "" ]; then
        commitMessage='wip'
    fi

    git add .
    eval "git commit -a -m '${commitMessage}'"
}

alias pull='git pull'
alias push='git push'
alias status='git status'

alias branch-authors='git for-each-ref --format="%(color:cyan)%(authordate:format:%Y-%m-%d %H:%M)   %(align:23,left)%(color:yellow)%(authorname)%(end) %(color:reset)%(refname:strip=3)" --sort=authordate refs/remotes'
branch-create() {
    git fetch -pq && git checkout -b $2 --no-track origin/$1
}

alias last-commit-diff='git diff HEAD@{1}'

alias yolo-message='curl -s whatthecommit.com/index.txt'
