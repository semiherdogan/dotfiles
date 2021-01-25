####
#
# Bash Aliases
#
####

# General
alias q='exit 0'
alias ..='cd ../'
alias ...='cd ../../'
alias ....='cd ../../../'
alias ll='ls -lah'
o() {
    if [ $# -eq 0 ]; then
        open .
    else
        open "$@"
    fi;
}

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Folders
alias www='cd ~/Code ; ll'
alias www2='cd ~/CodeSmh ; ll'
alias desk='cd ~/Desktop'
alias sf='cd ~/.ssh'

alias json-beautify='pbpaste | jq "."'
alias json-beautify-to-clipboard='json-beautify && json-beautify | pbcopy'
alias pwd-clipboard='pwd && pwd | pbcopy'
alias ips="ifconfig -a | grep -o 'inet6\? \(addr:\)\?\s\?\(\(\([0-9]\+\.\)\{3\}[0-9]\+\)\|[a-fA-F0-9:]\+\)' | awk '{ sub(/inet6? (addr:)? ?/, \"\"); print }'"
alias timestamp='echo $(date +%s) && echo $(date +%s) | pbcopy && echo "Copied."'
alias curlt='curl -s -o /dev/null -w "%{time_starttransfer}\n"'
alias remove--ds_store="find . -type f -name '*.DS_Store' -ls -delete"

desktop-icons-toggle() {
    local SHOW_ICONS=true

    if [[ $(defaults read com.apple.finder CreateDesktop) == "1" ]]; then
        SHOW_ICONS=false
    fi

    defaults write com.apple.finder CreateDesktop -bool $SHOW_ICONS && killall Finder
}

loop () {
    for i in {1..$1}
    do
        eval ${@:2}
    done
}

silent() {
    "$@" >& /dev/null
}

php-server-here() {
    LOCAL_SERVER_PORT=${1:-3000}
    open http://localhost:$LOCAL_SERVER_PORT && php -S 127.0.0.1:$LOCAL_SERVER_PORT
}

open-local() {
    open http://localhost:${1:-80}
}

alias shrug="echo '¯\_(ツ)_/¯' && echo '¯\_(ツ)_/¯' | pbcopy";

github-open() {
    open -a /Applications/Firefox.app `
        git remote -v |
        grep fetch |
        awk '{print $2}' |
        sed 's/git@/https:\/\//' |
        sed 's/com:/com\//' |
        sed 's/\.git//'
    `
}

port-check() {
    lsof -nP -iTCP:$1 | grep LISTEN
}

# Npm
alias nr='npm run'

# React native
alias rn='npx react-native'
alias rn-metro='./node_modules/react-native/scripts/launchPackager.command; exit'
alias rn-android-bundle='mkdir -p android/app/src/main/assets/ && rn bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res'

# Docker (d)
alias d-ps='docker ps'
alias d-stop='docker stop $(docker ps -q)'

# Docker Compose (dc)
alias dc='docker-compose'
alias d-composer='docker-compose exec app php -d memory_limit=-1 composer.phar'
alias d-bash='docker-compose exec app bash'
alias d-php='docker-compose exec app php'
alias d-phpunit='docker-compose exec app ./vendor/bin/phpunit'
alias dcup='docker-compose up -d'

# Docker redis
alias d-redis='docker-compose exec cache redis-cli'
alias d-redis-flushall='docker-compose exec cache redis-cli flushall'

# Composer
alias php71-composer='docker run --rm --volume $(pwd):/app prooph/composer:7.1'
alias php72-composer='docker run --rm --volume $(pwd):/app prooph/composer:7.2'
alias php73-composer='docker run --rm --volume $(pwd):/app prooph/composer:7.3'
alias php74-composer='docker run --rm --volume $(pwd):/opt -w /opt laravelsail/php74-composer:latest composer'
alias php80-composer='docker run --rm --volume $(pwd):/opt -w /opt laravelsail/php80-composer:latest composer'

composer() {
    local COMPOSER_COMMAND="/usr/local/bin/composer"
    if [ -f "composer.phar" ]; then
        COMPOSER_COMMAND="php -d memory_limit=-1 composer.phar"
    fi

    if [ ! -f "docker-compose.yml" ]; then
        eval "$COMPOSER_COMMAND $@"
        return 0
    fi

    if docker-compose ps | grep 'Exit' &> /dev/null; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            eval "$COMPOSER_COMMAND $@"
            return 0
        fi

        return 1
    fi

    if [ ! -n "$(docker-compose ps -q)" ]; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            eval "$COMPOSER_COMMAND $@"
            return 0
        fi

        return 1
    fi

    if [[ -f "vendor/bin/sail" ]]; then
        ./vendor/bin/sail composer "$@"
    else
        docker-compose exec app ${(Q)${(z)COMPOSER_COMMAND}} "$@"
    fi
}
