---
name: zoom-out
description: Use when the user asks for a higher-level map of unfamiliar code, architecture, modules, callers, or system behavior.
---

# Zoom Out

Step back before changing code.

Provide:
- The relevant modules and ownership boundaries.
- The main data/control flow.
- Important callers and entrypoints.
- The assumptions the code appears to rely on.
- The smallest next place to inspect or change.

Avoid:
- Deep implementation detail unless it explains the map.
- Code edits unless the user asks for them after the map.
- Guessing when the codebase can answer the question.
