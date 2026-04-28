---
name: bug-fix
description: Use when fixing a bug, regression, failing test, or reported broken behavior.
---

# Bug Fix

Use when fixing a bug, regression, failing test, or reported broken behavior.

Workflow:
- Reproduce the issue first when feasible.
- Identify the smallest behavioral cause before editing.
- Keep the patch scoped to the failing path.
- Add or update a narrow regression test when the project has a nearby test pattern.
- Run the narrowest relevant verification first.
- If reproduction or verification is not possible, state exactly why.

Avoid:
- Broad refactors while fixing the bug.
- Speculative cleanup outside the failing path.
- Changing public behavior without calling it out.
