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
alias curlt='curl -sS -o /dev/null -w "%{time_starttransfer}\n"'

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

# React native
alias rn='npx react-native'
alias rn-metro='./node_modules/react-native/scripts/launchPackager.command; exit'
alias rn-android-bundle='mkdir -p android/app/src/main/assets/ && react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res'
alias rn-ios-bundle='react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle --assets-dest ios'

# Python
alias py-run="python3 -m"
alias py-server="python3 -m http.server"

py() {
    if [[ "$(which python3)" == "$(pwd)/venv/bin/python3" ]]; then
        echo "venv active"
        $(pwd)/venv/bin/python3 $@
    else
        echo "no venv"
        /usr/bin/python3 $@
    fi
}

py-env() {
    local ENV_DIRECTORY="venv"
    if [ ! -d "$ENV_DIRECTORY/" ]; then
        python3 -m venv $ENV_DIRECTORY
    fi

    # Checks if "deactivate" function is exists
    if [[ $(declare -Ff "deactivate") ]]; then
        deactivate
        echo 'Deactivaed.'
    else
        if test -f "venv/Scripts/activate"; then
            source venv/Scripts/activate
            echo 'Activated. (venv/Scripts/activate)'
        elif test -f "venv/bin/activate"; then
            source venv/bin/activate
            echo 'Activated. (venv/bin/activate)'
        fi
    fi
}

alias composer-here='curl -sS https://getcomposer.org/installer | php'

alias yolo-message='curl -sS whatthecommit.com/index.txt'

alias reload="exec ${SHELL} -l"
alias localip="ipconfig getifaddr en0"
