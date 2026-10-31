export const SUBAGENT_TOOL = "subagent";
export const IMPLEMENTER = "implementer";
export const REVIEWER = "reviewer";
export const OUTCOME_COMPLETED = "completed";
// The only primary agent whose runs get an automatic review round; elsewhere review is manual.
export const ARCHITECT = "architect";
// pi-open-agents appends this custom entry whenever the primary agent changes; data.name is null when cleared.
export const ACTIVE_AGENT_ENTRY = "active_agent";
const CUSTOM_ENTRY_TYPE = "custom";

export type GateState = {
	// Working directories implementer ran in during this run; empty means it did not run.
	implementerCwds: Set<string>;
	// Implementer ran since the last reviewer call, so some change has not been reviewed yet.
	unreviewed: boolean;
	requested: boolean;
};

export function initialState(): GateState {
	return { implementerCwds: new Set(), unreviewed: false, requested: false };
}

// Records subagent calls in the primary session. sessionCwd is the default when the call has no cwd.
export function recordToolResult(state: GateState, toolName: string, input: unknown, sessionCwd: string): void {
	if (toolName !== SUBAGENT_TOOL) return;
	const args = input as { agent?: unknown; cwd?: unknown } | undefined;
	// A failed implementer run may still have written files, so it counts; the dirty-tree check filters no-ops.
	if (args?.agent === IMPLEMENTER) {
		state.implementerCwds.add(typeof args.cwd === "string" ? args.cwd : sessionCwd);
		state.unreviewed = true;
	}
	// A failed reviewer call counts too; `requested` keeps the gate to one request per run, so a fix after it never loops.
	if (args?.agent === REVIEWER) state.unreviewed = false;
}

export type TurnInfo = {
	// Tool calls in the turn that just ended; zero means the assistant gave its final answer.
	toolCallCount: number;
	outcome: string;
};

// context.canContinue is not checked: on a final answer it is false until our entry is committed, and Pi re-checks it then.
// The dirty-tree check is the caller's last step because it shells out to git.
export function wantsReview(state: GateState, turn: TurnInfo): boolean {
	if (turn.toolCallCount > 0) return false;
	if (turn.outcome !== OUTCOME_COMPLETED) return false;
	return state.unreviewed && !state.requested;
}

// Newest active_agent entry wins; a null name means no agent is active.
export function activeAgent(entries: readonly unknown[]): string | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as { type?: unknown; customType?: unknown; data?: { name?: unknown } };
		if (entry?.type !== CUSTOM_ENTRY_TYPE || entry.customType !== ACTIVE_AGENT_ENTRY) continue;
		const name = entry.data?.name;
		return typeof name === "string" && name !== "" ? name : undefined;
	}
	return undefined;
}
