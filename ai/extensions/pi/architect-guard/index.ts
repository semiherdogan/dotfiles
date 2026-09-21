import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Keeps the architect's hands off source files. Its prompt says "delegate to implementer",
// but after investigating a change the model has every file in context and editing feels
// cheaper than writing a spec, so the rule gets skipped. pi-open-agents does not enforce
// per-path edit permissions for a primary agent (only a full deny removes the tool), so this
// hook blocks edit/write at call time. Docs, decision records, HANDOFF.md and the .pi config
// tree stay editable: those are the architect's own artifacts.
const ARCHITECT = "architect";
const EDIT_TOOLS = new Set(["write", "edit"]);
const STATE_ENTRY = "open-agents-state";

const BLOCK_REASON = [
	"The architect does not edit source files. Delegate this change to the `implementer` subagent,",
	"even for a one-line fix: the investigation you did is the specification, write it into the task.",
	"Only Markdown files and the .pi/ tree may be edited directly.",
].join(" ");

// Subagent children carry PI_OPEN_AGENTS_DEPTH > 0; the primary process has none.
function isSubagentProcess(): boolean {
	const depth = Number(process.env.PI_OPEN_AGENTS_DEPTH);
	return Number.isFinite(depth) && depth > 0;
}

export function isArchitectArtifact(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	if (/\.md$/i.test(normalized)) return true;
	return /(^|\/)\.pi\//.test(normalized);
}

export default function architectGuard(pi: ExtensionAPI) {
	if (isSubagentProcess()) return;

	pi.on("tool_call", (event, ctx) => {
		if (!EDIT_TOOLS.has(event.toolName)) return undefined;

		const path = (event.input as { path?: unknown }).path;
		if (typeof path !== "string" || isArchitectArtifact(path)) return undefined;

		// pi-open-agents persists the active primary agent as a custom entry on the first turn it
		// runs; without one, no agent is active and the guard has nothing to protect.
		const entries = ctx.sessionManager.getEntries();
		let active: string | undefined;
		for (const entry of entries) {
			if (entry.type === "custom" && entry.customType === STATE_ENTRY) {
				active = (entry.data as { name?: string } | undefined)?.name;
			}
		}
		if (active !== ARCHITECT) return undefined;

		return { block: true, reason: BLOCK_REASON };
	});
}
