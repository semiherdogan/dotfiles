##
# AI related aliases
##

p-output() {
	local prompt
	read -r -d '' prompt <<'EOF'
Return output in a single fenced code block:

```text
...content...
````

Inside rules:
- no markdown syntax
- SECTION-based structure
- ---- separators
- plain text only
EOF

	echo -e "$prompt" | pbcopy
	echo "Copied to clipboard ✅"
}

p-design-md() {
	local prompt
	read -r -d '' prompt <<'EOF'
Do you know how to create a high-quality design.md file?

Please read and understand the repository before writing anything. We need to create a design.md for a new web project, following the official design.md specification and conventions.

Reference material:
https://stitch.withgoogle.com/docs/design-md/specification
[google-labs-code/design.md](https://github.com/google-labs-code/design.md)
--

Requirements:
- Inspect the existing project structure, product context, UI patterns, assets, and styling conventions.
- Follow the design.md specification closely.
- Produce a clear, implementation-ready design.md that can guide an AI coding agent or engineer.
- Include concrete visual direction, layout rules, interaction behavior, responsive behavior, accessibility expectations, and asset guidance where relevant.
- Avoid vague design language. Prefer specific, testable guidance.
- Do not invent product requirements that are not supported by the repository or prompt.
- If critical information is missing, ask the minimum necessary clarifying questions before drafting.
- If enough context exists, draft the complete design.md directly.

Are you ready?
EOF

	echo -e "$prompt" | pbcopy
	echo "Copied to clipboard ✅"
}

codex-commit-message-generate() {
	local diff
	diff="$(rtk git diff --cached)"

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

ai-skills() {
	"$DOTFILES_BASE/scripts/ai-skills" "$@"
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
