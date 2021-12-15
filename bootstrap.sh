DOTFILES_BASE=~/dotfiles

# Source files
source_aliases () {
    source $DOTFILES_BASE/aliases/exports.sh
    source $DOTFILES_BASE/aliases/aliases.sh
    source $DOTFILES_BASE/aliases/git.sh
    source $DOTFILES_BASE/aliases/docker.sh
    source $DOTFILES_BASE/aliases/laravel.sh
    source $DOTFILES_BASE/aliases/shortcuts.sh
    source $DOTFILES_BASE/aliases/helpers.sh
    source ~/dotfiles/scripts/bitbucket_pr.sh

    if [[ -f "$DOTFILES_BASE/environment/bash.sh" ]]; then
        source "$DOTFILES_BASE/environment/bash.sh"
    fi

    if [[ "$OSTYPE" == "darwin"* ]]; then
        source $DOTFILES_BASE/aliases/macos.sh
    elif [[ "$OSTYPE" == "linux"* ]]; then
        source $DOTFILES_BASE/aliases/linux.sh
    elif [[ "$OSTYPE" == "msys"* ]]; then
        source $DOTFILES_BASE/aliases/windows.sh
    fi
}

source_aliases

alias reload="exec ${SHELL} -l"

# Script Aliases
alias ip="php '$DOTFILES_BASE/scripts/php/ip.php'"
alias php-download="php '$DOTFILES_BASE/scripts/php/downloader.php'"
alias pr="php '$DOTFILES_BASE/scripts/php/bitbucket-pull-request.php'"

# Psysh
alias p="$DOTFILES_BASE/psysh --color --cwd $(pwd) --config '$DOTFILES_BASE/scripts/php/psysh_user.php'"
psysh-update() {
    echo "Downloading (psysh) ..."
    curl -sS https://psysh.org/psysh > "$DOTFILES_BASE/psysh"
    chmod +x "$DOTFILES_BASE/psysh"
    echo "Ok";
}

alias bb='php /Users/semiherdogan/Projects/bb-cli/bb-cli-php/bin/bb'

_bb_autocomplete() {
    local pipeline_commands="get latest wait"
    local pr_commands="list diff commits approve no-approve request-changes no-request-changes decline merge create"
    local branch_commands="list user name"
    local auth_commands="save show"

    _arguments "1: :(pr pipeline branch auth)" "2: :(help $pipeline_commands $pr_commands $branch_commands $auth_commands)"
}

compdef _bb_autocomplete bb
