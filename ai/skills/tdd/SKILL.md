---
name: tdd
description: Use when the user asks for test-first work, red-green-refactor, a TDD fix plan, or behavior-focused tests.
---

# TDD

Use a vertical red-green-refactor loop.

Workflow:
- Identify the public interface or user-visible behavior first.
- Write one failing test for one behavior.
- Implement the smallest change that makes it pass.
- Repeat with the next behavior.
- Refactor only while tests are green.

Test rules:
- Test observable behavior, not private implementation.
- Prefer public APIs, command output, UI state, or persisted effects.
- Mock only system boundaries: external services, time, randomness, filesystem, or network.
- Avoid mocking internal modules you control.

Avoid:
- Writing all tests before implementation.
- Testing data shape that is not part of the contract.
- Adding speculative behavior for future tests.
