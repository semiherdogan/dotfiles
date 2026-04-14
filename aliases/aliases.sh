####
#
# Bash Aliases
#
####

# General
alias q='exit 0'
alias :q='q'

alias ..='cd ../'
alias ll='ls -lah'

# Enable aliases to be sudo’ed
alias sudo='sudo '

# Folders
alias www='cd ~/Code ; ll'
alias www-bitcuket='cd ~/Code-bitbucket ; ll'
alias desk='cd ~/Desktop'
alias k='cd ~/Desktop'

alias ips="ifconfig -a | grep -o 'inet6\? \(addr:\)\?\s\?\(\(\([0-9]\+\.\)\{3\}[0-9]\+\)\|[a-fA-F0-9:]\+\)' | awk '{ sub(/inet6? (addr:)? ?/, \"\"); print }'"
alias curlt='curl -sS -o /dev/null -w "%{time_starttransfer}\n"'

alias cls='clear'

loop () {
    for i in {1..$1}
    do
        eval ${@:2}
    done
}

epoch2date(){
	local epoch="${1:-$(pbpaste)}"
	echo $epoch
	node -p "new Date(('$epoch'.replace('.', '')+'00000').slice(0, 13) * 1).toISOString().replace('T', ' ').replace(/\..+/, '')"
}

alias yolo-message='curl -sS https://whatthecommit.com/index.txt'

alias reload="exec ${SHELL} -l"

# alias truncate-zed-threads="sqlite3 ~/Library/Application\ Support/Zed/threads/threads.db 'DELETE FROM threads;'"
