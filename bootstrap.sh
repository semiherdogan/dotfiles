DOTFILES_BASE=~/dotfiles

# Source files
source_aliases () {
    source $DOTFILES_BASE/aliases/exports.sh
    source $DOTFILES_BASE/aliases/aliases.sh
    source $DOTFILES_BASE/aliases/git.sh
    source $DOTFILES_BASE/aliases/docker.sh
    source $DOTFILES_BASE/aliases/laravel.sh
    # source ~/dotfiles/scripts/bitbucket_pr.sh

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
alias pr="php '$DOTFILES_BASE/scripts/php/bitbucket-pull-request.php'"

# Psysh
alias p="$DOTFILES_BASE/psysh --color --cwd $(pwd)"

_bb_autocomplete() {
    _arguments "1: :(help $(bb autocomplete))" "2: :(help $(bb $words[2] autocomplete))"
}

compdef _bb_autocomplete bb
