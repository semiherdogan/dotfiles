DOTFILES_BASE=~/dotfiles

# Source files
source_aliases () {
    source $DOTFILES_BASE/aliases/exports.sh
    source $DOTFILES_BASE/aliases/aliases.sh
    source $DOTFILES_BASE/aliases/git.sh
    source $DOTFILES_BASE/aliases/docker.sh
    source $DOTFILES_BASE/aliases/laravel.sh
    # source ~/dotfiles/scripts/bitbucket_pr.sh
    source $DOTFILES_BASE/aliases/ai.sh

    if [[ -f "$DOTFILES_BASE/environment/bash.sh" ]]; then
        source "$DOTFILES_BASE/environment/bash.sh"
    fi

    source $DOTFILES_BASE/aliases/macos.sh
}

source_aliases

# Script Aliases
alias pr="php '$DOTFILES_BASE/scripts/php/bitbucket-pull-request.php'"

# Psysh
alias p="$DOTFILES_BASE/psysh --color --cwd $(pwd)"
