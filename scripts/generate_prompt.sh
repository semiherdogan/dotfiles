#!/bin/bash

# Get user inputs
read -p "Role: " ROLE
read -p "Goal: " GOAL
read -p "Context: " CONTEXT

# Create the prompt content
PROMPT=""

[ -n "$ROLE" ] && PROMPT+="**Role:**  \n$ROLE\n\n"
[ -n "$GOAL" ] && PROMPT+="**Goal:**  \n$GOAL\n\n"
[ -n "$CONTEXT" ] && PROMPT+="**Context:**  \n$CONTEXT\n\n"

PROMPT+="---
### Generation Strategy (Required)
- Generate **multiple distinct candidate responses** for each section.
- Favor **informative diversity** over familiar or generic phrasing.
- Avoid default or “safe” formulations unless clearly justified by the context.

---
### Verbalized Sampling Step
Before producing the final output:
1. Generate **3-5 alternative versions** of the full response (or per section).
2. Assign a **probability score** to each alternative representing its plausibility or usefulness given the context.
3. Select the **highest-probability** alternative as the final answer.
4. Keep alternatives internal unless explicitly asked to show them.

---
### Thinking Process
- Think step by step.
- If critical information is missing, **ask clarifying questions before finalizing**.
- Do **not** introduce unstated assumptions.
- Actively check whether choices are driven by familiarity rather than evidence.

---
### Constraints / Negative Rules
- Do not use emotional or persuasive language.
- Do not go beyond the provided information.
- Do not fabricate statistics or sources.
- Do not collapse diverse insights into a single generic conclusion.

---
### Uncertainty Handling
- Explicitly state uncertainty where applicable.
- If multiple interpretations exist, briefly enumerate them before selecting one.

---
### Quality Check (Final Step)
- Verify that the output reflects **multiple plausible perspectives**, not just the most typical one.
- Confirm factual accuracy and safety are preserved.
- Ensure diversity improves insight, not noise.

---
- Also answer in turkish language
"

echo -e "$PROMPT" | cb

# echo "Copied to clipboard ✅"
