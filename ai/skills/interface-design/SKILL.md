---
name: interface-design
description: Use when designing an API, module boundary, public function shape, service contract, or comparing multiple interface options.
---

# Interface Design

Design the interface before the implementation.

Workflow:
- Identify callers, common use cases, and constraints.
- Sketch at least two materially different interface shapes.
- Show a short usage example for each shape.
- Compare ease of correct use, misuse risk, performance implications, and testability.
- Recommend one option with tradeoffs.

Evaluation:
- Prefer small interfaces that hide real complexity.
- Keep invariants and error behavior explicit.
- Avoid exposing implementation details to make tests easier.
- Do not add a seam unless multiple real implementations or tests need it.

Avoid:
- Implementing before the interface is chosen.
- Offering variants that are only naming differences.
- Designing for imaginary future callers.
