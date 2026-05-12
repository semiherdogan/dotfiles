---
name: project-kickoff
description: Use when starting a new software project, shaping a fresh repository, choosing initial architecture, defining the first implementation slice, or turning a product idea into an executable engineering kickoff plan.
---

# Project Kickoff

Turn a new project idea into a small, executable engineering start.

Workflow:
- Clarify the problem, target users, success criteria, and non-goals.
- Identify constraints: deadline, deployment target, expected scale, integrations, data sensitivity, team size, and maintenance expectations.
- Choose the simplest architecture that satisfies the first real use case.
- Define the core domain concepts and public interfaces before implementation detail.
- Pick a first vertical slice that can be built, tested, reviewed, and run end to end.
- Define the feedback loop: dev command, narrow test command, lint/typecheck/build command, and deploy or demo path when relevant.
- Call out risks early: unclear requirements, irreversible data choices, auth/security, external APIs, migration paths, performance hot spots, and operational ownership.

Output:
- Goal and success criteria
- Scope and out of scope
- Constraints and assumptions
- Recommended initial shape
- Core domain model and interfaces
- First vertical slice
- Test and verification strategy
- Repository structure
- Development workflow
- Risks and decisions to defer
- Open questions

Decision rules:
- Prefer boring, well-supported tools unless the project has a concrete reason not to.
- Start with one deployable path before building broad infrastructure.
- Keep abstractions behind real use cases.
- Choose data structures and storage based on access patterns, not fashion.
- Optimize the local feedback loop before adding process.
- Defer scaling work until scale assumptions are explicit.

Use adjacent skills when needed:
- Use `domain-language` when names and business terms are ambiguous.
- Use `interface-design` for APIs, module boundaries, or service contracts.
- Use `issue-breakdown` to turn the kickoff plan into implementation tasks.
- Use `tdd` when the user wants test-first execution.

Avoid:
- Producing a generic startup checklist.
- Proposing microservices, queues, caches, or distributed infrastructure without a concrete pressure.
- Designing around imaginary future callers.
- Hiding uncertainty. Mark assumptions and open questions clearly.
- Creating files or scaffolding code unless the user asks to start implementation.
