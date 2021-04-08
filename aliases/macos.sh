##
# macOS
##

alias remove--ds_store="find . -type f -name '*.DS_Store' -ls -delete"

alias pwd-clipboard='pwd && pwd | pbcopy'
alias json-beautify='pbpaste | jq "."'
alias json-beautify-to-clipboard='json-beautify && json-beautify | pbcopy'
alias timestamp='echo $(date +%s) && echo -n $(date +%s) | pbcopy && echo "Copied."'

alias shrug="echo '¯\_(ツ)_/¯' && echo '¯\_(ツ)_/¯' | pbcopy";

o() {
    if [ $# -eq 0 ]; then
        open .
    else
        open "$@"
    fi;
}

desktop-icons-toggle() {
    local SHOW_ICONS=true

    if [[ $(defaults read com.apple.finder CreateDesktop) == "1" ]]; then
        SHOW_ICONS=false
    fi

    defaults write com.apple.finder CreateDesktop -bool $SHOW_ICONS && killall Finder
}

open-local() {
    open http://localhost:${1:-80}
}

github-open() {
    open `
        git remote -v |
        grep fetch |
        awk '{print $2}' |
        sed 's/git@/https:\/\//' |
        sed 's/com:/com\//' |
        sed 's/\.git//'
    `
}

php-server-here() {
    LOCAL_SERVER_PORT=${1:-3000}
    open http://localhost:$LOCAL_SERVER_PORT && php -S 127.0.0.1:$LOCAL_SERVER_PORT
}

# Zsh .hushlogin
# if [[ ! -f "~/.hushlogin" ]]; then
#     echo '' > ~/.hushlogin
# fi
