export const REVIEW_INSTRUCTIONS = [
	"Review the working tree changes now and submit the result with the `review_submit` tool.",
	"- Look at `git status --porcelain` and `git diff HEAD`; open a file only to confirm a line you will reference.",
	"- summary: one line, what the change set does. No filler.",
	"- changes: what changed, grouped by behavior, most important first.",
	"- findings: only risks worth a human look, most severe first. Each needs the exact path and line in the current file, a one-sentence claim and one concrete check. No style remarks. Use an empty array when nothing qualifies.",
	"- affected: unchanged files that depend on the changed code, with the reason.",
	"- Never invent paths or lines; the tool rejects references that do not exist.",
	"- When the tool accepts, answer with one line naming the report path. Do not repeat the review in chat.",
].join("\n");
