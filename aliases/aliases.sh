####
#
# Bash Aliases
#
####

# General
alias q='exit 0'
alias ..='cd ../'
alias ll='ls -lah'

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Folders
alias www='cd ~/Code ; ll'
alias desk='cd ~/Desktop'
alias k='cd ~/Desktop'

alias ips="ifconfig -a | grep -o 'inet6\? \(addr:\)\?\s\?\(\(\([0-9]\+\.\)\{3\}[0-9]\+\)\|[a-fA-F0-9:]\+\)' | awk '{ sub(/inet6? (addr:)? ?/, \"\"); print }'"
alias curlt='curl -sS -o /dev/null -w "%{time_starttransfer}\n"'

loop () {
    for i in {1..$1}
    do
        eval ${@:2}
    done
}

# Python
alias py-run="py -m"
alias py-server="py -m http.server"

py() {
    local python_path="/opt/homebrew/bin/python3"
    [[ "$(which python3)" == "$(pwd)/$PIPENV_CUSTOM_VENV_NAME/bin/python3" ]] && python_path="$(pwd)/$PIPENV_CUSTOM_VENV_NAME/bin/python3"
    $python_path "$@"
}

py-env() {
    local default_version=$(python3 -V | sed -e 's/Python //')
    # Create environment if it doesn't exist
    [ ! -d "$PIPENV_CUSTOM_VENV_NAME/" ] && echo "Creating environment.." && pipenv --python ${1:-$default_version} && echo "Created. ($PIPENV_CUSTOM_VENV_NAME)"

    # Deactivate if already activated
    declare -Ff "deactivate" >/dev/null && deactivate && echo 'Deactivated.'

    # Activate environment
    local activation_script=""
    [[ -f "$PIPENV_CUSTOM_VENV_NAME/Scripts/activate" ]] && activation_script="$PIPENV_CUSTOM_VENV_NAME/Scripts/activate"
    [[ -f "$PIPENV_CUSTOM_VENV_NAME/bin/activate" ]] && activation_script="$PIPENV_CUSTOM_VENV_NAME/bin/activate"
    [[ -n $activation_script ]] && source "$activation_script" && echo "Activated. ($activation_script)"
}

alias composer-here-latest='curl -sS https://getcomposer.org/installer | php'
alias composer-here-1='wget https://github.com/composer/composer/releases/download/1.10.26/composer.phar'

alias yolo-message='curl -sS https://whatthecommit.com/index.txt'

alias reload="exec ${SHELL} -l"

copilot() {
    if [ -z "$1" ]; then
        echo "Please provide a message."
        return 1
    fi

    gh copilot explain "$@"
}
