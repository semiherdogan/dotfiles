export type ModelRef = { provider: string; model: string };

export const AGENT_STATE = {
	starting: "starting",
	running: "running",
	done: "done",
	error: "error",
} as const;
export type AgentState = (typeof AGENT_STATE)[keyof typeof AGENT_STATE];

// Progress status values emitted by pi-open-agents in tool_execution_update details.
export const PROGRESS_STATUS = { running: "running", done: "done", error: "error" } as const;

export type AgentStatus = {
	name: string;
	resolved?: ModelRef;
	// Model id the child actually answered with, kept only when it differs from the resolved one.
	reportedModel?: string;
	state: AgentState;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\s*$/m;
const MODEL_LINE = /^model:[ \t]*(.*?)[ \t]*$/m;
const QUOTES = /^["']|["']$/g;
const UNKNOWN_PROVIDER = "?";
const UNKNOWN_MODEL = "model?";

// "provider/model-id"; the model part may itself contain slashes (openrouter/anthropic/claude-...).
export function parseModelRef(value: unknown): ModelRef | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	const slash = trimmed.indexOf("/");
	if (slash <= 0 || slash === trimmed.length - 1) return undefined;
	return { provider: trimmed.slice(0, slash), model: trimmed.slice(slash + 1) };
}

export function modelFromFrontmatter(text: string): string | undefined {
	if (!text.startsWith("---")) return undefined;
	const frontmatter = FRONTMATTER.exec(text);
	if (!frontmatter) return undefined;
	const line = MODEL_LINE.exec(frontmatter[1]);
	if (!line) return undefined;
	const value = line[1].replace(QUOTES, "");
	return value === "" ? undefined : value;
}

// Same precedence as pi-open-agents: per-call override, then agent files in priority order (project before global).
export function pickModel(override: unknown, agentFiles: Array<string | undefined>): ModelRef | undefined {
	const fromOverride = parseModelRef(override);
	if (fromOverride) return fromOverride;
	for (const text of agentFiles) {
		if (text === undefined) continue;
		const model = modelFromFrontmatter(text);
		if (model !== undefined) return parseModelRef(model);
	}
	return undefined;
}

export type Paint = (color: "accent" | "dim" | "success" | "error" | "warning", text: string) => string;

export function formatRow(agent: AgentStatus, paint: Paint): string {
	const marker =
		agent.state === AGENT_STATE.done
			? paint("success", "✓")
			: agent.state === AGENT_STATE.error
				? paint("error", "✗")
				: paint("accent", "●");
	const name = paint("accent", agent.name);
	if (!agent.resolved) {
		return `${marker} ${name} ${paint("warning", `${UNKNOWN_PROVIDER}/${agent.reportedModel ?? UNKNOWN_MODEL}`)}`;
	}
	const model = `${agent.resolved.provider}/${agent.reportedModel ?? agent.resolved.model}`;
	return `${marker} ${name} ${paint("dim", model)}`;
}

export function formatStatus(agents: Iterable<AgentStatus>, paint: Paint): string | undefined {
	const rows = [...agents].map((agent) => formatRow(agent, paint));
	return rows.length === 0 ? undefined : rows.join(paint("dim", " · "));
}
