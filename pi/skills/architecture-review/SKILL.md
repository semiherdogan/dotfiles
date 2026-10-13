---
name: architecture-review
description: Use when reviewing architecture, finding module boundaries, improving testability, or identifying refactor opportunities in a codebase.
---

# Architecture Review

Look for places where complexity is poorly located.

Review for:
- Shallow modules: interfaces nearly as complex as their implementation.
- Pass-through layers that add no leverage.
- Logic spread across callers instead of concentrated behind one interface.
- Hard-to-test behavior caused by the wrong interface shape.
- Accidental coupling between unrelated concepts.

Output:
- List concrete candidates, ordered by impact.
- For each candidate, explain the current friction, proposed change, benefit, risk, and verification path.
- Separate clear wins from speculative redesign.

Use the deletion test:
- If deleting a module makes complexity disappear, it may be unnecessary.
- If deleting it spreads complexity across callers, it is probably earning its place.

Avoid:
- Re-litigating architecture without evidence from the code.
- Proposing broad rewrites.
- Treating file count reduction as an architectural goal.
