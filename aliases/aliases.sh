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
alias o="open"

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
alias restart--touchbar="killall ControlStrip"
alias php-server-here='open http://localhost:8000 && php -S 127.0.0.1:8000'

alias shrug="echo '¯\_(ツ)_/¯' && echo '¯\_(ツ)_/¯' | pbcopy";
alias fight="echo '(ง'̀-'́)ง'";

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

function dcup() {
    dc up -d

    if test -f "./docker-sync.yml"; then
        echo "Docker-sync file exist, starting..."
        docker-sync start
        docker-sync sync
    fi
}

# Docker redis
alias d-redis='dc exec cache redis-cli'
alias d-redis-flushall='d-redis flushall'

# Laravel
alias a='php artisan'
alias tinker='a tinker'
alias laravel--delete-log-files='cd storage/logs && rm -f *'
alias lr='laravel--delete-log-files && q'
