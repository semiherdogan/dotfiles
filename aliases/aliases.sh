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


# Enable aliases to be sudo’ed
alias sudo='sudo '

# Folders
alias www='cd ~/Code ; ll'
alias desk='cd ~/Desktop'

alias ips="ifconfig -a | grep -o 'inet6\? \(addr:\)\?\s\?\(\(\([0-9]\+\.\)\{3\}[0-9]\+\)\|[a-fA-F0-9:]\+\)' | awk '{ sub(/inet6? (addr:)? ?/, \"\"); print }'"
alias curlt='curl -s -o /dev/null -w "%{time_starttransfer}\n"'

loop () {
    for i in {1..$1}
    do
        eval ${@:2}
    done
}

silent() {
    "$@" >& /dev/null
}

port-check() {
    lsof -nP -iTCP:$1 | grep LISTEN
}

# Npm
alias nr='npm run'

# React native
alias rn='npx react-native'
alias rn-metro='./node_modules/react-native/scripts/launchPackager.command; exit'
alias rn-android-bundle='mkdir -p android/app/src/main/assets/ && react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res'
alias rn-ios-bundle='react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle --assets-dest ios'

composer() {
    local COMPOSER_COMMAND="/usr/local/bin/composer"
    if [ -f "composer.phar" ]; then
        COMPOSER_COMMAND="php -d memory_limit=-1 composer.phar"
    fi

    if [ ! -f "docker-compose.yml" ]; then
        eval "$COMPOSER_COMMAND $@"
        return 0
    fi

    if d-compose ps | grep 'Exit' &> /dev/null; then
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
        d-compose exec app ${(Q)${(z)COMPOSER_COMMAND}} "$@"
    fi
}

# Python
alias py-run="py -m"
alias py-server="py -m http.server"
py-env() {
    local ENV_DIRECTORY="venv"
    if [ ! -d "venv/" ]; then
        py -m venv venv
    fi

    # Checks if "deactivate" function is exists
    if [[ $(declare -Ff "deactivate") ]]; then
        deactivate
        echo 'Deactivaed.'
    else
        source venv/Scripts/activate
        echo 'Activated.'
    fi
}
