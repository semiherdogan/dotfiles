import type { ImageContent, Message, TextContent, Tool, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
import { CONTENT, DYNAMIC_TOOL_TYPE, dataUrl, ROLE } from "./protocol.ts";

// Raw Responses API item shapes accepted by thread/inject_items.
const ITEM_MESSAGE = "message";
const PART = { inputText: "input_text", inputImage: "input_image", outputText: "output_text" } as const;

export const SYNC = { toolResults: "toolResults", newTurn: "newTurn", rebuild: "rebuild" } as const;

export type DynamicTool = { type: typeof DYNAMIC_TOOL_TYPE; name: string; description: string; inputSchema: unknown };

/** What Codex already holds for one pi session. */
export type SyncState = {
	/** Number of transcript messages (system messages included) Codex has seen, our last reply included. */
	cursor: number;
	systemPrompt: string;
	toolsKey: string;
	modelId: string;
	/** Tool calls emitted to pi whose results Codex is still waiting for. */
	pendingCallIds: readonly string[];
	turnActive: boolean;
};

export type SyncInput = { systemPrompt: string; toolsKey: string; modelId: string };

export type SyncPlan =
	| { kind: typeof SYNC.toolResults; results: ToolResultMessage[]; steer: UserMessage[] }
	| { kind: typeof SYNC.newTurn; users: UserMessage[] }
	| { kind: typeof SYNC.rebuild; history: Message[]; users: UserMessage[] };

export type HistoryPart =
	| { type: typeof PART.inputText; text: string }
	| { type: typeof PART.inputImage; image_url: string }
	| { type: typeof PART.outputText; text: string };
export type HistoryItem = { type: typeof ITEM_MESSAGE; role: typeof ROLE.user | typeof ROLE.assistant; content: HistoryPart[] };

export function toDynamicTools(tools: readonly Tool[]): DynamicTool[] {
	return tools.map((tool) => ({
		type: DYNAMIC_TOOL_TYPE,
		name: tool.name,
		description: tool.description,
		// Round-trip drops TypeBox symbol metadata so the key below compares declarations only.
		inputSchema: JSON.parse(JSON.stringify(tool.parameters)),
	}));
}

export function toolsKey(tools: readonly DynamicTool[]): string {
	return JSON.stringify(tools);
}

function isUser(message: Message): message is UserMessage {
	return message.role === ROLE.user;
}

function isToolResult(message: Message): message is ToolResultMessage {
	return message.role === ROLE.toolResult;
}

function rebuild(messages: readonly Message[]): SyncPlan {
	const conversation = messages.filter((message) => message.role !== ROLE.system);
	let start = conversation.length;
	while (start > 0 && isUser(conversation[start - 1])) start--;
	return { kind: SYNC.rebuild, history: conversation.slice(0, start), users: conversation.slice(start) as UserMessage[] };
}

/** Decide how to bring Codex in line with pi's transcript: answer pending tool calls, start a turn, or rebuild. */
export function planSync(messages: readonly Message[], input: SyncInput, state: SyncState | undefined): SyncPlan {
	if (!state) return rebuild(messages);
	if (state.systemPrompt !== input.systemPrompt || state.toolsKey !== input.toolsKey || state.modelId !== input.modelId) {
		return rebuild(messages);
	}
	if (state.cursor === 0 || messages.length < state.cursor || messages[state.cursor - 1].role !== ROLE.assistant) {
		return rebuild(messages);
	}

	const trailing = messages.slice(state.cursor).filter((message) => message.role !== ROLE.system);

	if (state.pendingCallIds.length > 0) {
		if (!state.turnActive) return rebuild(messages);
		const results = trailing.slice(0, state.pendingCallIds.length);
		const rest = trailing.slice(state.pendingCallIds.length);
		const expected = new Set(state.pendingCallIds);
		const answered = results.every((message) => isToolResult(message) && expected.delete(message.toolCallId));
		if (!answered || expected.size > 0 || !rest.every(isUser)) return rebuild(messages);
		return { kind: SYNC.toolResults, results: results as ToolResultMessage[], steer: rest as UserMessage[] };
	}

	if (state.turnActive || trailing.length === 0 || !trailing.every(isUser)) return rebuild(messages);
	return { kind: SYNC.newTurn, users: trailing as UserMessage[] };
}

function blocksToParts(content: string | readonly (TextContent | ImageContent)[], images: boolean): HistoryPart[] {
	if (typeof content === "string") return [{ type: PART.inputText, text: content }];
	const parts: HistoryPart[] = [];
	for (const block of content) {
		if (block.type === CONTENT.text) parts.push({ type: PART.inputText, text: block.text });
		else if (images) parts.push({ type: PART.inputImage, image_url: dataUrl(block) });
	}
	return parts;
}

// Tool calls are rendered as text: replaying them as function_call items would tie the history
// to tool names and call ids the current thread may not declare.
export function toHistoryItems(history: readonly Message[], images: boolean): HistoryItem[] {
	const items: HistoryItem[] = [];
	for (const message of history) {
		if (message.role === ROLE.user) {
			const content = blocksToParts(message.content, images);
			if (content.length > 0) items.push({ type: ITEM_MESSAGE, role: ROLE.user, content });
		} else if (message.role === ROLE.assistant) {
			const lines: string[] = [];
			for (const block of message.content) {
				if (block.type === CONTENT.text && block.text) lines.push(block.text);
				else if (block.type === CONTENT.toolCall) {
					lines.push(`[called tool ${block.name} (${block.id}) with ${JSON.stringify(block.arguments)}]`);
				}
			}
			if (lines.length > 0) {
				items.push({ type: ITEM_MESSAGE, role: ROLE.assistant, content: [{ type: PART.outputText, text: lines.join("\n") }] });
			}
		} else if (message.role === ROLE.toolResult) {
			const status = message.isError ? " (error)" : "";
			const header: HistoryPart = {
				type: PART.inputText,
				text: `[result of tool ${message.toolName} (${message.toolCallId})${status}]`,
			};
			items.push({ type: ITEM_MESSAGE, role: ROLE.user, content: [header, ...blocksToParts(message.content, images)] });
		}
	}
	return items;
}
