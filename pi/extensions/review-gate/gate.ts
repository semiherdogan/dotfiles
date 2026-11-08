import { createHash } from "node:crypto";

export const SUBAGENT_TOOL = "subagent";
export const IMPLEMENTER = "implementer";
export const REVIEWER = "reviewer";
export const OUTCOME_COMPLETED = "completed";
// The only primary agent whose runs get an automatic review round; elsewhere review is manual.
export const ARCHITECT = "architect";
// pi-open-agents appends this custom entry whenever the primary agent changes; data.name is null when cleared.
export const ACTIVE_AGENT_ENTRY = "active_agent";
const CUSTOM_ENTRY_TYPE = "custom";

// Bounds review rounds per user message: an architect-run review/fix cycle leaves an implementer call after the last reviewer, which would otherwise ask again.
export const MAX_REVIEW_ROUNDS = 2;

const NO_REVIEWER_ROUNDS = 0;

export type GateState = {
	// Working directories implementer ran in during this run; empty means it did not run.
	implementerCwds: Set<string>;
	// Implementer ran since the last reviewer call, so some change has not been reviewed yet.
	unreviewed: boolean;
	requested: boolean;
	// Reviewer subagent calls in this run, voluntary ones included.
	reviewerRounds: number;
};

export function initialState(): GateState {
	return { implementerCwds: new Set(), unreviewed: false, requested: false, reviewerRounds: 0 };
}

// Working tree fingerprint of a cwd; undefined when it cannot be computed (not a repository).
export type Fingerprint = string | undefined;

// Length-prefixed so parts cannot run into each other; diffs may contain any byte.
export function combineFingerprint(parts: readonly string[]): string {
	const hash = createHash("sha256");
	for (const part of parts) hash.update(`${Buffer.byteLength(part)}:`).update(part);
	return hash.digest("hex");
}

// Cwd of an implementer subagent call, or undefined for any other call. sessionCwd is the default when the call has no cwd.
export function implementerCwd(toolName: string, input: unknown, sessionCwd: string): string | undefined {
	if (toolName !== SUBAGENT_TOOL) return undefined;
	const args = input as { agent?: unknown; cwd?: unknown } | undefined;
	if (args?.agent !== IMPLEMENTER) return undefined;
	return typeof args.cwd === "string" ? args.cwd : sessionCwd;
}

// Without a recorded before fingerprint (extension loaded mid-call) or with an uncomputable one, the call counts as a change.
export function fingerprintChanged(tracked: boolean, before: Fingerprint, after: Fingerprint): boolean {
	if (!tracked || before === undefined || after === undefined) return true;
	return before !== after;
}

// Above this many paths to inspect, fingerprinting is skipped and the call counts as a change.
export const MAX_HASH_PATHS = 2000;

const STATUS_NONE = " ";
const STATUS_DELETED = "D";
const STATUS_RENAMED = "R";
const STATUS_COPIED = "C";
const STATUS_ENTRY_PREFIX_LENGTH = 3;

export type PathInfo =
	| { kind: "file" }
	| { kind: "symlink"; target: string }
	| { kind: "directory" }
	| { kind: "other" }
	| { kind: "missing" };

export type HashPlan = {
	// Regular files whose content must be hashed.
	files: string[];
	// Fixed stand-ins for paths that cannot be hashed (directories, nested repos, symlinks, special files).
	markers: string[];
};

// Paths from `git status --porcelain=v1 -z` whose worktree content may differ from what git records, deletions excluded.
export function changedStatusPaths(status: string): string[] {
	const tokens = status.split("\0");
	const paths: string[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.length <= STATUS_ENTRY_PREFIX_LENGTH) continue;
		const index = token[0];
		const worktree = token[1];
		// With -z a rename or copy is followed by its origin path as a separate token.
		if (index === STATUS_RENAMED || index === STATUS_COPIED || worktree === STATUS_RENAMED || worktree === STATUS_COPIED) i++;
		if (index === STATUS_NONE && worktree === STATUS_NONE) continue;
		if (index === STATUS_DELETED || worktree === STATUS_DELETED) continue;
		paths.push(token.slice(STATUS_ENTRY_PREFIX_LENGTH));
	}
	return paths;
}

// undefined when more than MAX_HASH_PATHS paths would need inspecting; the caller then treats the call as a change.
export function planHashing(status: string, inspect: (path: string) => PathInfo): HashPlan | undefined {
	const paths = changedStatusPaths(status);
	if (paths.length > MAX_HASH_PATHS) return undefined;
	const plan: HashPlan = { files: [], markers: [] };
	for (const path of paths) {
		const info = inspect(path);
		switch (info.kind) {
			case "file":
				plan.files.push(path);
				break;
			case "symlink":
				plan.markers.push(`symlink:${path}:${info.target}`);
				break;
			case "directory":
				plan.markers.push(`directory:${path}`);
				break;
			case "other":
				plan.markers.push(`other:${path}`);
				break;
			case "missing":
				break;
		}
	}
	return plan;
}

// Records subagent calls in the primary session. changed is whether an implementer call altered its working tree.
export function recordToolResult(state: GateState, toolName: string, input: unknown, sessionCwd: string, changed: boolean): void {
	if (toolName !== SUBAGENT_TOOL) return;
	const args = input as { agent?: unknown; cwd?: unknown } | undefined;
	// A failed implementer run may still have written files, so it counts when the tree changed.
	const cwd = implementerCwd(toolName, input, sessionCwd);
	if (cwd !== undefined && changed) {
		state.implementerCwds.add(cwd);
		state.unreviewed = true;
	}
	// A failed reviewer call counts too; `requested` keeps the gate to one request per run, so a fix after it never loops.
	if (args?.agent === REVIEWER) {
		state.unreviewed = false;
		state.reviewerRounds++;
	}
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
	if (state.reviewerRounds >= MAX_REVIEW_ROUNDS) return false;
	return state.unreviewed && !state.requested;
}

export function requestReason(state: GateState): string {
	if (state.reviewerRounds === NO_REVIEWER_ROUNDS) return "implementer changed the working tree and no `reviewer` round has run yet.";
	return "implementer changed the working tree after the last `reviewer` round.";
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
