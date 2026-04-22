##
# AI related aliases
##

alias p-prompt='bash "$DOTFILES_BASE/scripts/generate_prompt.sh"'

p-output() {
  local prompt
  read -r -d '' prompt << 'EOF'
Generate documentation in AI MEMORY SAFE FORMAT v1.

Return the output strictly inside a single code block.

Constraints:
- Output must be inside triple backticks (``` )
- Inside the block, DO NOT use markdown syntax (#, ##, lists, etc.)
- Use only plain text format
- Use SECTION: headers
- Use ---- separators between sections
- Must be streaming-safe and parser-safe
- Output must be deterministic
- Content must be copy-paste safe
EOF

  echo -e "$prompt" | pbcopy
  echo "Copied to clipboard ✅"
}

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
    echo "  ocl              # cloud model list"
    echo "  ocp              # select model from menu"
    echo "  ocm | ock | ocg  # shortcuts"
    return 1
  fi

  local model="$1"
  [[ "$model" != *":"* ]] && model="${model}:cloud"

  ollama launch claude --model "$model"
}

# cloud model list
ocl() {
  cat <<'EOF'
Cloud models:
  minimax-m2.7:cloud
  kimi-k2.6:cloud
  glm-5.1:cloud
  qwen3.5:cloud
  minimax-m2.7:cloud
  gpt-oss:120b-cloud
EOF
}

# interactive model picker
ocp() {
  local model
  local models=(
    "minimax-m2.7:cloud"
    "kimi-k2.6:cloud"
    "glm-5.1:cloud"
    "qwen3.5:cloud"
    "minimax-m2.7:cloud"
    "gpt-oss:120b-cloud"
    "manual entry..."
  )

  if command -v fzf >/dev/null 2>&1; then
    model=$(printf "%s\n" "${models[@]}" | fzf --prompt="Model: ")
  else
    echo "Model:"
    select model in "${models[@]}"; do
      break
    done
  fi

  [ -z "$model" ] && return

  if [ "$model" = "manual entry..." ]; then
    read -r -p "Model name: " model
    [[ "$model" != *":"* ]] && model="${model}:cloud"
  fi

  ollama launch claude --model "$model"
}
