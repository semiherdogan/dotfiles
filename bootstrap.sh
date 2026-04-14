dotfiles_bootstrap_dir() {
    if [ -n "${BASH_SOURCE[0]:-}" ]; then
        dirname "${BASH_SOURCE[0]}"
        return
    fi

    if [ -n "${ZSH_VERSION:-}" ]; then
        dirname "${(%):-%N}"
        return
    fi

    pwd
}

DOTFILES_BASE="${DOTFILES_BASE:-$(cd "$(dotfiles_bootstrap_dir)" && pwd)}"
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

source_core_files
source_optional_files

# alias pr="php '$DOTFILES_BASE/scripts/php/bitbucket-pull-request.php'"
