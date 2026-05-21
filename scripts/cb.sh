cb() {
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "cb requires macOS pbcopy/pbpaste." >&2
    return 1
  fi

  _cb_copied() {
    if [ -t 2 ]; then
      printf "\033[42;30m OK \033[0m copied\n" >&2
    else
      printf "copied\n" >&2
    fi
  }

  _cb_cleared() {
    if [ -t 2 ]; then
      printf "\033[42;30m OK \033[0m cleared\n" >&2
    else
      printf "cleared\n" >&2
    fi
  }

  _cb_input() {
    if [ ! -t 0 ]; then
      cat
    else
      pbpaste
    fi
  }

  case "$1" in
    -p|--paste)
      pbpaste
      return
      ;;

    -c|--clear)
      : | pbcopy && _cb_cleared
      return
      ;;

    -j|--json)
      _cb_input | jq -r 'fromjson? // .' | jq
      return
      ;;

    -J|--json-copy)
      json=$(_cb_input | jq -r 'fromjson? // .' | jq) || return
      printf "%s\n" "$json" | pbcopy || return
      printf "%s\n" "$json" | jq -C
      _cb_copied
      return
      ;;

    -e|--encode)
      if [ ! -t 0 ]; then
        cat | base64 | pbcopy && _cb_copied
      else
        pbpaste | base64 | pbcopy && _cb_copied
      fi
      return
      ;;

    -d|--decode)
      if [ ! -t 0 ]; then
        cat | base64 -D | pbcopy && _cb_copied
      else
        pbpaste | base64 -D | pbcopy && _cb_copied
      fi
      return
      ;;

    -E|--encode-paste)
      pbpaste | base64 | tee >(pbcopy) && _cb_copied
      return
      ;;

    -D|--decode-paste)
      pbpaste | base64 -D | tee >(pbcopy) && _cb_copied
      return
      ;;

    -h|--help)
      cat <<EOF
Usage:
  cb                  Paste clipboard
  echo x | cb         Copy stdin
  cb "text"           Copy text

Options:
  -p, --paste         Paste clipboard
  -c, --clear         Clear clipboard

JSON:
  -j, --json          Pretty-print JSON
  -J, --json-copy     Pretty-print + copy result

Base64:
  -e, --encode        Base64 encode -> copy
  -d, --decode        Base64 decode -> copy
  -E, --encode-paste  Encode + also print
  -D, --decode-paste  Decode + also print

Examples:
  cb "hello"
  cb -e
  cb -d
  echo "secret" | cb -e
EOF
      return
      ;;
  esac

  if [ ! -t 0 ]; then
    cat | pbcopy && _cb_copied
  elif [ $# -gt 0 ]; then
    printf "%s" "$*" | pbcopy && _cb_copied
  else
    pbpaste
  fi
}

_cb() {
  local state

  _arguments -C \
    '1: :(
      -p --paste
      -c --clear
      -j --json
      -J --json-copy
      -e --encode
      -d --decode
      -E --encode-paste
      -D --decode-paste
      -h --help
    )' \
    '*::arg:->args'

  case $state in
    args)
      _message "clipboard input text"
      ;;
  esac
}

if command -v compdef >/dev/null 2>&1; then
  compdef _cb cb
fi
