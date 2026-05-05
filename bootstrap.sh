if [ -z "${DOTFILES_BASE:-}" ] || [ ! -d "${DOTFILES_BASE}/aliases" ]; then
    if [ -n "${ZSH_VERSION:-}" ]; then
        DOTFILES_BASE="${${(%):-%x}:A:h}"
    else
        DOTFILES_BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    fi
fi

export DOTFILES_BASE

source_if_exists() {
    [ -f "$1" ] && . "$1"
}

source_core_files() {
    local file

    for file in \
        aliases/exports.sh \
        aliases/aliases.sh \
        aliases/git.sh \
        aliases/docker.sh \
        aliases/laravel.sh \
        aliases/ai.sh \
        aliases/macos.sh
    do
        source_if_exists "$DOTFILES_BASE/$file"
    done
}

source_optional_files() {
    local file

    for file in "$DOTFILES_BASE/work.sh" "$DOTFILES_BASE/local.sh"
    do
        source_if_exists "$file"
    done
}

configure_zsh() {
    [ -n "${ZSH_VERSION:-}" ] || return

    autoload -Uz compinit && compinit
    zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
    zstyle ':completion:*' menu select=2
    zmodload zsh/complist
    bindkey -M menuselect '^[[Z' reverse-menu-complete
    setopt auto_cd
}

configure_zsh
source_core_files
source_optional_files

unset -f configure_zsh
unset -f source_core_files
unset -f source_optional_files
unset -f source_if_exists
