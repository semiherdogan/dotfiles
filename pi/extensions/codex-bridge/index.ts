import * as fs from "node:fs";
import * as path from "node:path";
import { createAssistantMessageEventStream, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";
import { type BridgeState, createBridge, createBridgeState, errorMessage, NONE_SESSION } from "./bridge.ts";
import { CodexClient } from "./client.ts";

const PROVIDER_ID = "codex-bridge";
const API_ID = "codex-bridge";
const NOTIFY_WARNING = "warning";
const STATE_KEY = Symbol.for("pi-codex-bridge.state");

// Shared across module instances: a session loaded by another instance can still route a
// pending tool result into the turn this instance started.
const g = globalThis as Record<symbol, BridgeState | undefined>;
const state: BridgeState = (g[STATE_KEY] ??= createBridgeState());

// pi.getSettings() is unavailable while extensions load, and the provider must register then to
// be visible to --list-models and startup model selection. Only the agent-dir settings are read,
// so an untrusted project cannot choose the binary that gets spawned.
function readCodexPath(): { path?: string; problem?: string } {
	const settingsPath = path.join(getAgentDir(), "settings.json");
	let settings: { codexBridge?: { codexPath?: unknown } };
	try {
		settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
	} catch (error) {
		return { problem: `codex-bridge disabled: cannot read ${settingsPath}: ${errorMessage(error)}` };
	}
	const codexPath = settings.codexBridge?.codexPath;
	if (typeof codexPath !== "string" || !codexPath) {
		return { problem: "codex-bridge disabled: set codexBridge.codexPath in settings to the Codex CLI binary." };
	}
	try {
		fs.accessSync(codexPath, fs.constants.X_OK);
	} catch {
		return { problem: `codex-bridge disabled: codexBridge.codexPath is not executable: ${codexPath}` };
	}
	return { path: codexPath };
}

export default async function codexBridge(pi: ExtensionAPI) {
	let notice: string | undefined;
	let bridge: ReturnType<typeof createBridge> | undefined;

	pi.on("session_start", (_event, ctx) => {
		if (!notice || state.noticeShown || !ctx.hasUI) return;
		state.noticeShown = true;
		ctx.ui.notify(notice, NOTIFY_WARNING);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		bridge?.shutdownSession(ctx.sessionManager.getSessionId() ?? NONE_SESSION);
	});

	const config = readCodexPath();
	if (!config.path) {
		notice = config.problem;
		return;
	}
	const codexPath = config.path;

	bridge = createBridge(state, {
		spawnClient: (generation, handlers) => new CodexClient(codexPath, generation, handlers),
		createStream: createAssistantMessageEventStream,
		currentSystemPrompt: getCurrentSystemPrompt,
		currentTools: getCurrentTools,
	});

	try {
		state.models ??= await bridge.loadModels();
	} catch (error) {
		notice = `codex-bridge disabled: model/list failed: ${errorMessage(error)}`;
		return;
	}

	pi.registerProvider(PROVIDER_ID, {
		name: "Codex (ChatGPT subscription)",
		baseUrl: PROVIDER_ID,
		apiKey: "not-used",
		api: API_ID,
		models: state.models,
		streamSimple: bridge.stream,
	});
}
