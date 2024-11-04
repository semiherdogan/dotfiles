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
alias control-panel-kill='killall -m Control Center'

alias clipboard-base64-encode='pbpaste | base64 | xargs echo | pbcopy && pbpaste && echo "Copied."'
alias base64-decode='pbpaste | base64 --decode'

alias flush-dns='sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder'

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

php-server-here() {
    LOCAL_SERVER_PORT=${1:-3001}
    open http://localhost:$LOCAL_SERVER_PORT && php -S 127.0.0.1:$LOCAL_SERVER_PORT
}

python-server-here() {
    LOCAL_SERVER_PORT=${1:-3002}
    open http://localhost:$LOCAL_SERVER_PORT && python3 -m http.server $LOCAL_SERVER_PORT
}

generate-passwords() {
    for i in $( pbpaste ); do
        pwgen -s -1 ${1:-15} "${@:2}" | sed "s/^/$i /";
    done
}

x64() {
    arch -x86_64 $@
}

extract-links-from-har-file() {
    pbpaste | jq -r '.log.entries|.[].request.url'
}

brew-update() {
    local GREEN_LINE="\e[32m------------------------------\e[0m"
    local RED_LINE="\e[31m------------------------------\e[0m"

    echo "$GREEN_LINE Brew Update"
    brew update

    echo "$GREEN_LINE Brew Outdated"
    brew outdated

    echo ""
    echo "Upgrade? (y/N):"
    read -t5 -k1 -s
    [[ $REPLY != "y" ]] && { echo "$RED_LINE Aborted."; return; }
    echo ""

    echo "$GREEN_LINE Brew Upgrade"
    brew upgrade

    echo "$GREEN_LINE Brew Cleanup"
    brew cleanup

    echo ""

    [[ -f $HOME/.bun/bin/bun ]] && {
        echo "$GREEN_LINE Bun Upgrade"
        $HOME/.bun/bin/bun upgrade --stable
    }

    [[ -f $DOTFILES_BASE/psysh ]] && {
        echo "$GREEN_LINE PsySH Upgrade"

        local download_path="$DOTFILES_BASE/psysh"
        curl -s -o "$download_path" https://psysh.org/psysh
        chmod +x "$download_path"
        echo "Ok."
    }

    [[ -f $HOME/v/v ]] && {
        echo "$GREEN_LINE V Up"
        $HOME/v/v up
    }

    echo ""
    echo "$DIVISION Done."
}
