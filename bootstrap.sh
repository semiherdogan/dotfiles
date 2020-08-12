BASEDIR=~/dotfiles

function source_all() {
    source $BASEDIR/aliases/exports.sh
    source $BASEDIR/aliases/aliases.sh
    source $BASEDIR/aliases/shortcuts.sh

    if [[ -f "$BASEDIR/aliases/environment.sh" ]]; then
        source $BASEDIR/aliases/environment.sh
    fi
}

source_all

# Vimrc
rm -f ~/.vimrc
ln -s $BASEDIR/.vimrc ~/.vimrc

# Script Aliases
alias download="php '$BASEDIR/scripts/downloader.php'"
alias pull-request="php '$BASEDIR/scripts/bitbucket-pull-request.php'"

# Psysh
if [[ ! -f "./psysh" ]]; then
    download https://psysh.org/psysh
    chmod +x psysh

    alias p="$BASEDIR/psysh --color --config '$BASEDIR/scripts/psysh_user.php'"
fi

# Zsh .hushlogin
if [[ ! -f "~/.hushlogin" ]]; then
    echo '' > ~/.hushlogin
fi
