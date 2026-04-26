##
# macOS
##

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_ANALYTICS=1
export CLIPBOARD_HISTORY=1d

export HISTCONTROL="ignoreboth"

alias show-hidden='defaults write com.apple.finder AppleShowAllFiles TRUE ; killall Finder'
alias remove--ds_store="find . -type f -name '*.DS_Store' -ls -delete"

php--check-syntax(){
    find ${1:-.} -iname '*.php' -not -path './vendor/*' -not -path './node_modules/*'\
        -exec php -l '{}' \; \
        | grep '^No syntax errors' -v
}

alias security-allow='xattr -d com.apple.quarantine'

alias pwd-clipboard='pwd && pwd | pbcopy'

alias json-parse="pbpaste | jq -r | jq"
alias json-parse-to-clipboard='json-parse && json-parse | pbcopy'

alias json-beautify="json-parse"
alias json-beautify-to-clipboard='json-parse-to-clipboard'

alias unixtime='echo $(date +%s) && echo -n $(date +%s) | pbcopy && echo "Copied."'

alias shrug="echo '¯\_(ツ)_/¯' && echo '¯\_(ツ)_/¯' | pbcopy";

# App shortcuts
alias st='open -a /Applications/PhpStorm.app "`pwd`"'

alias itab='open -a iterm "`pwd`"'

alias kill-audio='sudo pkill coreaudiod'
alias kill-control-panel='killall -m Control Center'
alias kill-touch-bar='sudo pkill touchbarserver'

alias clipboard-oneline='pbpaste | tr -d "\n" | pbcopy && pbpaste && echo "Copied."'
alias clipboard-base64-encode='pbpaste | base64 | xargs echo | pbcopy && pbpaste && echo "Copied."'
alias base64-decode='pbpaste | base64 --decode'

alias flush-dns='sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder; echo "DNS cache flushed."'

listening() {
    if [ $# -eq 0 ]; then
        sudo lsof -iTCP -sTCP:LISTEN -n -P
    elif [ $# -eq 1 ]; then
        sudo lsof -iTCP -sTCP:LISTEN -n -P | grep -i --color -- "$1"
    else
        echo "Usage: listening [pattern]"
    fi
}

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
        local app_url

        app_url="$(grep '^APP_URL=' .env | awk -F= '{print $2}')"

        if [ -n "$app_url" ]; then
            open "$app_url"
            return
        fi
    fi

    open "http://localhost:80"
}

php-server-here() {
    local local_server_port="${1:-3001}"

    open "http://localhost:$local_server_port" && php -S "127.0.0.1:$local_server_port"
}

python-server-here() {
    local local_server_port="${1:-3002}"

    open "http://localhost:$local_server_port" && python3 -m http.server "$local_server_port"
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

    echo ""
    echo "$GREEN_LINE Done."
}

ip() {
  if [ -n "$1" ]; then
    local domain

    domain=$(printf '%s' "$1" | sed -E 's#^https?://##' | sed -E 's#^www\.##' | cut -d/ -f1 | cut -d: -f1)
    dig +short "$domain" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1
    else
    # Get your own public IP using OpenDNS
    dig +short myip.opendns.com @resolver1.opendns.com
  fi
}
