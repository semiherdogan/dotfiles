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

# Terminal prompt

autoload -Uz vcs_info

zstyle ':vcs_info:*' enable git
# %b is the branch name inside vcs_info formats, so bold is not toggled here
zstyle ':vcs_info:git:*' formats ' %F{blue}git:(%F{red}%b%F{blue})%f%c%u'
zstyle ':vcs_info:git:*' actionformats ' %F{blue}git:(%F{red}%b%F{blue}|%F{red}%a%F{blue})%f%c%u'
zstyle ':vcs_info:git:*' stagedstr ' %F{yellow}✗%f'
zstyle ':vcs_info:git:*' unstagedstr ' %F{yellow}✗%f'
zstyle ':vcs_info:git:*' check-for-changes true

# keep a single dirty marker when both staged and unstaged changes exist
zstyle ':vcs_info:git*+set-message:*' hooks single-dirty
+vi-single-dirty() { [[ -n ${hook_com[staged]} ]] && hook_com[unstaged]='' }

precmd() { vcs_info }

setopt PROMPT_SUBST

# robbyrussell-like: arrow turns red on non-zero exit status
PROMPT='%(?:%B%F{green}➜%f%b :%B%F{red}➜%f%b )%F{cyan}%~%f${vcs_info_msg_0_} '
