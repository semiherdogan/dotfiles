import { lstatSync, readlinkSync } from "node:fs";
import { join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
	activeAgent,
	ARCHITECT,
	combineFingerprint,
	type Fingerprint,
	fingerprintChanged,
	type GateState,
	implementerCwd,
	initialState,
	type PathInfo,
	planHashing,
	recordToolResult,
	requestReason,
	wantsReview,
} from "./gate.ts";

const REQUEST_MESSAGE_TYPE = "review-gate-request";
const USER_RUN = "user";
// Set to > 0 by pi-open-agents in subagent children; the gate belongs to the primary only.
const DEPTH_ENV = "PI_OPEN_AGENTS_DEPTH";
const NO_OPTIONAL_LOCKS = "--no-optional-locks";
const HASH_BATCH_SIZE = 100;
const REQUEST_TAIL = [
	"Delegate one review of the current working-tree changes to the `reviewer` subagent, handing it the outcome and design decisions you gave the implementer.",
	"Filter its findings against your decisions, send what remains to `implementer` as one corrective task, do not re-review after the fix, then give your final answer.",
	"This message comes from the gate, not the user: keep subagent tasks in English, and write your final answer to the user in the language of the human's last message before this gate message.",
].join(" ");

function buildRequest(state: GateState): string {
	return `Review gate: ${requestReason(state)} ${REQUEST_TAIL}`;
}

function inspectPath(root: string, path: string): PathInfo {
	const full = join(root, path);
	try {
		const stat = lstatSync(full);
		if (stat.isSymbolicLink()) return { kind: "symlink", target: readlinkSync(full) };
		if (stat.isDirectory()) return { kind: "directory" };
		return stat.isFile() ? { kind: "file" } : { kind: "other" };
	} catch {
		return { kind: "missing" };
	}
}

function isSubagentProcess(): boolean {
	const depth = Number(process.env[DEPTH_ENV]);
	return Number.isFinite(depth) && depth > 0;
}

// Architect runs only. Fires on turn_end of the final answer, before agent_before_settle, so the final answer covers the reviewed and fixed tree.
export default function reviewGate(pi: ExtensionAPI) {
	if (isSubagentProcess()) return;

	let state: GateState = initialState();
	// Fingerprints taken before each implementer call, keyed by toolCallId.
	const beforeFingerprints = new Map<string, Fingerprint>();

	async function git(cwd: string, args: string[]): Promise<string | undefined> {
		const result = await pi.exec("git", [NO_OPTIONAL_LOCKS, "-C", cwd, ...args]);
		return result.code === 0 ? result.stdout : undefined;
	}

	// Read-only, hash-only git output: status, staged blob ids, and worktree hashes of changed regular files. No content is loaded into JS.
	async function fingerprint(cwd: string): Promise<Fingerprint> {
		const root = (await git(cwd, ["rev-parse", "--show-toplevel"]))?.trim();
		if (!root) return undefined;
		const status = await git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
		const staged = await git(root, ["diff", "--cached", "--raw", "-z", "--no-renames", "--abbrev=40"]);
		if (status === undefined || staged === undefined) return undefined;
		const plan = planHashing(status, (path) => inspectPath(root, path));
		if (plan === undefined) return undefined;
		const hashes: string[] = [];
		for (let i = 0; i < plan.files.length; i += HASH_BATCH_SIZE) {
			const batch = plan.files.slice(i, i + HASH_BATCH_SIZE);
			const out = await git(root, ["hash-object", "--no-filters", "--", ...batch]);
			if (out === undefined) return undefined;
			hashes.push(...batch, out);
		}
		return combineFingerprint([status, staged, ...plan.markers, ...hashes]);
	}

	// Never throws: a fingerprint problem must not break the call, it only degrades to the dirty-tree check.
	async function safeFingerprint(cwd: string): Promise<Fingerprint> {
		try {
			return await fingerprint(cwd);
		} catch {
			return undefined;
		}
	}

	// A failing git call (not a repository) counts as clean: the reviewer works from git diffs.
	async function anyDirty(cwds: Iterable<string>): Promise<boolean> {
		for (const cwd of cwds) {
			const status = await pi.exec("git", [NO_OPTIONAL_LOCKS, "-C", cwd, "status", "--porcelain"]);
			if (status.code === 0 && status.stdout.trim() !== "") return true;
		}
		return false;
	}

	pi.on("session_start", () => {
		state = initialState();
		beforeFingerprints.clear();
	});

	pi.on("before_agent_start", (event) => {
		if (event.messageType !== USER_RUN) return;
		state = initialState();
		beforeFingerprints.clear();
	});

	pi.on("tool_call", async (event, ctx) => {
		try {
			const cwd = implementerCwd(event.toolName, event.input, ctx.cwd);
			if (cwd !== undefined) beforeFingerprints.set(event.toolCallId, await safeFingerprint(cwd));
		} catch {
			// Fail open: without a before fingerprint the call counts as a change.
		}
		return undefined;
	});

	pi.on("tool_result", async (event, ctx) => {
		const cwd = implementerCwd(event.toolName, event.input, ctx.cwd);
		let changed = true;
		if (cwd !== undefined) {
			const tracked = beforeFingerprints.has(event.toolCallId);
			const before = beforeFingerprints.get(event.toolCallId);
			beforeFingerprints.delete(event.toolCallId);
			changed = fingerprintChanged(tracked, before, await safeFingerprint(cwd));
		}
		recordToolResult(state, event.toolName, event.input, ctx.cwd, changed);
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
