####
#
# Exports
#
####

export EDITOR='vi'

export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8

export FORCE_HYPERLINK=1

if [ -n "${ZSH_VERSION:-}" ]; then
	WORDCHARS=${WORDCHARS//\//}
	WORDCHARS=${WORDCHARS//./}
	WORDCHARS=${WORDCHARS//-/}

	bindkey -M emacs '^A' beginning-of-line
	bindkey -M emacs '^E' end-of-line
	bindkey -M emacs '^R' history-incremental-search-backward

	bindkey -M viins '^A' beginning-of-line
	bindkey -M viins '^E' end-of-line
	bindkey -M viins '^R' history-incremental-search-backward
fi
