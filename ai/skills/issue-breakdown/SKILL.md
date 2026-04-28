---
name: issue-breakdown
description: Use when converting a plan, spec, PRD, or feature idea into small implementation issues or independently reviewable slices.
---

# Issue Breakdown

Break work into vertical slices.

Workflow:
- Understand the goal and current code shape.
- Split by independently verifiable behavior, not by layer.
- Mark dependencies honestly.
- Prefer small slices that can be implemented, tested, reviewed, and shipped alone.
- Ask for approval before creating remote issues.

Issue shape:
- Title
- What to build
- Acceptance criteria
- Dependencies
- Verification
- Out of scope

Avoid:
- Horizontal tickets like "build database layer" unless that is independently useful.
- Creating GitHub issues without explicit user approval.
- Making one large tracking issue when thin slices are clearer.
