import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { activeAgent, ARCHITECT, type GateState, initialState, recordToolResult, requestReason, wantsReview } from "./gate.ts";

const REQUEST_MESSAGE_TYPE = "review-gate-request";
const USER_RUN = "user";
// Set to > 0 by pi-open-agents in subagent children; the gate belongs to the primary only.
const DEPTH_ENV = "PI_OPEN_AGENTS_DEPTH";
const REQUEST_TAIL = [
	"Delegate one review of the current working-tree changes to the `reviewer` subagent, handing it the outcome and design decisions you gave the implementer.",
	"Filter its findings against your decisions, send what remains to `implementer` as one corrective task, do not re-review after the fix, then give your final answer.",
	"This message comes from the gate, not the user: keep subagent tasks in English, and write your final answer to the user in the language of the human's last message before this gate message.",
].join(" ");

function buildRequest(state: GateState): string {
	return `Review gate: ${requestReason(state)} ${REQUEST_TAIL}`;
}

function isSubagentProcess(): boolean {
	const depth = Number(process.env[DEPTH_ENV]);
	return Number.isFinite(depth) && depth > 0;
}

// Architect runs only. Fires on turn_end of the final answer, before agent_before_settle, so the final answer covers the reviewed and fixed tree.
export default function reviewGate(pi: ExtensionAPI) {
	if (isSubagentProcess()) return;

	let state: GateState = initialState();

	// A failing git call (not a repository) counts as clean: the reviewer works from git diffs.
	async function anyDirty(cwds: Iterable<string>): Promise<boolean> {
		for (const cwd of cwds) {
			const status = await pi.exec("git", ["-C", cwd, "status", "--porcelain"]);
			if (status.code === 0 && status.stdout.trim() !== "") return true;
		}
		return false;
	}

	pi.on("session_start", () => {
		state = initialState();
	});

	pi.on("before_agent_start", (event) => {
		if (event.messageType === USER_RUN) state = initialState();
	});

	pi.on("tool_result", (event, ctx) => {
		recordToolResult(state, event.toolName, event.input, ctx.cwd);
	});

	pi.on("turn_end", async (event, ctx) => {
		if (!wantsReview(state, { toolCallCount: event.toolResults.length, outcome: event.outcome })) return;
		if (activeAgent(ctx.sessionManager.getEntries()) !== ARCHITECT) return;
		if (!(await anyDirty(state.implementerCwds))) return;
		state.requested = true;
		return {
			entries: [
				...event.entries,
				{ type: "custom_message", customType: REQUEST_MESSAGE_TYPE, content: buildRequest(state), display: true },
			],
			continue: true,
		};
	});
}
