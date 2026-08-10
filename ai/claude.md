## Agent Memory

Use Vestige as durable local memory.

Use Vestige for information that remains useful across sessions, such as durable user preferences, project decisions, recurring corrections, stable facts, and reusable code patterns.

Do not use Vestige as a replacement for the existing handoff/context-rollover workflow. `HANDOFF.md` contains the temporary state needed to continue the current task; Vestige should contain only knowledge worth retaining beyond the current task.

When relevant, retrieve memories before making decisions that depend on prior knowledge. Use `search` for targeted retrieval, `deep_reference` when prior decisions or evolving facts matter, and `contradictions` when memories may conflict. Treat retrieved memories as context, not as a replacement for the current repository or other sources of truth.

Save durable knowledge with `smart_ingest`. Do not store secrets, credentials, raw logs, transient command output, unverified speculation, temporary task state, or information the user asked not to retain.

When the user confirms a memory was useful, promote it. When they say it was wrong or unhelpful, demote it. Permanently delete a memory only when explicitly requested, using the required confirmation.

Do not automatically load broad session memory at the start of every session when the existing handoff/session-start workflow already provides current task context. Prefer targeted retrieval when memory is actually relevant.

When a repository's decision records or documentation have been indexed into Vestige, query the index instead of bulk-reading the directory, then open only the source files it points at. The indexed memories are a search layer; the files in the repository remain the record, so keep writing and updating them as that project requires.

Keep the Vestige store in one language, English, and query it in English even when the conversation is in another language. The stored text and its embeddings are English, so a query in another language matches poorly and can return a confidently wrong neighbour instead of nothing. Translate the question into English terms before retrieving, and store new memories in English. This governs the store only; keep answering the user in the language they are writing in.
