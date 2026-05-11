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
