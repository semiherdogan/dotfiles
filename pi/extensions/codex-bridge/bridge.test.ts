import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import type {
	Api,
	AssistantMessage,
	AssistantMessageEvent,
	AssistantMessageEventStream,
	Message,
	Model,
	SimpleStreamOptions,
	ToolResultMessage,
	UserMessage,
} from "@earendil-works/pi-ai";
import { ABORTED_MESSAGE, type BridgeClient, createBridge, createBridgeState, STOP, TOOL_CALL_SETTLE_MS } from "./bridge.ts";
import type { ClientHandlers, CodexClient } from "./client.ts";
import { METHOD, type RpcId, TURN_STATUS } from "./protocol.ts";

const THREAD_ID = "thread-1";
const FOREIGN_THREAD_ID = "sub-agent-thread";
const UNSUPPORTED_METHOD = "item/commandExecution/requestApproval";
const TURN_ID = "turn-1";
const SESSION_ID = "session-1";
const MCP_SERVER = "node_repl";

const RESULTS: Record<string, unknown> = {
	[METHOD.configRead]: { config: { mcp_servers: { [MCP_SERVER]: {} } } },
	[METHOD.threadStart]: { thread: { id: THREAD_ID } },
	[METHOD.turnStart]: { turn: { id: TURN_ID, status: TURN_STATUS.inProgress } },
};

class FakeClient {
	closed = false;
	readonly requests: { method: string; params: any }[] = [];
	readonly responses: { id: RpcId; result: any }[] = [];
	readonly errors: { id: RpcId; code: number }[] = [];
	/** Requests to a gated method wait until the gate resolves. */
	readonly gates = new Map<string, Promise<void>>();
	readonly generation: number;
	readonly handlers: ClientHandlers;
	constructor(generation: number, handlers: ClientHandlers) {
		this.generation = generation;
		this.handlers = handlers;
	}
	async start(): Promise<void> {}
	async request<T>(method: string, params: unknown): Promise<T> {
		this.requests.push({ method, params });
		await this.gates.get(method);
		if (this.closed) throw new Error("closed");
		return (RESULTS[method] ?? {}) as T;
	}
	respond(id: RpcId, result: unknown): void {
		this.responses.push({ id, result });
	}
	respondError(id: RpcId, code: number): void {
		this.errors.push({ id, code });
	}
	kill(): void {
		this.closed = true;
	}
	methods(): string[] {
		return this.requests.map((request) => request.method);
	}
	notify(method: string, params: Record<string, unknown> = {}): void {
		this.handlers.onNotification({ method, params: { threadId: THREAD_ID, ...params } });
	}
	toolCall(id: RpcId, callId: string, threadId = THREAD_ID): void {
		this.serverRequest({ id, method: METHOD.toolCall, params: { threadId, callId, tool: "read", arguments: { path: callId } } });
	}
	serverRequest(message: { id: RpcId; method: string; params: Record<string, unknown> }): void {
		this.handlers.onServerRequest(this as unknown as CodexClient, message);
	}
	exit(reason: string): void {
		this.closed = true;
		this.handlers.onExit(this as unknown as CodexClient, reason);
	}
}

class FakeStream {
	readonly events: AssistantMessageEvent[] = [];
	ended = false;
	push(event: AssistantMessageEvent): void {
		this.events.push(event);
	}
	end(): void {
		this.ended = true;
	}
	terminals(): AssistantMessageEvent[] {
		return this.events.filter((event) => event.type === "done" || event.type === "error");
	}
}

const model = { id: "gpt", api: "codex-bridge", provider: "codex-bridge", input: ["text"] } as unknown as Model<Api>;
const user = (text: string): UserMessage => ({ role: "user", content: text, timestamp: 0 });
const result = (id: string): ToolResultMessage => ({
	role: "toolResult",
	toolCallId: id,
	toolName: "read",
	content: [{ type: "text", text: `out ${id}` }],
	isError: false,
	timestamp: 0,
});
const tick = () => delay(0);

