---
name: repo-understand
description: Use when onboarding to an unfamiliar repository, explaining what a repo does and how to run it, or when the user asks for a higher-level map of a subsystem, its modules, callers, or data flow before changing code.
---

# Repo Understand

Build a practical map before changing code. Pick the scope from the question: the whole repository when onboarding, one subsystem when the user asks how a specific area works. The workflow and the avoid list apply to both scopes; only the output changes.

Workflow:
- Inspect repository shape first: top-level files, package manifests, build files, docs, tests, and obvious entrypoints.
- Identify the product or library purpose from code and docs. Say "I don't know" when intent is not discoverable.
- Determine the runtime model: language, framework, process boundaries, CLIs, services, background jobs, frontend/backend split, and external dependencies.
- Trace the main execution path from entrypoints into core modules.
- Map ownership boundaries: modules, packages, apps, infrastructure, generated code, tests, scripts, and config.
- Find the project-provided commands for setup, development, test, lint, build, and verification. Prefer repo scripts over global tools.
- Note environment requirements without exposing secrets.
- Separate facts from inferences.

Output, repository scope:
- What this repo does
- Tech stack and runtime model
- Repository map
- Main entrypoints and flows
- Build, run, and test commands
- Configuration and external dependencies
- Important conventions
- Risky or complex areas
- Good first places to inspect or change
- Unknowns and assumptions

Output, subsystem scope, keep it short:
- The relevant modules and ownership boundaries.
- The main data and control flow.
- Important callers and entrypoints.
- The assumptions the code appears to rely on.
- The smallest next place to inspect or change.

Use adjacent skills when needed:
- Use `architecture-review` only when the user asks for architectural critique.
- Use `issue-breakdown` only when converting findings into implementation slices.

Avoid:
- Editing code unless the user explicitly asks for changes.
- Guessing project purpose from file names alone when docs or entrypoints disagree.
- Listing every file. Group by responsibility.
- Running expensive setup or full builds before identifying the narrowest useful command.
- Treating missing docs as proof that behavior does not exist.
