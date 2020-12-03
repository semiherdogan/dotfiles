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
alias o='open'

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Folders
alias www='cd ~/Code ; ll'
alias desk='cd ~/Desktop'
alias sf='cd ~/.ssh'

alias json-beautify='pbpaste | jq "."'
alias json-beautify-to-clipboard='json-beautify && json-beautify | pbcopy'
alias pwd-clipboard='pwd && pwd | pbcopy'
alias ips="ifconfig -a | grep -o 'inet6\? \(addr:\)\?\s\?\(\(\([0-9]\+\.\)\{3\}[0-9]\+\)\|[a-fA-F0-9:]\+\)' | awk '{ sub(/inet6? (addr:)? ?/, \"\"); print }'"
alias timestamp='echo $(date +%s) && echo $(date +%s) | pbcopy && echo "Copied."'
alias curlt='curl -s -o /dev/null -w "%{time_starttransfer}\n"'

loop () {
    for i in {1..$1}
    do
        eval ${@:2}
    done
}

shush() {
    "$@" >& /dev/null
}

php-server-here() {
    LOCAL_SERVER_PORT=${1:-8000}

    open http://localhost:$LOCAL_SERVER_PORT && php -S 127.0.0.1:$LOCAL_SERVER_PORT
}

alias shrug="echo '¯\_(ツ)_/¯' && echo '¯\_(ツ)_/¯' | pbcopy";

github-open() {
    open `git remote -v | grep fetch | awk '{print $2}' | sed 's/git@/http:\/\//' | sed 's/com:/com\//'` | head -n1
}

# Npm
alias nr='npm run'

# React native
alias rn='npx react-native'
alias rn-metro='./node_modules/react-native/scripts/launchPackager.command; exit'
alias rn-android-bundle='mkdir -p android/app/src/main/assets/ && rn bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res'

# GIT
alias g='git'
alias nah='git reset --hard && git clean -df'

# Docker (d)
alias d-ps='docker ps'
alias d-stop='docker stop $(docker ps -q)'

# Docker Compose (dc)
alias dc='docker-compose'
alias d-composer='dc exec app php -d memory_limit=-1 composer.phar'
alias d-bash='dc exec app bash'
alias d-php='dc exec app php'
alias d-phpunit='dc exec app ./vendor/bin/phpunit'
alias d-artisan='dc exec app php artisan'
alias d-tinker='d-artisan tinker'

dcup() {
    dc up -d
}

# Docker redis
alias d-redis='dc exec cache redis-cli'
alias d-redis-flushall='d-redis flushall'

# Laravel
alias a='php artisan'
alias tinker='a tinker'

laravel--delete-log-files () {
    CURRENT_PATH=$(pwd)
    CURRENT_DATE=$(date '+%Y-%m-%d')

    LOG_FILES_TO_KEEP=(
        laravel.log
        laravel-$CURRENT_DATE.log
    )

    cd storage/logs

    for LOG_FILE in "${LOG_FILES_TO_KEEP[@]}"
    do
        if [[ -f $LOG_FILE ]]; then
            cat /dev/null > $LOG_FILE
        fi
    done

    ls \
    | grep -v laravel.log \
    | grep -v laravel-$CURRENT_DATE.log \
    | xargs rm -f

    cd $CURRENT_PATH
}

alias lr='laravel--delete-log-files && q'
