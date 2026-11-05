import type { ImageContent, ModelThinkingLevel, TextContent, ThinkingLevelMap } from "@earendil-works/pi-ai";

// Codex app-server (stdio JSON-RPC without the "jsonrpc" field) method names.
export const METHOD = {
	initialize: "initialize",
	initialized: "initialized",
	modelList: "model/list",
	threadStart: "thread/start",
	threadInjectItems: "thread/inject_items",
	turnStart: "turn/start",
	turnSteer: "turn/steer",
	turnInterrupt: "turn/interrupt",
	threadUnsubscribe: "thread/unsubscribe",
	configRead: "config/read",
	toolCall: "item/tool/call",
	turnStarted: "turn/started",
	turnCompleted: "turn/completed",
	agentMessageDelta: "item/agentMessage/delta",
	reasoningSummaryDelta: "item/reasoning/summaryTextDelta",
	reasoningTextDelta: "item/reasoning/textDelta",
	tokenUsageUpdated: "thread/tokenUsage/updated",
	error: "error",
} as const;

export const TURN_STATUS = {
	completed: "completed",
	interrupted: "interrupted",
	failed: "failed",
	inProgress: "inProgress",
} as const;

// pi-ai message roles and content block types.
export const ROLE = { system: "system", user: "user", assistant: "assistant", toolResult: "toolResult" } as const;
export const CONTENT = { text: "text", image: "image", thinking: "thinking", toolCall: "toolCall" } as const;
export const MODEL_INPUT = { text: "text", image: "image" } as const;

export const USER_INPUT_TYPE = { text: "text", image: "image" } as const;
export const TOOL_OUTPUT_TYPE = { text: "inputText", image: "inputImage" } as const;
export const DYNAMIC_TOOL_TYPE = "function";
export const INPUT_MODALITY_IMAGE = "image";

export const JSONRPC_METHOD_NOT_FOUND = -32601;

export type RpcId = number | string;
export type RpcError = { code?: number; message?: string; data?: unknown };
export type RpcMessage = {
	id?: RpcId;
	method?: string;
	params?: unknown;
	result?: unknown;
	error?: RpcError;
};

export type UserInput =
	| { type: typeof USER_INPUT_TYPE.text; text: string; text_elements: [] }
	| { type: typeof USER_INPUT_TYPE.image; url: string };

export type ToolOutputItem =
	| { type: typeof TOOL_OUTPUT_TYPE.text; text: string }
	| { type: typeof TOOL_OUTPUT_TYPE.image; imageUrl: string };

export type CodexModel = {
	id: string;
	model: string;
	displayName: string;
	hidden: boolean;
	isDefault: boolean;
	defaultReasoningEffort: string;
	supportedReasoningEfforts: { reasoningEffort: string }[];
	inputModalities?: string[];
};

export type TokenUsageBreakdown = {
	inputTokens: number;
	cachedInputTokens: number;
	outputTokens: number;
	reasoningOutputTokens: number;
	totalTokens: number;
};

export type TurnError = { message: string; codexErrorInfo?: unknown; additionalDetails?: string | null };
export type Turn = { id: string; status: string; error?: TurnError | null };

/** Splits newline-delimited JSON into messages; keeps a partial trailing line until its newline arrives. */
export function createLineDecoder(onMessage: (message: RpcMessage) => void, onInvalid: (line: string) => void) {
	let buffer = "";
	return (chunk: string) => {
		buffer += chunk;
		let newline = buffer.indexOf("\n");
		while (newline >= 0) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (line) {
				let parsed: unknown;
				try {
					parsed = JSON.parse(line);
				} catch {
					onInvalid(line);
				}
				if (parsed !== undefined) onMessage(parsed as RpcMessage);
			}
			newline = buffer.indexOf("\n");
		}
	};
}

export function encodeMessage(message: RpcMessage): string {
	return `${JSON.stringify(message)}\n`;
}

export function dataUrl(image: ImageContent): string {
	return `data:${image.mimeType};base64,${image.data}`;
}

export function toToolOutputItems(content: readonly (TextContent | ImageContent)[]): ToolOutputItem[] {
	const items: ToolOutputItem[] = content.map((block) =>
		block.type === CONTENT.image
			? { type: TOOL_OUTPUT_TYPE.image, imageUrl: dataUrl(block) }
			: { type: TOOL_OUTPUT_TYPE.text, text: block.text },
	);
	return items.length > 0 ? items : [{ type: TOOL_OUTPUT_TYPE.text, text: "" }];
}

export function toUserInput(content: string | readonly (TextContent | ImageContent)[], images: boolean): UserInput[] {
	if (typeof content === "string") return [{ type: USER_INPUT_TYPE.text, text: content, text_elements: [] }];
	const input: UserInput[] = [];
	for (const block of content) {
		if (block.type === CONTENT.text) input.push({ type: USER_INPUT_TYPE.text, text: block.text, text_elements: [] });
		else if (images) input.push({ type: USER_INPUT_TYPE.image, url: dataUrl(block) });
	}
	return input;
}

// Pi thinking level -> Codex ReasoningEffort. Codex has no "off"; unmapped levels become unsupported.
const PI_LEVEL_TO_EFFORT: Record<ModelThinkingLevel, string | undefined> = {
	off: undefined,
	minimal: "minimal",
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max",
};

/** Pi levels the model cannot honor map to null, so pi clamps to a supported one. */
export function buildThinkingLevelMap(supportedEfforts: readonly string[]): ThinkingLevelMap {
	const supported = new Set(supportedEfforts);
	const map: ThinkingLevelMap = {};
	for (const [level, effort] of Object.entries(PI_LEVEL_TO_EFFORT) as [ModelThinkingLevel, string | undefined][]) {
		map[level] = effort !== undefined && supported.has(effort) ? effort : null;
	}
	return map;
}

export function effortFor(map: ThinkingLevelMap | undefined, level: ModelThinkingLevel | undefined): string | undefined {
	if (!map || !level) return undefined;
	const effort = map[level];
	return typeof effort === "string" ? effort : undefined;
}
