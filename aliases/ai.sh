##
# AI related aliases
##

alias p-prompt='bash ~/dotfiles/scripts/generate_prompt.sh'

codex-commit-message-generate() {
  local diff
  diff="$(git diff --cached)"

  if [[ -z "$diff" ]]; then
    echo "No staged changes to generate a commit message."
    return 1
  fi

  codex exec "Generate a conventional commit message for this staged git diff.

Requirements:
- Use conventional commit format: type(scope?): description
- Be concise
- Infer the most appropriate type
- Output only the commit message

Diff:
$diff"
}

## Ollama Cloud

# defaults / shortcuts
alias ocm='ollama launch claude --model minimax-m2.7:cloud'
alias ock='ollama launch claude --model kimi-k2.5:cloud'
alias ocg='ollama launch claude --model glm-5:cloud'

# general launcher
oc() {
  if [ -z "$1" ]; then
    echo "Kullanim:"
    echo "  oc <model>"
    echo "  ocl              # cloud model listesi"
    echo "  ocp              # menuden model sec"
    echo "  ocm | ock | ocg  # hizli kisayollar"
    return 1
  fi

  local model="$1"
  [[ "$model" != *":"* ]] && model="${model}:cloud"

  ollama launch claude --model "$model"
}

# cloud model list
ocl() {
  cat <<'EOF'
Cloud modeller:
  minimax-m2.7:cloud
  kimi-k2.5:cloud
  glm-5:cloud
  qwen3.5:cloud
  minimax-m2:cloud
  deepseek-v3.2:cloud
  gpt-oss:120b-cloud
EOF
}

# interactive model picker
ocp() {
  local model
  local models=(
    "minimax-m2.7:cloud"
    "kimi-k2.5:cloud"
    "glm-5:cloud"
    "qwen3.5:cloud"
    "minimax-m2:cloud"
    "deepseek-v3.2:cloud"
    "gpt-oss:120b-cloud"
    "manual entry..."
  )

  if command -v fzf >/dev/null 2>&1; then
    model=$(printf "%s\n" "${models[@]}" | fzf --prompt="Model sec: ")
  else
    echo "Model sec:"
    select model in "${models[@]}"; do
      break
    done
  fi

  [ -z "$model" ] && return

  if [ "$model" = "manual entry..." ]; then
    read -r -p "Model adi: " model
    [[ "$model" != *":"* ]] && model="${model}:cloud"
  fi

  ollama launch claude --model "$model"
}
