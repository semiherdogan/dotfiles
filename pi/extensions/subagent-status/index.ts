import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { AGENT_STATE, type AgentStatus, formatStatus, parseModelRef, pickModel, PROGRESS_STATUS } from "./resolve.ts";

const STATUS_KEY = "subagent-status";
const SUBAGENT_TOOL = "subagent";
const FALLBACK_AGENT_NAME = "subagent";
const COMPLETED_VISIBLE_MS = 5_000;
const GLOBAL_AGENTS_DIR = path.join(os.homedir(), ".pi", "agent", "agents");
const PROJECT_AGENTS_DIR = path.join(".pi", "agents");

function record(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function readOptional(file: string): string | undefined {
	try {
		return fs.readFileSync(file, "utf8");
	} catch {
		return undefined;
	}
}

export default function subagentStatus(pi: ExtensionAPI) {
	const agents = new Map<string, AgentStatus>();
	const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
	// Keyed by cwd and name: project agent files override global ones, and neither changes within a session.
	const agentFileCache = new Map<string, Array<string | undefined>>();
	let latestCtx: ExtensionContext | undefined;

	function agentFiles(cwd: string, name: string): Array<string | undefined> {
		const key = `${cwd}\0${name}`;
		let files = agentFileCache.get(key);
		if (!files) {
			files = [
				readOptional(path.join(cwd, PROJECT_AGENTS_DIR, `${name}.md`)),
				readOptional(path.join(GLOBAL_AGENTS_DIR, `${name}.md`)),
			];
			agentFileCache.set(key, files);
		}
		return files;
	}

	function render() {
		if (!latestCtx?.hasUI) return;
		const theme = latestCtx.ui.theme;
		latestCtx.ui.setStatus(STATUS_KEY, formatStatus(agents.values(), (color, text) => theme.fg(color, text)));
	}

	function clearTimer(id: string) {
		const timer = cleanupTimers.get(id);
		if (timer) clearTimeout(timer);
		cleanupTimers.delete(id);
	}

	function reset() {
		for (const timer of cleanupTimers.values()) clearTimeout(timer);
		cleanupTimers.clear();
		agents.clear();
		agentFileCache.clear();
		render();
	}

	pi.on("session_start", (_event, ctx) => {
		latestCtx = ctx;
		reset();
	});

	pi.on("tool_execution_start", (event, ctx) => {
		latestCtx = ctx;
		if (event.toolName !== SUBAGENT_TOOL) return;
		const args = record(event.args) ?? {};
		const name = typeof args.agent === "string" ? args.agent : FALLBACK_AGENT_NAME;
		clearTimer(event.toolCallId);
		agents.set(event.toolCallId, {
			name,
			resolved: pickModel(args.model, agentFiles(ctx.cwd, name)),
			state: AGENT_STATE.starting,
		});
		render();
	});

	pi.on("tool_execution_update", (event, ctx) => {
		latestCtx = ctx;
		if (event.toolName !== SUBAGENT_TOOL) return;
		const current = agents.get(event.toolCallId);
		if (!current) return;
		const details = record(record(event.partialResult)?.details);
		if (details) {
			if (typeof details.model === "string") {
				// pi-open-agents reports provider/model only until the child answers, then a bare id.
				const parsed = parseModelRef(details.model);
				if (parsed && !current.resolved) current.resolved = parsed;
				const reported = parsed?.model ?? details.model;
				current.reportedModel = reported === current.resolved?.model ? undefined : reported;
			}
			if (details.status === PROGRESS_STATUS.running) current.state = AGENT_STATE.running;
			if (details.status === PROGRESS_STATUS.error) current.state = AGENT_STATE.error;
		}
		render();
	});

	pi.on("tool_execution_end", (event, ctx) => {
		latestCtx = ctx;
		if (event.toolName !== SUBAGENT_TOOL) return;
		const current = agents.get(event.toolCallId);
		if (!current) return;
		current.state = event.isError ? AGENT_STATE.error : AGENT_STATE.done;
		clearTimer(event.toolCallId);
		cleanupTimers.set(
			event.toolCallId,
			setTimeout(() => {
				agents.delete(event.toolCallId);
				cleanupTimers.delete(event.toolCallId);
				render();
			}, COMPLETED_VISIBLE_MS),
		);
		render();
	});

	pi.on("session_shutdown", () => reset());
}
