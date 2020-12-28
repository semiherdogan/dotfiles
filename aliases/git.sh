# GIT
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
