---
name: domain-language
description: Use when the user wants to clarify domain terms, build a glossary, resolve naming ambiguity, or align code with business language.
---

# Domain Language

Make domain terms precise before designing or changing code.

Workflow:
- Extract important nouns, verbs, states, and relationships from the conversation and code.
- Flag ambiguous terms and synonyms.
- Recommend one canonical term for each concept.
- Distinguish domain concepts from implementation names.
- Update or create a glossary only when the user asks for an artifact.

Glossary format:
- Term
- Definition in one sentence
- Aliases to avoid
- Relationships to other terms
- Open questions

Avoid:
- Including generic programming terms.
- Encoding implementation details as domain language.
- Letting one word mean multiple concepts.
