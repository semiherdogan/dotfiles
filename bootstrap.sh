DOTFILES_BASE=~/dotfiles

function source_all() {
    source $DOTFILES_BASE/aliases/exports.sh
    source $DOTFILES_BASE/aliases/aliases.sh
    source $DOTFILES_BASE/aliases/shortcuts.sh

    if [[ -f "$DOTFILES_BASE/aliases/environment.sh" ]]; then
        source $DOTFILES_BASE/aliases/environment.sh
    fi
}

source_all

# Vimrc
rm -f ~/.vimrc
ln -s $DOTFILES_BASE/.vimrc ~/.vimrc

# Script Aliases
alias download="php '$DOTFILES_BASE/scripts/downloader.php'"
alias pull-request="php '$DOTFILES_BASE/scripts/bitbucket-pull-request.php'"

# Psysh
alias p="$DOTFILES_BASE/psysh --color --config '$DOTFILES_BASE/scripts/psysh_user.php'"
if [[ ! -f "$DOTFILES_BASE/psysh" ]]; then
    echo "Downloading (psysh) ..."
    download https://psysh.org/psysh $DOTFILES_BASE
    chmod +x $DOTFILES_BASE/psysh
fi

# Zsh .hushlogin
if [[ ! -f "~/.hushlogin" ]]; then
    echo '' > ~/.hushlogin
fi