function setup() {
	let client: FakeClient | undefined;
	const bridge = createBridge(createBridgeState(), {
		spawnClient: (generation, handlers) => (client = new FakeClient(generation, handlers)) as unknown as BridgeClient,
		createStream: () => new FakeStream() as unknown as AssistantMessageEventStream,
		currentSystemPrompt: () => "sys",
		currentTools: () => [],
	});
	const start = (messages: Message[], options: SimpleStreamOptions = {}) =>
		bridge.stream(model, { messages } as never, { sessionId: SESSION_ID, ...options }) as unknown as FakeStream;
	return { bridge, start, client: () => client!, spawned: () => client !== undefined };
}

function terminal(stream: FakeStream): AssistantMessageEvent {
	const terminals = stream.terminals();
	assert.equal(terminals.length, 1);
	assert.ok(stream.ended);
	return terminals[0];
}

test("thread/start disables every MCP server from config/read", async () => {
	const { start, client } = setup();
	start([user("hi")]);
	await tick();
	const threadStart = client().requests.find((request) => request.method === METHOD.threadStart);
	assert.deepEqual(threadStart?.params.config, { mcp_servers: { [MCP_SERVER]: { enabled: false } } });
});

test("two tool calls within the settle window end one stream with toolUse, results resolve them", async () => {
	const { start, client } = setup();
	const first = start([user("hi")]);
	await tick();
	client().toolCall(100, "c1");
	client().toolCall(101, "c2");
	await delay(TOOL_CALL_SETTLE_MS * 2);

	const done = terminal(first);
	assert.equal(done.type, "done");
	assert.equal(done.type === "done" && done.reason, STOP.toolUse);
	const message = done.type === "done" ? done.message : undefined;
	assert.deepEqual(
		message?.content.map((block) => block.type === "toolCall" && block.id),
		["c1", "c2"],
	);

	const second = start([user("hi"), message as AssistantMessage, result("c1"), result("c2")]);
	await tick();
	assert.deepEqual(
		client().responses.map((response) => [response.id, response.result.success]),
		[
			[100, true],
			[101, true],
		],
	);
	assert.equal(client().methods().filter((method) => method === METHOD.turnStart).length, 1);
	client().notify(METHOD.turnCompleted, { turn: { id: TURN_ID, status: TURN_STATUS.completed } });
	await tick();
	const end = terminal(second);
	assert.equal(end.type === "done" && end.reason, STOP.stop);
});

test("server requests from a foreign thread are rejected at once and never reach the active stream", async () => {
	const { start, client } = setup();
	const stream = start([user("hi")]);
	await tick();
	client().toolCall(200, "foreign", FOREIGN_THREAD_ID);
	client().serverRequest({ id: 201, method: UNSUPPORTED_METHOD, params: { threadId: FOREIGN_THREAD_ID } });
	await delay(TOOL_CALL_SETTLE_MS * 2);

	assert.equal(client().responses.length, 1);
	assert.equal(client().responses[0].id, 200);
	assert.equal(client().responses[0].result.success, false);
	assert.match(client().responses[0].result.contentItems[0].text, new RegExp(`${FOREIGN_THREAD_ID} is not a pi-codex-bridge thread`));
	assert.deepEqual(client().errors.map((error) => error.id), [201]);
	assert.ok(!stream.events.some((event) => event.type.startsWith("toolcall")));
	assert.equal(stream.terminals().length, 0);

	client().notify(METHOD.turnCompleted, { turn: { id: TURN_ID, status: TURN_STATUS.completed } });
	await tick();
	assert.equal(terminal(stream).type, "done");
});

test("abort before the stream starts yields one aborted event and no turn/start", async () => {
	const { start, spawned } = setup();
	const controller = new AbortController();
	controller.abort();
	const stream = start([user("hi")], { signal: controller.signal });
	await tick();
	const event = terminal(stream);
	assert.equal(event.type === "error" && event.reason, STOP.aborted);
	assert.ok(!spawned());
});

