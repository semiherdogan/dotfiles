##
# macOS
##

alias remove--ds_store="find . -type f -name '*.DS_Store' -ls -delete"

php--check-syntax(){
    find ${1:-.} -iname '*.php' -not -path './vendor/*' -not -path './node_modules/*'\
        -exec php -l '{}' \; \
        | grep '^No syntax errors' -v
}

alias pwd-clipboard='pwd && pwd | cb --copy0'
alias json-beautify='cp --paste0 | jq "."'
alias json-beautify-to-clipboard='json-beautify && json-beautify | cb --copy0'
alias unixtime='echo $(date +%s) && echo -n $(date +%s) | cb --copy0 && echo "Copied."'

alias shrug="echo '¯\_(ツ)_/¯' && echo '¯\_(ツ)_/¯' | cb --copy0";

alias audio-kill='sudo pkill coreaudiod'

alias clipboard-base64-encode='cp --paste0 | base64 | cb --copy0 && cp show0 && echo "Copied."'
alias base64-decode='cp --paste0 | base64 -d'

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
    if [[ -f ./.env ]]; then
        open $(cat .env | grep APP_URL | awk -F= '{print $2}')
    else
        open http://localhost:${1:-80}
    fi
}

github-open() {
    open `
        git remote -v |
        grep fetch |
        awk '{print $2}' |
        sed 's/git@/https:\/\//' |
        sed 's/com:/com\//' |
        sed 's/\.git$//'
    `
}

php-server-here() {
    LOCAL_SERVER_PORT=${1:-3000}
    open http://localhost:$LOCAL_SERVER_PORT && php -S 127.0.0.1:$LOCAL_SERVER_PORT
}

text-diff() {
    echo "Copy first text into clipboard and hit enter!"
    read first
    cb --paste0 > /tmp/cliboard1.txt

    echo "Copy second text into clipboard and hit enter!"
    read second
    cb --paste0 > /tmp/cliboard2.txt

    echo ""
    /usr/bin/diff /tmp/cliboard1.txt /tmp/cliboard2.txt | bat
}

github-search() {
    gh s "$@" | xargs -n1 gh browse -R
}

generate-passwords() {
    for i in $( cb --paste0 ); do 
        pwgen -s -1 ${1:-15} "${@:2}" | sed "s/^/$i /"; 
    done
}
