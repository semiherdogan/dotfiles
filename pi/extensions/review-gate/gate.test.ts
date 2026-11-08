import assert from "node:assert/strict";
import { test } from "node:test";
import {
	ACTIVE_AGENT_ENTRY,
	activeAgent,
	ARCHITECT,
	combineFingerprint,
	fingerprintChanged,
	IMPLEMENTER,
	implementerCwd,
	initialState,
	MAX_HASH_PATHS,
	MAX_REVIEW_ROUNDS,
	OUTCOME_COMPLETED,
	changedStatusPaths,
	type PathInfo,
	planHashing,
	recordToolResult,
	requestReason,
	REVIEWER,
	SUBAGENT_TOOL,
	wantsReview,
} from "./gate.ts";

const CWD = "/repo";
const CHANGED = true;
const UNCHANGED = false;
const finalTurn = { toolCallCount: 0, outcome: OUTCOME_COMPLETED };

test("asks for a review when implementer ran and the assistant gives its final answer", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(wantsReview(state, finalTurn), true);
	assert.deepEqual([...state.implementerCwds], [CWD]);
});

test("waits while the assistant is still calling tools", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(wantsReview(state, { ...finalTurn, toolCallCount: 1 }), false);
});

test("skips when the reviewer already ran after the last implementer call", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("asks once at the end when implementer ran again after a mid-run review", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(wantsReview(state, finalTurn), true);
	state.requested = true;
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("skips when the review round cap was reached, even with an implementer call after it", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	for (let round = 0; round < MAX_REVIEW_ROUNDS; round++) recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(state.unreviewed, true);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("still asks after one voluntary reviewer round followed by an implementer fix", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(state.reviewerRounds, 1);
	assert.equal(wantsReview(state, finalTurn), true);
});

test("the reviewer round counter resets with initialState", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	assert.equal(state.reviewerRounds, 1);
	assert.equal(initialState().reviewerRounds, 0);
});

test("asks only once per run", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	state.requested = true;
	assert.equal(wantsReview(state, finalTurn), false);
});

test("collects every cwd implementer worked in", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER, cwd: "/other" }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.deepEqual([...state.implementerCwds].sort(), ["/other", CWD]);
});

test("ignores other agents, other tools and malformed input", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: "explorer" }, CWD, CHANGED);
	recordToolResult(state, "edit", { agent: IMPLEMENTER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, undefined, CWD, CHANGED);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("does not continue an aborted or failed run", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(wantsReview(state, { ...finalTurn, outcome: "aborted" }), false);
	assert.equal(wantsReview(state, { ...finalTurn, outcome: "error" }), false);
});

test("an implementer call that left the fingerprint unchanged does not request a review", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, UNCHANGED);
	assert.equal(state.unreviewed, false);
	assert.equal(state.implementerCwds.size, 0);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("an implementer call that changed the fingerprint requests a review", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, fingerprintChanged(true, "a", "b"));
	assert.equal(wantsReview(state, finalTurn), true);
});

test("a missing before fingerprint counts as changed", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, fingerprintChanged(false, undefined, "b"));
	assert.equal(wantsReview(state, finalTurn), true);
});

test("a reviewer round followed by an unchanged implementer call does not request a review", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, UNCHANGED);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("fingerprintChanged compares tracked fingerprints and treats undefined on either side as changed", () => {
	assert.equal(fingerprintChanged(true, "a", "a"), false);
	assert.equal(fingerprintChanged(true, "a", "b"), true);
	assert.equal(fingerprintChanged(true, undefined, undefined), true);
	assert.equal(fingerprintChanged(true, undefined, "a"), true);
	assert.equal(fingerprintChanged(true, "a", undefined), true);
	assert.equal(fingerprintChanged(false, "a", "a"), true);
});

test("implementerCwd returns the call cwd, the session cwd as default, and undefined for other calls", () => {
	assert.equal(implementerCwd(SUBAGENT_TOOL, { agent: IMPLEMENTER, cwd: "/other" }, CWD), "/other");
	assert.equal(implementerCwd(SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD), CWD);
	assert.equal(implementerCwd(SUBAGENT_TOOL, { agent: REVIEWER }, CWD), undefined);
	assert.equal(implementerCwd("edit", { agent: IMPLEMENTER }, CWD), undefined);
	assert.equal(implementerCwd(SUBAGENT_TOOL, undefined, CWD), undefined);
});

test("combineFingerprint is stable and keeps part boundaries", () => {
	assert.equal(combineFingerprint(["a", "b"]), combineFingerprint(["a", "b"]));
	assert.notEqual(combineFingerprint(["ab", "c"]), combineFingerprint(["a", "bc"]));
});

test("changedStatusPaths keeps modified and untracked paths, skips deletions, clean entries and rename origins", () => {
	const status = [" M a.ts", "M  b.ts", "?? c.ts", " D d.ts", "D  e.ts", "R  new.ts", "old.ts", "?? sub/"].join("\0") + "\0";
	assert.deepEqual(changedStatusPaths(status), ["a.ts", "b.ts", "c.ts", "new.ts", "sub/"]);
});

test("planHashing hashes regular files and marks everything else", () => {
	const infos: Record<string, PathInfo> = {
		"a.ts": { kind: "file" },
		"link": { kind: "symlink", target: "t" },
		"sub/": { kind: "directory" },
		"fifo": { kind: "other" },
		"gone": { kind: "missing" },
	};
	const status = Object.keys(infos).map((path) => `?? ${path}`).join("\0") + "\0";
	assert.deepEqual(planHashing(status, (path) => infos[path]), {
		files: ["a.ts"],
		markers: ["symlink:link:t", "directory:sub/", "other:fifo"],
	});
});

test("planHashing gives up above the path cap and accepts exactly the cap", () => {
	const statusOf = (count: number) => Array.from({ length: count }, (_, i) => `?? f${i}`).join("\0") + "\0";
	const file = (): PathInfo => ({ kind: "file" });
	assert.equal(planHashing(statusOf(MAX_HASH_PATHS + 1), file), undefined);
	assert.equal(planHashing(statusOf(MAX_HASH_PATHS), file)?.files.length, MAX_HASH_PATHS);
});

test("requestReason says no reviewer round ran when none did", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(requestReason(state), "implementer changed the working tree and no `reviewer` round has run yet.");
});

test("requestReason says the change came after the last reviewer round", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD, CHANGED);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD, CHANGED);
	assert.equal(requestReason(state), "implementer changed the working tree after the last `reviewer` round.");
});

test("activeAgent reads the newest active_agent entry and treats a null name as none", () => {
	const announce = (name: string | null) => ({ type: "custom", customType: ACTIVE_AGENT_ENTRY, data: { name } });
	const other = { type: "custom", customType: "open-agents-state", data: { name: "explorer" } };
	assert.equal(activeAgent([]), undefined);
	assert.equal(activeAgent([announce(ARCHITECT), other]), ARCHITECT);
	assert.equal(activeAgent([announce("explorer"), announce(ARCHITECT)]), ARCHITECT);
	assert.equal(activeAgent([announce(ARCHITECT), announce(null)]), undefined);
	assert.equal(activeAgent([{ type: "message" }, null]), undefined);
});
