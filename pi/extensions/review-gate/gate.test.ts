import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVE_AGENT_ENTRY, activeAgent, ARCHITECT, IMPLEMENTER, initialState, MAX_REVIEW_ROUNDS, OUTCOME_COMPLETED, recordToolResult, requestReason, REVIEWER, SUBAGENT_TOOL, wantsReview } from "./gate.ts";

const CWD = "/repo";
const finalTurn = { toolCallCount: 0, outcome: OUTCOME_COMPLETED };

test("asks for a review when implementer ran and the assistant gives its final answer", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(wantsReview(state, finalTurn), true);
	assert.deepEqual([...state.implementerCwds], [CWD]);
});

test("waits while the assistant is still calling tools", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(wantsReview(state, { ...finalTurn, toolCallCount: 1 }), false);
});

test("skips when the reviewer already ran after the last implementer call", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("asks once at the end when implementer ran again after a mid-run review", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(wantsReview(state, finalTurn), true);
	state.requested = true;
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("skips when the review round cap was reached, even with an implementer call after it", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	for (let round = 0; round < MAX_REVIEW_ROUNDS; round++) recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(state.unreviewed, true);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("still asks after one voluntary reviewer round followed by an implementer fix", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(state.reviewerRounds, 1);
	assert.equal(wantsReview(state, finalTurn), true);
});

test("the reviewer round counter resets with initialState", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD);
	assert.equal(state.reviewerRounds, 1);
	assert.equal(initialState().reviewerRounds, 0);
});

test("asks only once per run", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	state.requested = true;
	assert.equal(wantsReview(state, finalTurn), false);
});

test("collects every cwd implementer worked in", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER, cwd: "/other" }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.deepEqual([...state.implementerCwds].sort(), ["/other", CWD]);
});

test("ignores other agents, other tools and malformed input", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: "explorer" }, CWD);
	recordToolResult(state, "edit", { agent: IMPLEMENTER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, undefined, CWD);
	assert.equal(wantsReview(state, finalTurn), false);
});

test("does not continue an aborted or failed run", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(wantsReview(state, { ...finalTurn, outcome: "aborted" }), false);
	assert.equal(wantsReview(state, { ...finalTurn, outcome: "error" }), false);
});

test("requestReason says no reviewer round ran when none did", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
	assert.equal(requestReason(state), "implementer changed the working tree and no `reviewer` round has run yet.");
});

test("requestReason says the change came after the last reviewer round", () => {
	const state = initialState();
	recordToolResult(state, SUBAGENT_TOOL, { agent: REVIEWER }, CWD);
	recordToolResult(state, SUBAGENT_TOOL, { agent: IMPLEMENTER }, CWD);
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
