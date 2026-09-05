import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { type Message, uuidv7 } from "@earendil-works/pi-ai";
import {
	BorderedLoader,
	convertToLlm,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	serializeConversation,
	sessionEntryToContextMessages,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { HANDOFF_SYSTEM_PROMPT } from "./prompt.ts";

const CONTEXT_WARNING_THRESHOLD = 70;
const STATUS_KEY = "context-rollover";
const HANDOFF_MESSAGE_TYPE = "approved-session-handoff";

type GenerationResult = { draft: string } | { error: string } | null;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function getContextMessages(ctx: ExtensionCommandContext): AgentMessage[] {
	return ctx.sessionManager.buildContextEntries().flatMap(sessionEntryToContextMessages);
}

function updateContextStatus(ctx: ExtensionContext): number | null {
	const percent = ctx.getContextUsage()?.percent;
	if (percent === null || percent === undefined) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return null;
	}

	const rounded = Math.round(percent);
	const suffix = percent >= CONTEXT_WARNING_THRESHOLD ? " ⚠" : "";
	ctx.ui.setStatus(STATUS_KEY, `ctx ${rounded}%${suffix}`);
	return percent;
}

async function generateHandoff(
	goal: string,
	messages: AgentMessage[],
	ctx: ExtensionCommandContext,
): Promise<GenerationResult> {
	const model = ctx.model;
	if (!model) {
		return { error: "No model selected" };
	}

	const conversationText = serializeConversation(convertToLlm(messages));
	const continuationGoal = goal || "No additional continuation goal was supplied. Preserve the current task's goal.";

	return ctx.ui.custom<GenerationResult>((tui, theme, _keybindings, done) => {
		const loader = new BorderedLoader(tui, theme, "Generating handoff...");
		loader.onAbort = () => done(null);

		const userMessage: Message = {
			role: "user",
			content: [
				{
					type: "text",
					text: [
						"## Conversation",
						"",
						conversationText,
						"",
						"## Optional continuation goal",
						"",
						continuationGoal,
					].join("\n"),
				},
			],
			timestamp: Date.now(),
		};

		ctx.modelRegistry
			.complete(
				model,
				{ systemPrompt: HANDOFF_SYSTEM_PROMPT, messages: [userMessage] },
				{
					signal: loader.signal,
					cacheRetention: "none",
					sessionId: uuidv7(),
				},
			)
			.then((response) => {
				if (response.stopReason === "aborted") {
					done(null);
					return;
				}

				const draft = response.content
					.filter((content): content is { type: "text"; text: string } => content.type === "text")
					.map((content) => content.text)
					.join("\n")
					.trim();

				if (!draft) {
					done({ error: response.errorMessage || "The model returned an empty handoff" });
					return;
				}

				done({ draft });
			})
			.catch((error: unknown) => done({ error: errorMessage(error) }));

		return loader;
	});
}

export default function contextRollover(pi: ExtensionAPI) {
	let handoffInProgress = false;
	let warningShown = false;

	const prepareHandoff = async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
		if (handoffInProgress) {
			ctx.ui.notify("A handoff is already in progress", "warning");
			return;
		}

		if (ctx.mode !== "tui") {
			ctx.ui.notify("Handoff requires interactive mode", "error");
			return;
		}

		if (!ctx.model) {
			ctx.ui.notify("No model selected", "error");
			return;
		}

		handoffInProgress = true;
		try {
			if (!ctx.isIdle()) {
				await ctx.waitForIdle();
			}

			const messages = getContextMessages(ctx);
			if (messages.length === 0) {
				ctx.ui.notify("No conversation to hand off", "warning");
				return;
			}

			const result = await generateHandoff(args.trim(), messages, ctx);
			if (result === null) {
				ctx.ui.notify("Handoff cancelled", "info");
				return;
			}
			if ("error" in result) {
				ctx.ui.notify(`Handoff generation failed: ${result.error}`, "error");
				return;
			}

			const editedHandoff = await ctx.ui.editor("Review and edit handoff", result.draft);
			if (editedHandoff === undefined) {
				ctx.ui.notify("Handoff cancelled", "info");
				return;
			}
			if (!editedHandoff.trim()) {
				ctx.ui.notify("Handoff cannot be empty", "warning");
				return;
			}

			const confirmed = await ctx.ui.confirm(
				"Start fresh session?",
				"The new session will start using exactly the handoff context you just reviewed. The current transcript will not be copied.",
			);
			if (!confirmed) {
				ctx.ui.notify("Handoff cancelled", "info");
				return;
			}

			const approvedHandoff = editedHandoff;
			const currentSessionFile = ctx.sessionManager.getSessionFile();
			const newSessionResult = await ctx.newSession({
				parentSession: currentSessionFile,
				setup: async (sessionManager) => {
					sessionManager.appendCustomMessageEntry(HANDOFF_MESSAGE_TYPE, approvedHandoff, true);
				},
				withSession: async (replacementCtx) => {
					replacementCtx.ui.notify("Fresh session created from approved handoff", "info");
				},
			});

			if (newSessionResult.cancelled) {
				ctx.ui.notify("New session cancelled", "info");
			}
		} catch (error: unknown) {
			ctx.ui.notify(`Handoff failed: ${errorMessage(error)}`, "error");
		} finally {
			handoffInProgress = false;
		}
	};

	pi.registerCommand("handoff", {
		description: "Prepare, review, and approve a context handoff to a fresh session",
		handler: prepareHandoff,
	});

	pi.registerTool({
		name: "prepare_handoff",
		label: "Prepare handoff",
		description:
			"Prepare a context handoff only when the user explicitly asks for a handoff or context rollover. Context pressure or a context warning alone is never permission to call this tool. The user will review, edit, and explicitly approve the handoff before a fresh session is created.",
		promptSnippet: "Prepare a user-requested, reviewable context handoff",
		promptGuidelines: [
			"Call prepare_handoff only when the user explicitly requests a handoff or context rollover. Never call it based only on context usage.",
		],
		parameters: Type.Object({
			goal: Type.Optional(Type.String({ description: "Optional goal for the fresh session" })),
		}),
		executionMode: "sequential",
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (signal?.aborted) {
				return { content: [{ type: "text", text: "Handoff request cancelled" }], terminate: true };
			}
			if (ctx.mode !== "tui") {
				return {
					content: [{ type: "text", text: "Handoff requires interactive mode" }],
					terminate: true,
				};
			}
			if (handoffInProgress) {
				return { content: [{ type: "text", text: "A handoff is already in progress" }], terminate: true };
			}

			const goal = params.goal?.trim();
			pi.sendUserMessage(`/handoff${goal ? ` ${goal}` : ""}`, {
				deliverAs: "followUp",
				expandPromptTemplates: true,
			});

			return {
				content: [{ type: "text", text: "Handoff preparation started in the interactive UI" }],
				terminate: true,
			};
		},
	});

	pi.on("session_start", (_event, ctx) => {
		warningShown = false;
		updateContextStatus(ctx);
	});

	pi.on("turn_end", (_event, ctx) => {
		const percent = updateContextStatus(ctx);
		if (percent === null) {
			return;
		}

		if (percent < CONTEXT_WARNING_THRESHOLD) {
			warningShown = false;
			return;
		}

		if (!warningShown) {
			ctx.ui.notify(
				`⚠ Context ${Math.round(percent)}%. Rollover recommended after the current atomic step. Auto-compaction is disabled. Run /handoff when ready.`,
				"warning",
			);
			warningShown = true;
		}
	});

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}
