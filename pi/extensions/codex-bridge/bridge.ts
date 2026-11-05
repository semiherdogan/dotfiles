import type {
	Api,
	AssistantMessage,
	AssistantMessageEventStream,
	JsonObject,
	Message,
	Model,
	SimpleStreamOptions,
	StopReason,
	Tool,
	TranscriptContext,
	UserMessage,
} from "@earendil-works/pi-ai";
import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { ClientHandlers, CodexClient } from "./client.ts";
import {
	buildThinkingLevelMap,
	CONTENT,
	type CodexModel,
	effortFor,
	INPUT_MODALITY_IMAGE,
	JSONRPC_METHOD_NOT_FOUND,
	METHOD,
	MODEL_INPUT,
	ROLE,
	type RpcId,
	type RpcMessage,
	type TokenUsageBreakdown,
	toToolOutputItems,
	toUserInput,
	type Turn,
	TURN_STATUS,
	USER_INPUT_TYPE,
	type UserInput,
} from "./protocol.ts";
import { type DynamicTool, planSync, SYNC, toDynamicTools, toHistoryItems, toolsKey } from "./transcript.ts";

export const NONE_SESSION = "(none)";
// model/list carries no limits; these match the GPT-5-class Codex models.
const DEFAULT_CONTEXT_WINDOW = 272_000;
const DEFAULT_MAX_TOKENS = 128_000;
const INIT_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;
// Codex can issue several dynamic tool calls for one model step; wait this long for siblings.
export const TOOL_CALL_SETTLE_MS = 100;
const CONTINUE_PROMPT = "Continue.";
export const ABORTED_MESSAGE = "Request aborted";
const SANDBOX_READ_ONLY = "read-only";
const APPROVAL_NEVER = "never";

export const STOP = {
	pending: "pending",
	stop: "stop",
	toolUse: "toolUse",
	error: "error",
	aborted: "aborted",
} as const satisfies Record<string, StopReason>;

type BlockKind = typeof CONTENT.text | typeof CONTENT.thinking;

export type BridgeClient = Pick<CodexClient, "generation" | "closed" | "start" | "request" | "respond" | "respondError" | "kill">;

type Sink = {
	stream: AssistantMessageEventStream;
	output: AssistantMessage;
	model: Model<Api>;
	options: SimpleStreamOptions | undefined;
	started: boolean;
	finished: boolean;
	open?: { kind: BlockKind; key: string; index: number };
	settleTimer?: NodeJS.Timeout;
	onAbort?: () => void;
	/** The session this stream's run() created or used, so a failed run forgets only its own. */
	session?: Session;
};

type ActiveTurn = {
	turnId?: string;
	/** Tool calls emitted to pi, by call id, holding the JSON-RPC request to answer. */
	pending: Map<string, RpcId>;
	queue: RpcMessage[];
	sink?: Sink;
	draining: boolean;
	/** Set once the session forgot this turn; turn/start may still be in flight. */
	cancelled: boolean;
};

type Session = {
	key: string;
	threadId: string;
	generation: number;
	cursor: number;
	systemPrompt: string;
	toolsKey: string;
	modelId: string;
	turn?: ActiveTurn;
};

export type BridgeState = {
	client?: BridgeClient;
	starting?: Promise<BridgeClient>;
	generation: number;
	sessions: Map<string, Session>;
	threads: Map<string, Session>;
	/** Streams that have not emitted their terminal event yet. */
	inFlight: number;
	models?: ProviderModelConfig[];
	exitHookInstalled: boolean;
	noticeShown: boolean;
};

export type BridgeDeps = {
	spawnClient: (generation: number, handlers: ClientHandlers) => BridgeClient;
	createStream: () => AssistantMessageEventStream;
	currentSystemPrompt: (messages: readonly Message[]) => string;
	currentTools: (messages: readonly Message[]) => Tool[];
};

