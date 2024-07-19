##
# macOS
##

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_ANALYTICS=1

alias remove--ds_store="find . -type f -name '*.DS_Store' -ls -delete"

php--check-syntax(){
    find ${1:-.} -iname '*.php' -not -path './vendor/*' -not -path './node_modules/*'\
        -exec php -l '{}' \; \
        | grep '^No syntax errors' -v
}

alias pwd-clipboard='pwd && pwd | pbcopy'
alias json-beautify='pbpaste | jq "."'
alias json-beautify-to-clipboard='json-beautify && json-beautify | pbcopy'
alias unixtime='echo $(date +%s) && echo -n $(date +%s) | pbcopy && echo "Copied."'

alias shrug="echo '¯\_(ツ)_/¯' && echo '¯\_(ツ)_/¯' | pbcopy";

# App shortcuts
alias st='open -a /Applications/PhpStorm.app "`pwd`"'
alias rr='open -a /Applications/RustRover.app "`pwd`"'
alias gl='open -a /Applications/GoLand.app "`pwd`"'

alias itab='open -a iterm "`pwd`"'

alias audio-kill='sudo pkill coreaudiod'

alias clipboard-base64-encode='pbpaste | base64 |xargs echo | pbcopy && pbpaste && echo "Copied."'
alias base64-decode='pbpaste | base64 --decode'

o() {
    if [ $# -eq 0 ]; then
        open .
    else
        open "$@"
    fi;
}

lo() {
    if [ $# -gt 0 ]; then
        open "http://localhost:$1"
        return
    fi;

    if [[ -f ./.env ]]; then
        open $(cat .env | grep APP_URL | awk -F= '{print $2}')
    else
        open "http://localhost:80"
    fi
}

github-open() {
    # open `
    #     git remote -v |
    #     grep fetch |
    #     awk '{print $2}' |
    #     sed 's/git@/https:\/\//' |
    #     sed 's/com:/com\//' |
    #     sed 's/\.git$//'
    # `
    gh browse
}

php-server-here() {
    LOCAL_SERVER_PORT=${1:-3001}
    open http://localhost:$LOCAL_SERVER_PORT && php -S 127.0.0.1:$LOCAL_SERVER_PORT
}

python-server-here() {
    LOCAL_SERVER_PORT=${1:-3002}
    open http://localhost:$LOCAL_SERVER_PORT && python3 -m http.server $LOCAL_SERVER_PORT
}

text-diff() {
    echo "Copy first text into clipboard and hit enter!"
    read first
    pbpaste > /tmp/cliboard1.txt

    echo "Copy second text into clipboard and hit enter!"
    read second
    pbpaste > /tmp/cliboard2.txt

    echo ""
    /usr/bin/diff /tmp/cliboard1.txt /tmp/cliboard2.txt | bat

    rm /tmp/cliboard1.txt /tmp/cliboard2.txt
}

generate-passwords() {
    for i in $( pbpaste ); do
        pwgen -s -1 ${1:-15} "${@:2}" | sed "s/^/$i /";
    done
}

use-x64() {
    arch -x86_64 "$@"
}

links-from-har-file() {
    pbpaste | jq -r '.log.entries|.[].request.url'
}

brew-update() {
    brew update
    echo "Outdated:"
    brew outdated

    echo "Upgrade? (y/N):"
    read selection

    if [[ $selection == "y" ]]; then
        brew upgrade
    fi
}