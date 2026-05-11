cb() {
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "cb requires macOS pbcopy/pbpaste." >&2
    return 1
  fi

  case "$1" in
    -p|--paste)
      pbpaste
      return
      ;;

    -c|--clear)
      : | pbcopy
      return
      ;;

    -j|--json)
      pbpaste | jq -r 'fromjson? // .' | jq
      return
      ;;

    -J|--json-copy)
      pbpaste | jq -r 'fromjson? // .' | jq | tee >(pbcopy)
      return
      ;;

    -e|--encode)
      if [ ! -t 0 ]; then
        cat | base64 | pbcopy
      else
        pbpaste | base64 | pbcopy
      fi
      return
      ;;

    -d|--decode)
      if [ ! -t 0 ]; then
        cat | base64 -D | pbcopy
      else
        pbpaste | base64 -D | pbcopy
      fi
      return
      ;;

    -E|--encode-paste)
      pbpaste | base64 | tee >(pbcopy)
      return
      ;;

    -D|--decode-paste)
      pbpaste | base64 -D | tee >(pbcopy)
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
    cat | pbcopy
  elif [ $# -gt 0 ]; then
    printf "%s" "$*" | pbcopy
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
