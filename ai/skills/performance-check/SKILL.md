---
name: performance-check
description: Use when evaluating or changing code on a hot path, build path, large data path, or repeated workflow.
---

# Performance Check

Use when evaluating or changing code on a hot path, build path, large data path, or repeated workflow.

Checklist:
- Look for redundant I/O, repeated computation, unnecessary allocations, and accidental O(n^2) loops.
- Prefer one-pass logic when it stays readable.
- Reuse already-computed results instead of recomputing.
- Choose data structures by access pattern and complexity.
- Verify with an existing benchmark, profiler, targeted test, or reasoned complexity analysis.

Avoid:
- Adding caches without a measured or clearly reasoned hot path.
- Trading simple linear work for complex code without evidence.
- Running clean rebuilds when an incremental check answers the question.
