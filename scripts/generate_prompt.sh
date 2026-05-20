p-prompt() {
	local role
	local goal
	local context
	local prompt

	if ! command -v pbcopy >/dev/null 2>&1; then
		echo "p-prompt requires macOS pbcopy." >&2
		return 1
	fi

	printf "Role: "
	IFS= read -r role
	printf "Goal: "
	IFS= read -r goal
	printf "Context: "
	IFS= read -r context

	prompt="$(
		{
			cat <<'EOF'
# Task Brief

EOF

			if [ -n "$role" ]; then
				printf "## Role\n%s\n\n" "$role"
			fi

			if [ -n "$goal" ]; then
				printf "## Goal\n%s\n\n" "$goal"
			fi

			if [ -n "$context" ]; then
				printf "## Context\n%s\n\n" "$context"
			fi

			cat <<'EOF'
## Output Requirements
- Answer in Turkish.
- Be direct, structured, and concise.
- Use headings and bullets only when they improve readability.
- Prefer concrete recommendations, examples, or next steps over generic advice.
- If critical information is missing, ask the minimum number of clarifying questions before finalizing.

## Reasoning Rules
- State assumptions explicitly.
- Separate facts from inferences.
- Flag uncertainty instead of guessing.
- Do not fabricate sources, numbers, or constraints.
- Keep internal alternatives and reasoning private; return only the best final answer.

## Quality Bar
- The answer should be actionable.
- Remove filler, repetition, and vague phrasing.
- Check that the final output matches the goal and context.
EOF
		}
	)"

	printf "%s\n" "$prompt" | pbcopy
	echo "Prompt copied to clipboard."
}

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
