DOTFILES_BASE=~/dotfiles

# Source files
source $DOTFILES_BASE/aliases/exports.sh
source $DOTFILES_BASE/aliases/aliases.sh
source $DOTFILES_BASE/aliases/shortcuts.sh
source $DOTFILES_BASE/aliases/helpers.sh
if [[ -f "$DOTFILES_BASE/aliases/environment.sh" ]]; then
    source $DOTFILES_BASE/aliases/environment.sh
fi

# Script Aliases
alias ip="php '$DOTFILES_BASE/scripts/php/ip.php'"
alias download="php '$DOTFILES_BASE/scripts/php/downloader.php'"
alias pull-request="php '$DOTFILES_BASE/scripts/php/bitbucket-pull-request.php'"
alias git--merged-branches="php $DOTFILES_BASE/scripts/php/git-merged-branches.php"

# Psysh
alias p="$DOTFILES_BASE/psysh --color --config '$DOTFILES_BASE/scripts/php/psysh_user.php'"
if [[ ! -f "$DOTFILES_BASE/psysh" ]]; then
    echo "Downloading (psysh) ..."
    download https://psysh.org/psysh $DOTFILES_BASE
    chmod +x $DOTFILES_BASE/psysh
fi

# Zsh .hushlogin
if [[ ! -f "~/.hushlogin" ]]; then
    echo '' > ~/.hushlogin
fi