test("abort during thread/start yields one aborted event and no turn/start", async () => {
	const { start, client } = setup();
	const controller = new AbortController();
	let release!: () => void;
	const stream = start([user("hi")], { signal: controller.signal });
	client().gates.set(METHOD.threadStart, new Promise((resolve) => (release = resolve)));
	await tick();
	controller.abort();
	release();
	await tick();
	const event = terminal(stream);
	assert.equal(event.type === "error" && event.reason, STOP.aborted);
	assert.equal(event.type === "error" && event.error.errorMessage, ABORTED_MESSAGE);
	assert.ok(!client().methods().includes(METHOD.turnStart));
	assert.ok(client().methods().includes(METHOD.threadUnsubscribe));
});

test("abort while turn/start is in flight interrupts the returned turn", async () => {
	const { start, client } = setup();
	const controller = new AbortController();
	let release!: () => void;
	const stream = start([user("hi")], { signal: controller.signal });
	client().gates.set(METHOD.turnStart, new Promise((resolve) => (release = resolve)));
	await tick();
	assert.ok(client().methods().includes(METHOD.turnStart));
	controller.abort();
	release();
	await tick();
	const event = terminal(stream);
	assert.equal(event.type === "error" && event.reason, STOP.aborted);
	const interrupt = client().requests.find((request) => request.method === METHOD.turnInterrupt);
	assert.deepEqual(interrupt?.params, { threadId: THREAD_ID, turnId: TURN_ID });
});

test("abort during setup ends the stream at once, before the pending request settles", async () => {
	const { start, client } = setup();
	const controller = new AbortController();
	const stream = start([user("hi")], { signal: controller.signal });
	client().gates.set(METHOD.configRead, new Promise(() => {}));
	await tick();
	controller.abort();
	const event = terminal(stream);
	assert.equal(event.type === "error" && event.reason, STOP.aborted);
});

test("a late turn/start failure of an aborted stream leaves the next stream's session alone", async () => {
	const { start, client } = setup();
	const controller = new AbortController();
	let fail!: (error: Error) => void;
	const first = start([user("hi")], { signal: controller.signal });
	client().gates.set(METHOD.turnStart, new Promise((_, reject) => (fail = reject)));
	await tick();
	controller.abort();
	const aborted = terminal(first);
	assert.equal(aborted.type === "error" && aborted.reason, STOP.aborted);
	const unsubscribes = () => client().methods().filter((method) => method === METHOD.threadUnsubscribe).length;
	assert.equal(unsubscribes(), 1);

	client().gates.delete(METHOD.turnStart);
	const second = start([user("hi")]);
	await tick();
	fail(new Error("turn/start failed"));
	await tick();
	assert.equal(terminal(first).type, "error");
	assert.equal(second.terminals().length, 0);
	assert.equal(unsubscribes(), 1);

	client().notify(METHOD.turnCompleted, { turn: { id: TURN_ID, status: TURN_STATUS.completed } });
	await tick();
	const end = terminal(second);
	assert.equal(end.type === "done" && end.reason, STOP.stop);
});

test("child exit mid-turn yields one error event", async () => {
	const { start, client } = setup();
	const stream = start([user("hi")]);
	await tick();
	client().notify(METHOD.agentMessageDelta, { itemId: "i1", delta: "partial" });
	await tick();
	client().exit("codex app-server exited");
	await tick();
	const event = terminal(stream);
	assert.equal(event.type === "error" && event.reason, STOP.error);
	assert.equal(event.type === "error" && event.error.errorMessage, "codex app-server exited");
});

test("session shutdown terminates an attached sink and unsubscribes the thread", async () => {
	const { bridge, start, client } = setup();
	const stream = start([user("hi")]);
	await tick();
	bridge.shutdownSession(SESSION_ID);
	await tick();
	const event = terminal(stream);
	assert.equal(event.type === "error" && event.reason, STOP.aborted);
	const unsubscribe = client().requests.find((request) => request.method === METHOD.threadUnsubscribe);
	assert.deepEqual(unsubscribe?.params, { threadId: THREAD_ID });
	assert.ok(client().closed);
});

test("session shutdown keeps the shared client while another run is in flight", async () => {
	const { bridge, start, client } = setup();
	start([user("hi")]);
	client().gates.set(METHOD.configRead, new Promise(() => {}));
	await tick();
	bridge.shutdownSession("other-session");
	assert.ok(!client().closed);
});
