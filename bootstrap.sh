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
alias download="php '$DOTFILES_BASE/scripts/php/downloader.php'"
alias pr="php '$DOTFILES_BASE/scripts/php/bitbucket-pull-request.php'"

# Psysh
alias p="$DOTFILES_BASE/psysh --color --config '$DOTFILES_BASE/scripts/php/psysh_user.php'"
psysh-update() {
    echo "Downloading (psysh) ..."
    curl -s -o  "$DOTFILES_BASE/psysh" https://psysh.org/psysh
    chmod +x $DOTFILES_BASE/psysh
}

alias bb='php /Users/semiherdogan/Projects/bitbucket-pr/bin/bb'