export function createBridgeState(): BridgeState {
	return { generation: 0, sessions: new Map(), threads: new Map(), inFlight: 0, exitHookInstalled: false, noticeShown: false };
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function emptyUsage(): AssistantMessage["usage"] {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function parseArguments(raw: unknown): JsonObject {
	let value = raw;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			return {};
		}
	}
	return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function userInput(users: readonly UserMessage[], images: boolean): UserInput[] {
	const input = users.flatMap((user) => toUserInput(user.content, images));
	return input.length > 0 ? input : [{ type: USER_INPUT_TYPE.text, text: CONTINUE_PROMPT, text_elements: [] }];
}

function ensureStarted(sink: Sink): void {
	if (sink.started) return;
	sink.started = true;
	sink.stream.push({ type: "start", partial: sink.output });
}

function closeOpen(sink: Sink): void {
	const open = sink.open;
	if (!open) return;
	sink.open = undefined;
	const block = sink.output.content[open.index];
	if (block.type === CONTENT.text) {
		sink.stream.push({ type: "text_end", contentIndex: open.index, content: block.text, partial: sink.output });
	} else if (block.type === CONTENT.thinking) {
		sink.stream.push({ type: "thinking_end", contentIndex: open.index, content: block.thinking, partial: sink.output });
	}
}

function appendDelta(sink: Sink, kind: BlockKind, key: string, delta: string): void {
	ensureStarted(sink);
	if (sink.open?.kind !== kind || sink.open.key !== key) {
		closeOpen(sink);
		const index = sink.output.content.length;
		sink.open = { kind, key, index };
		if (kind === CONTENT.text) {
			sink.output.content.push({ type: CONTENT.text, text: "" });
			sink.stream.push({ type: "text_start", contentIndex: index, partial: sink.output });
		} else {
			sink.output.content.push({ type: CONTENT.thinking, thinking: "" });
			sink.stream.push({ type: "thinking_start", contentIndex: index, partial: sink.output });
		}
	}
	const index = sink.open!.index;
	const block = sink.output.content[index];
	if (block.type === CONTENT.text) {
		block.text += delta;
		sink.stream.push({ type: "text_delta", contentIndex: index, delta, partial: sink.output });
	} else if (block.type === CONTENT.thinking) {
		block.thinking += delta;
		sink.stream.push({ type: "thinking_delta", contentIndex: index, delta, partial: sink.output });
	}
}

function setUsage(sink: Sink, last: TokenUsageBreakdown | undefined): void {
	if (!last) return;
	const usage = sink.output.usage;
	usage.cacheRead = last.cachedInputTokens;
	usage.input = Math.max(0, last.inputTokens - last.cachedInputTokens);
	usage.output = last.outputTokens;
	usage.reasoning = last.reasoningOutputTokens;
	usage.totalTokens = last.totalTokens;
}

function detach(turn: ActiveTurn, sink: Sink): void {
	if (turn.sink === sink) turn.sink = undefined;
}

function throwIfAborted(sink: Sink): void {
	// During setup a finished sink can only mean the abort listener already ended it.
	if (sink.finished || sink.options?.signal?.aborted) throw new Error(ABORTED_MESSAGE);
}

export function createBridge(state: BridgeState, deps: BridgeDeps) {
	function finish(sink: Sink, reason: StopReason, error?: string): void {
		if (sink.finished) return;
		sink.finished = true;
		state.inFlight--;
		if (sink.settleTimer) clearTimeout(sink.settleTimer);
		if (sink.onAbort) sink.options?.signal?.removeEventListener("abort", sink.onAbort);
		closeOpen(sink);
		sink.output.stopReason = reason;
		if (reason === STOP.error || reason === STOP.aborted) {
			sink.output.errorMessage = error ?? reason;
			sink.stream.push({ type: "error", reason, error: sink.output });
		} else {
			ensureStarted(sink);
			sink.stream.push({ type: "done", reason: reason === STOP.toolUse ? STOP.toolUse : STOP.stop, message: sink.output });
		}
		sink.stream.end();
	}

	async function ensureClient(): Promise<BridgeClient> {
		if (state.client && !state.client.closed) return state.client;
		if (state.starting) return state.starting;
		if (!state.exitHookInstalled) {
			state.exitHookInstalled = true;
			process.once("exit", () => state.client?.kill());
		}
		const client = deps.spawnClient(++state.generation, {
			onNotification: routeNotification,
			onServerRequest: routeServerRequest,
			onExit: handleClientExit,
		});
		state.starting = client
			.start(INIT_TIMEOUT_MS)
			.then(() => {
				state.client = client;
				return client;
			})
			.catch((error) => {
				client.kill();
				throw error;
			})
			.finally(() => {
				state.starting = undefined;
			});
		return state.starting;
	}

	function handleClientExit(client: { generation: number }, reason: string): void {
		if (state.client?.generation === client.generation) state.client = undefined;
		for (const session of [...state.sessions.values()]) {
			if (session.generation !== client.generation) continue;
			const sink = session.turn?.sink;
			if (sink) finish(sink, STOP.error, reason);
			forgetSession(session);
		}
	}

	async function loadModels(): Promise<ProviderModelConfig[]> {
		const client = await ensureClient();
		const models: CodexModel[] = [];
		let cursor: string | null | undefined;
		do {
			const page = await client.request<{ data: CodexModel[]; nextCursor?: string | null }>(
				METHOD.modelList,
				{ includeHidden: false, cursor },
				INIT_TIMEOUT_MS,
			);
			models.push(...page.data);
			cursor = page.nextCursor;
		} while (cursor);

		return models
			.filter((model) => !model.hidden)
			.map((model) => {
				const efforts = model.supportedReasoningEfforts.map((option) => option.reasoningEffort);
				const images = model.inputModalities?.includes(INPUT_MODALITY_IMAGE) ?? false;
				return {
					id: model.model,
					name: model.displayName,
					input: images ? [MODEL_INPUT.text, MODEL_INPUT.image] : [MODEL_INPUT.text],
					reasoning: efforts.length > 0,
					thinkingLevelMap: efforts.length > 0 ? buildThinkingLevelMap(efforts) : undefined,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					contextWindow: DEFAULT_CONTEXT_WINDOW,
					maxTokens: DEFAULT_MAX_TOKENS,
				} satisfies ProviderModelConfig;
			});
	}

	function routeNotification(message: RpcMessage): void {
		const threadId = (message.params as { threadId?: string } | undefined)?.threadId;
		const turn = threadId ? state.threads.get(threadId)?.turn : undefined;
		if (!turn) return;
		turn.queue.push(message);
		void drain(turn);
	}

	// Answered by the client that sent it, so a request is never left pending, even mid-startup.
	function routeServerRequest(client: Pick<BridgeClient, "respond" | "respondError">, message: RpcMessage): void {
		if (message.id === undefined) return;
		if (message.method !== METHOD.toolCall) {
			client.respondError(message.id, JSONRPC_METHOD_NOT_FOUND, `${message.method} is not supported by pi-codex-bridge`);
			return;
		}
		const threadId = (message.params as { threadId?: string } | undefined)?.threadId;
		const session = threadId ? state.threads.get(threadId) : undefined;
		const turn = session?.turn;
		if (!turn) {
			// Sub-agent or other foreign threads must never reach a pi session's stream.
			const text = session
				? "No active pi turn."
				: `Thread ${threadId ?? "(missing)"} is not a pi-codex-bridge thread; its tool calls are not served.`;
			client.respond(message.id, { contentItems: toToolOutputItems([{ type: CONTENT.text, text }]), success: false });
			return;
		}
		turn.queue.push(message);
		void drain(turn);
	}

	function scheduleSettle(turn: ActiveTurn, sink: Sink): void {
		if (sink.settleTimer) clearTimeout(sink.settleTimer);
		sink.settleTimer = setTimeout(() => {
			if (turn.sink !== sink || sink.finished) return;
			if (turn.draining || turn.queue.length > 0) {
				scheduleSettle(turn, sink);
				return;
			}
			detach(turn, sink);
			finish(sink, STOP.toolUse);
		}, TOOL_CALL_SETTLE_MS);
	}

	function handleToolCall(turn: ActiveTurn, sink: Sink, message: RpcMessage): void {
		const params = message.params as { callId: string; tool: string; arguments: unknown };
		ensureStarted(sink);
		closeOpen(sink);
		const toolCall = { type: CONTENT.toolCall, id: params.callId, name: params.tool, arguments: parseArguments(params.arguments) };
		const index = sink.output.content.length;
		sink.output.content.push(toolCall);
		sink.stream.push({ type: "toolcall_start", contentIndex: index, partial: sink.output });
		sink.stream.push({ type: "toolcall_delta", contentIndex: index, delta: JSON.stringify(toolCall.arguments), partial: sink.output });
		sink.stream.push({ type: "toolcall_end", contentIndex: index, toolCall, partial: sink.output });
		turn.pending.set(params.callId, message.id!);
		scheduleSettle(turn, sink);
	}

	function handleTurnCompleted(session: Session, turn: ActiveTurn, sink: Sink, completed: Turn): void {
		session.turn = undefined;
		detach(turn, sink);
		if (completed.status === TURN_STATUS.completed) {
			finish(sink, STOP.stop);
			return;
		}
		// A failed or interrupted turn leaves Codex's history out of step with pi's; rebuild next time.
		forgetSession(session);
		if (completed.status === TURN_STATUS.interrupted) finish(sink, STOP.aborted, ABORTED_MESSAGE);
		else finish(sink, STOP.error, completed.error?.message ?? `turn ${completed.status}`);
	}

	function handle(turn: ActiveTurn, sink: Sink, message: RpcMessage): void {
		const params = (message.params ?? {}) as Record<string, unknown>;
		switch (message.method) {
			case METHOD.agentMessageDelta:
				appendDelta(sink, CONTENT.text, String(params.itemId), String(params.delta ?? ""));
				break;
			case METHOD.reasoningSummaryDelta:
				appendDelta(sink, CONTENT.thinking, `${params.itemId}:summary:${params.summaryIndex}`, String(params.delta ?? ""));
				break;
			case METHOD.reasoningTextDelta:
				appendDelta(sink, CONTENT.thinking, `${params.itemId}:text:${params.contentIndex}`, String(params.delta ?? ""));
				break;
			case METHOD.tokenUsageUpdated:
				setUsage(sink, (params.tokenUsage as { last?: TokenUsageBreakdown } | undefined)?.last);
				break;
			case METHOD.turnStarted:
				turn.turnId ??= (params.turn as Turn | undefined)?.id;
				break;
			case METHOD.toolCall:
				handleToolCall(turn, sink, message);
				break;
			case METHOD.turnCompleted: {
				const session = state.threads.get(String(params.threadId));
				if (session) handleTurnCompleted(session, turn, sink, params.turn as Turn);
				break;
			}
		}
	}

	async function drain(turn: ActiveTurn): Promise<void> {
		if (turn.draining) return;
		turn.draining = true;
		try {
			while (turn.queue.length > 0 && turn.sink && !turn.sink.finished) {
				const sink = turn.sink;
				const message = turn.queue.shift()!;
				try {
					await sink.options?.onProviderStreamEvent?.(message, sink.model);
				} catch (error) {
					console.error(`[codex-bridge] onProviderStreamEvent failed: ${errorMessage(error)}`);
				}
				if (turn.sink === sink && !sink.finished) handle(turn, sink, message);
			}
		} finally {
			turn.draining = false;
		}
	}

	function failPendingCalls(turn: ActiveTurn, reason: string, client: BridgeClient | undefined): void {
		for (const requestId of turn.pending.values()) {
			client?.respond(requestId, { contentItems: toToolOutputItems([{ type: CONTENT.text, text: reason }]), success: false });
		}
		turn.pending.clear();
		for (const message of turn.queue) {
			if (message.method === METHOD.toolCall && message.id !== undefined) {
				client?.respond(message.id, { contentItems: toToolOutputItems([{ type: CONTENT.text, text: reason }]), success: false });
			}
		}
		turn.queue = [];
	}

	function interrupt(client: BridgeClient, threadId: string, turnId: string): void {
		client.request(METHOD.turnInterrupt, { threadId, turnId }, REQUEST_TIMEOUT_MS).catch(() => {});
	}

	function forgetSession(session: Session): void {
		if (state.sessions.get(session.key) === session) state.sessions.delete(session.key);
		state.threads.delete(session.threadId);
		const client = state.client?.generation === session.generation ? state.client : undefined;
		const turn = session.turn;
		session.turn = undefined;
		if (turn) {
			turn.cancelled = true;
			const sink = turn.sink;
			if (sink) {
				detach(turn, sink);
				finish(sink, STOP.aborted, ABORTED_MESSAGE);
			}
			failPendingCalls(turn, ABORTED_MESSAGE, client);
			if (turn.turnId && client) interrupt(client, session.threadId, turn.turnId);
		}
		client?.request(METHOD.threadUnsubscribe, { threadId: session.threadId }, REQUEST_TIMEOUT_MS).catch(() => {});
	}

	function attach(turn: ActiveTurn, sink: Sink): void {
		turn.sink = sink;
		const onAbort = () => {
			const session = [...state.sessions.values()].find((candidate) => candidate.turn === turn);
			detach(turn, sink);
			if (session) forgetSession(session);
			else failPendingCalls(turn, ABORTED_MESSAGE, state.client);
			finish(sink, STOP.aborted, ABORTED_MESSAGE);
		};
		const signal = sink.options?.signal;
		// Replaces the setup listener registered in stream().
		if (sink.onAbort) signal?.removeEventListener("abort", sink.onAbort);
		sink.onAbort = onAbort;
		if (signal?.aborted) onAbort();
		else signal?.addEventListener("abort", onAbort, { once: true });
	}

	async function startTurn(client: BridgeClient, session: Session, sink: Sink, users: readonly UserMessage[]): Promise<void> {
		const images = sink.model.input.includes(INPUT_MODALITY_IMAGE);
		let params: unknown = {
			threadId: session.threadId,
			input: userInput(users, images),
			model: sink.model.id,
			effort: effortFor(sink.model.thinkingLevelMap, sink.options?.reasoning),
		};
		params = (await sink.options?.onPayload?.(params, sink.model)) ?? params;
		throwIfAborted(sink);
		const turn: ActiveTurn = { pending: new Map(), queue: [], draining: false, cancelled: false };
		session.turn = turn;
		attach(turn, sink);
		const response = await client.request<{ turn: Turn }>(METHOD.turnStart, params, REQUEST_TIMEOUT_MS);
		turn.turnId ??= response.turn.id;
		// Aborted while turn/start was in flight: forgetSession could not interrupt without the id.
		if (turn.cancelled) {
			interrupt(client, session.threadId, turn.turnId);
			return;
		}
		ensureStarted(sink);
		void drain(turn);
	}

	// Codex merges config tables, so mcp_servers={} cannot clear them; disable each server
	// visible from cwd (user and project layers) instead.
	async function disabledMcpServers(client: BridgeClient, cwd: string): Promise<Record<string, { enabled: false }>> {
		const response = await client.request<{ config: { mcp_servers?: Record<string, unknown> | null } }>(
			METHOD.configRead,
			{ cwd, includeLayers: false },
			REQUEST_TIMEOUT_MS,
		);
		const names = Object.keys(response.config.mcp_servers ?? {});
		return Object.fromEntries(names.map((name) => [name, { enabled: false }]));
	}

	async function startThread(
		client: BridgeClient,
		key: string,
		sink: Sink,
		systemPrompt: string,
		tools: DynamicTool[],
		history: Parameters<typeof toHistoryItems>[0],
	): Promise<Session> {
		const { model } = sink;
		const cwd = process.cwd();
		const mcpServers = await disabledMcpServers(client, cwd);
		throwIfAborted(sink);
		const response = await client.request<{ thread: { id: string } }>(
			METHOD.threadStart,
			{
				cwd,
				ephemeral: true,
				approvalPolicy: APPROVAL_NEVER,
				sandbox: SANDBOX_READ_ONLY,
				baseInstructions: systemPrompt,
				dynamicTools: tools,
				model: model.id,
				config: { mcp_servers: mcpServers },
			},
			REQUEST_TIMEOUT_MS,
		);
		const threadId = response.thread.id;
		const session: Session = {
			key,
			threadId,
			generation: client.generation,
			cursor: 0,
			systemPrompt,
			toolsKey: toolsKey(tools),
			modelId: model.id,
		};
		// Registered before the remaining awaits so a failure or abort below can still unsubscribe it.
		state.sessions.set(key, session);
		state.threads.set(threadId, session);
		sink.session = session;
		const items = toHistoryItems(history, model.input.includes(INPUT_MODALITY_IMAGE));
		if (items.length > 0) await client.request(METHOD.threadInjectItems, { threadId, items }, REQUEST_TIMEOUT_MS);
		throwIfAborted(sink);
		return session;
	}

	async function run(sink: Sink, context: TranscriptContext): Promise<void> {
		const { model, options } = sink;
		const client = await ensureClient();
		throwIfAborted(sink);
		const key = options?.sessionId ?? NONE_SESSION;
		let session = state.sessions.get(key);
		if (session && session.generation !== client.generation) {
			forgetSession(session);
			session = undefined;
		}

		const systemPrompt = deps.currentSystemPrompt(context.messages);
		const tools = toDynamicTools(deps.currentTools(context.messages));
		const plan = planSync(
			context.messages,
			{ systemPrompt, toolsKey: toolsKey(tools), modelId: model.id },
			session && {
				cursor: session.cursor,
				systemPrompt: session.systemPrompt,
				toolsKey: session.toolsKey,
				modelId: session.modelId,
				pendingCallIds: [...(session.turn?.pending.keys() ?? [])],
				turnActive: session.turn !== undefined,
			},
		);
		// The assistant message this stream produces is appended right after the current transcript.
		const cursor = context.messages.length + 1;

		if (plan.kind === SYNC.toolResults && session?.turn) {
			const turn = session.turn;
			sink.session = session;
			session.cursor = cursor;
			attach(turn, sink);
			if (sink.finished) return;
			ensureStarted(sink);
			if (plan.steer.length > 0 && turn.turnId) {
				const images = model.input.includes(INPUT_MODALITY_IMAGE);
				await client.request(
					METHOD.turnSteer,
					{ threadId: session.threadId, expectedTurnId: turn.turnId, input: userInput(plan.steer, images) },
					REQUEST_TIMEOUT_MS,
				);
			}
			for (const result of plan.results) {
				const requestId = turn.pending.get(result.toolCallId);
				if (requestId === undefined) continue;
				turn.pending.delete(result.toolCallId);
				client.respond(requestId, { contentItems: toToolOutputItems(result.content), success: !result.isError });
			}
			void drain(turn);
			return;
		}

		if (plan.kind === SYNC.newTurn && session) {
			sink.session = session;
			session.cursor = cursor;
			await startTurn(client, session, sink, plan.users);
			return;
		}

		if (session) forgetSession(session);
		const history = plan.kind === SYNC.rebuild ? plan.history : [];
		const users = plan.kind === SYNC.rebuild ? plan.users : [];
		session = await startThread(client, key, sink, systemPrompt, tools, history);
		session.cursor = cursor;
		await startTurn(client, session, sink, users);
	}

	function stream(model: Model<Api>, context: TranscriptContext, options?: SimpleStreamOptions): AssistantMessageEventStream {
		const sink: Sink = {
			stream: deps.createStream(),
			model,
			options,
			started: false,
			finished: false,
			output: {
				role: ROLE.assistant,
				content: [],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: emptyUsage(),
				stopReason: STOP.pending,
				timestamp: Date.now(),
			},
		};
		state.inFlight++;
		if (options?.signal?.aborted) {
			finish(sink, STOP.aborted, ABORTED_MESSAGE);
			return sink.stream;
		}
		// Ends the stream on Esc during setup; attach() swaps in the turn-level listener.
		sink.onAbort = () => finish(sink, STOP.aborted, ABORTED_MESSAGE);
		options?.signal?.addEventListener("abort", sink.onAbort, { once: true });
		run(sink, context).catch((error) => {
			// Finish first: forgetSession would otherwise end this sink as aborted.
			if (options?.signal?.aborted) finish(sink, STOP.aborted, ABORTED_MESSAGE);
			else finish(sink, STOP.error, errorMessage(error));
			// Setup failed midway, so Codex's view of this session is unknown; rebuild next time.
			// Only our own session: a stream started after an abort may own the key by now.
			const session = sink.session;
			if (session && state.sessions.get(session.key) === session) forgetSession(session);
		});
		return sink.stream;
	}

	function shutdownSession(key: string): void {
		const session = state.sessions.get(key);
		if (session) forgetSession(session);
		// Other pi sessions in this process may still be streaming through the shared client.
		if (state.sessions.size === 0 && state.inFlight === 0) state.client?.kill();
	}

	return { stream, loadModels, shutdownSession };
}
