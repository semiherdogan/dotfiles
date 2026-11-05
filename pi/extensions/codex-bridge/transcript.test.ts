import assert from "node:assert/strict";
import { test } from "node:test";
import type { AssistantMessage, Message, SystemMessage, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
import { planSync, SYNC, type SyncState, toDynamicTools, toHistoryItems, toolsKey } from "./transcript.ts";

const INPUT = { systemPrompt: "sys", toolsKey: "[]", modelId: "gpt" };

const system: SystemMessage = { role: "system", content: "sys", timestamp: 0 };
const user = (text: string): UserMessage => ({ role: "user", content: text, timestamp: 0 });
const assistant = (...callIds: string[]): AssistantMessage => ({
	role: "assistant",
	content: [
		{ type: "text", text: "ok" },
		...callIds.map((id) => ({ type: "toolCall" as const, id, name: "read", arguments: { path: "a" } })),
	],
	api: "codex-bridge",
	provider: "codex-bridge",
	model: "gpt",
	usage: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	},
	stopReason: "stop",
	timestamp: 0,
});
const result = (id: string, isError = false): ToolResultMessage => ({
	role: "toolResult",
	toolCallId: id,
	toolName: "read",
	content: [{ type: "text", text: `out ${id}` }],
	isError,
	timestamp: 0,
});

function stateFor(cursor: number, overrides: Partial<SyncState> = {}): SyncState {
	return { cursor, ...INPUT, pendingCallIds: [], turnActive: false, ...overrides };
}

test("no state rebuilds and splits trailing user messages off the history", () => {
	const messages: Message[] = [system, user("a"), assistant(), user("b"), user("c")];
	const plan = planSync(messages, INPUT, undefined);
	assert.equal(plan.kind, SYNC.rebuild);
	if (plan.kind !== SYNC.rebuild) return;
	assert.deepEqual(plan.history, [user("a"), assistant()]);
	assert.deepEqual(plan.users, [user("b"), user("c")]);
});

test("first message of a fresh session rebuilds with empty history", () => {
	const plan = planSync([system, user("hi")], INPUT, undefined);
	assert.deepEqual(plan, { kind: SYNC.rebuild, history: [], users: [user("hi")] });
});

test("matching tool results answer the pending calls in any order", () => {
	const messages: Message[] = [system, user("a"), assistant("c1", "c2"), result("c2"), result("c1")];
	const plan = planSync(messages, INPUT, stateFor(3, { pendingCallIds: ["c1", "c2"], turnActive: true }));
	assert.equal(plan.kind, SYNC.toolResults);
	if (plan.kind !== SYNC.toolResults) return;
	assert.deepEqual(plan.results.map((message) => message.toolCallId), ["c2", "c1"]);
	assert.deepEqual(plan.steer, []);
});

test("user messages after tool results become steering input", () => {
	const messages: Message[] = [system, user("a"), assistant("c1"), result("c1"), user("also this")];
	const plan = planSync(messages, INPUT, stateFor(3, { pendingCallIds: ["c1"], turnActive: true }));
	assert.equal(plan.kind, SYNC.toolResults);
	if (plan.kind !== SYNC.toolResults) return;
	assert.deepEqual(plan.steer, [user("also this")]);
});

test("missing or foreign tool results rebuild", () => {
	const pending = stateFor(3, { pendingCallIds: ["c1", "c2"], turnActive: true });
	assert.equal(planSync([system, user("a"), assistant("c1", "c2"), result("c1")], INPUT, pending).kind, SYNC.rebuild);
	assert.equal(
		planSync([system, user("a"), assistant("c1", "c2"), result("c1"), result("x")], INPUT, pending).kind,
		SYNC.rebuild,
	);
});

test("new user message after a finished turn starts a turn", () => {
	const messages: Message[] = [system, user("a"), assistant(), user("b")];
	assert.deepEqual(planSync(messages, INPUT, stateFor(3)), { kind: SYNC.newTurn, users: [user("b")] });
});

test("mid-transcript system messages are ignored when prompt and tools are unchanged", () => {
	const messages: Message[] = [system, user("a"), assistant(), system, user("b")];
	assert.deepEqual(planSync(messages, INPUT, stateFor(3)), { kind: SYNC.newTurn, users: [user("b")] });
});

test("prompt, tools or model changes rebuild", () => {
	const messages: Message[] = [system, user("a"), assistant(), user("b")];
	assert.equal(planSync(messages, { ...INPUT, systemPrompt: "new" }, stateFor(3)).kind, SYNC.rebuild);
	assert.equal(planSync(messages, { ...INPUT, toolsKey: "[1]" }, stateFor(3)).kind, SYNC.rebuild);
	assert.equal(planSync(messages, { ...INPUT, modelId: "other" }, stateFor(3)).kind, SYNC.rebuild);
});

test("shorter transcript or cursor not on an assistant message rebuilds", () => {
	assert.equal(planSync([system, user("a")], INPUT, stateFor(3)).kind, SYNC.rebuild);
	assert.equal(planSync([system, user("a"), user("b"), user("c")], INPUT, stateFor(3)).kind, SYNC.rebuild);
});

test("no new messages or an idle-state mismatch rebuilds", () => {
	const messages: Message[] = [system, user("a"), assistant()];
	assert.equal(planSync(messages, INPUT, stateFor(3)).kind, SYNC.rebuild);
	assert.equal(planSync([...messages, user("b")], INPUT, stateFor(3, { turnActive: true })).kind, SYNC.rebuild);
});

test("history renders tool calls and results as text messages", () => {
	const items = toHistoryItems([user("a"), assistant("c1"), result("c1", true)], false);
	assert.deepEqual(items, [
		{ type: "message", role: "user", content: [{ type: "input_text", text: "a" }] },
		{
			type: "message",
			role: "assistant",
			content: [{ type: "output_text", text: 'ok\n[called tool read (c1) with {"path":"a"}]' }],
		},
		{
			type: "message",
			role: "user",
			content: [
				{ type: "input_text", text: "[result of tool read (c1) (error)]" },
				{ type: "input_text", text: "out c1" },
			],
		},
	]);
});

test("history keeps images only when the model accepts them", () => {
	const message: UserMessage = {
		role: "user",
		content: [{ type: "image", data: "CCCC", mimeType: "image/png" }],
		timestamp: 0,
	};
	assert.deepEqual(toHistoryItems([message], false), []);
	assert.deepEqual(toHistoryItems([message], true)[0].content, [
		{ type: "input_image", image_url: "data:image/png;base64,CCCC" },
	]);
});

test("dynamic tools copy name, description and schema; key is stable", () => {
	const tools = toDynamicTools([{ name: "read", description: "Read a file", parameters: { type: "object" } }]);
	assert.deepEqual(tools, [{ type: "function", name: "read", description: "Read a file", inputSchema: { type: "object" } }]);
	assert.equal(toolsKey(tools), toolsKey(toDynamicTools([{ name: "read", description: "Read a file", parameters: { type: "object" } }])));
});
