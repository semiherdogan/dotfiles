---
name: refactor-plan
description: Use when planning a refactor, breaking risky code movement into safe steps, or preparing an incremental migration.
---

# Refactor Plan

Create a plan that keeps the codebase working after every step.

Workflow:
- State the current problem and target behavior.
- Identify what is in scope and out of scope.
- Inspect existing tests and call out coverage gaps.
- Break the work into the smallest safe steps.
- Define verification after each meaningful step.

Plan format:
- Problem
- Proposed shape
- Step-by-step changes
- Testing strategy
- Risks and rollback points
- Out of scope

Avoid:
- Combining behavior changes with mechanical movement.
- Planning giant commits that cannot be reviewed independently.
- Refactoring without a verification path.
