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

epoch2date(){
	local epoch="${1:-$(pbpaste)}"
	echo $epoch
	node -p "new Date(('$epoch'.replace('.', '')+'00000').slice(0, 13) * 1).toISOString().replace('T', ' ').replace(/\..+/, '')"
}

# Python
alias py-run="py -m"
alias py-server="py -m http.server"

py() {
    # Check if we're in a uv project with pyproject.toml
    if [[ -f "pyproject.toml" ]]; then
        # Use uv run for automatic dependency and environment management
        uv run python "$@"
    elif [[ -d "$PIPENV_CUSTOM_VENV_NAME" && "$(which python3)" == "$(pwd)/$PIPENV_CUSTOM_VENV_NAME/bin/python3" ]]; then
        # Use custom venv if it's activated
        "$(pwd)/$PIPENV_CUSTOM_VENV_NAME/bin/python3" "$@"
    else
        # Fallback to system python
        python3 "$@"
    fi
}

py-env() {
    local default_version=$(python3 -V | sed -e 's/Python //')
    local python_version=${1:-$default_version}

    # Initialize uv project if pyproject.toml doesn't exist
    if [[ ! -f "pyproject.toml" ]]; then
        echo "Initializing uv project..."
        uv init && echo "Project initialized."
    fi

    # Create virtual environment if it doesn't exist
    if [[ ! -d "$PIPENV_CUSTOM_VENV_NAME/" ]]; then
        echo "Creating virtual environment..."
        uv venv --python "$python_version"
        if [[ $? -eq 0 ]]; then
            echo "Virtual environment created: $PIPENV_CUSTOM_VENV_NAME"
        else
            echo "Failed to create virtual environment"
            return 1
        fi
    fi

    # Deactivate if already activated
    if declare -Ff "deactivate" >/dev/null; then
        deactivate
        echo "Previous environment deactivated."
    fi

    # Activate environment
    local activation_script=""
    if [[ -f "$PIPENV_CUSTOM_VENV_NAME/bin/activate" ]]; then
        activation_script="$PIPENV_CUSTOM_VENV_NAME/bin/activate"
    elif [[ -f "$PIPENV_CUSTOM_VENV_NAME/Scripts/activate" ]]; then
        activation_script="$PIPENV_CUSTOM_VENV_NAME/Scripts/activate"
    fi

    if [[ -n "$activation_script" ]]; then
        source "$activation_script"
        echo "Environment activated: $(basename "$activation_script" | dirname)"
    else
        echo "Error: Could not find activation script"
        return 1
    fi
}

alias composer-here-latest='curl -sS https://getcomposer.org/installer | php'
alias composer-here-1='wget https://github.com/composer/composer/releases/download/1.10.26/composer.phar'

alias yolo-message='curl -sS https://whatthecommit.com/index.txt'

alias reload="exec ${SHELL} -l"

alias truncate-zed-threads="sqlite3 ~/Library/Application\ Support/Zed/threads/threads.db 'DELETE FROM threads;'"
