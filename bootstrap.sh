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

# Script Aliases
alias ip="php '$DOTFILES_BASE/scripts/php/ip.php'"
alias pr="php '$DOTFILES_BASE/scripts/php/bitbucket-pull-request.php'"

# Psysh
alias p="$DOTFILES_BASE/psysh --color --cwd $(pwd) --config '$DOTFILES_BASE/scripts/php/psysh_user.php'"
psysh-update() {
    local download_path="$DOTFILES_BASE/psysh"
    curl -o "$download_path" https://psysh.org/psysh
    chmod +x "$download_path"
    echo "Ok";
    p
}

_bb_autocomplete() {
    local pipeline_commands="get latest wait run"
    local pr_commands="list diff commits approve no-approve request-changes no-request-changes decline merge create"
    local branch_commands="list user name"
    local auth_commands="save show"

    _arguments "1: :(pr pipeline branch auth browse upgrade)" "2: :(help $pipeline_commands $pr_commands $branch_commands $auth_commands)"
}

compdef _bb_autocomplete bb
