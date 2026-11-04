import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { findViolations } from "./guard.ts";

const ACTIVE_AGENT_ENTRY = "active_agent";
const CUSTOM_ENTRY_TYPE = "custom";
const AGENT_NAME_ENV = "PI_OPEN_AGENTS_NAME";
const AGENTS_DIR = path.join(os.homedir(), ".pi", "agent", "agents");
const WRITE_TOOLS = ["edit", "write"];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\s*$/m;
const TOOLS_LIST = /^tools:\s*\[([^\]]*)\]/m;
const TOOLS_LINE = /^tools:/m;
const EDIT_DENY = /^\s+edit:\s*deny\s*$/m;
const WRITE_DENY = /^\s+write:\s*deny\s*$/m;
// Explicit marker for a primary that must keep edit/write in its active set (subagent ceiling) but never use them.
const READ_ONLY_FLAG = /^readOnly:\s*true\s*$/m;

const BLOCK_REASON = [
	"This agent must not change files: not with edit or write, and not through the shell (no redirects, heredocs, sed -i, tee, inline scripts, sh -c, or cp/mv/rm/touch/mkdir).",
	"Do not retry and do not work around it.",
	"Do not write a helper script or pipe into an interpreter instead. Delegate the change to the implementer subagent in this turn, or tell the user what needs to change.",
].join(" ");

// getActiveTools() reports edit/write even when the agent cannot call them, so the agent file is the source of truth.
// Order: env first (set only in subagent children, which may carry forked parent entries), then the newest active_agent entry.
// A null name means "(none)"; open-agents-state is not used because it is not written when the agent is cleared.
function resolveAgentName(ctx: ExtensionContext): string | undefined {
	const envName = process.env[AGENT_NAME_ENV];
	if (envName) return envName;

	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as { type?: string; customType?: string; data?: { name?: unknown } };
		if (entry.type === CUSTOM_ENTRY_TYPE && entry.customType === ACTIVE_AGENT_ENTRY) {
			const name = entry.data?.name;
			if (typeof name === "string" && name !== "") return name;
			break;
		}
	}

	return undefined;
}

function isReadOnlyFrontmatter(frontmatter: string): boolean {
	if (READ_ONLY_FLAG.test(frontmatter)) return true;
	const tools = TOOLS_LIST.exec(frontmatter);
	if (tools) {
		const list = tools[1].split(",").map((tool) => tool.trim());
		return !WRITE_TOOLS.some((tool) => list.includes(tool));
	}
	if (TOOLS_LINE.test(frontmatter)) return false;
	return EDIT_DENY.test(frontmatter) && WRITE_DENY.test(frontmatter);
}

const readOnlyCache = new Map<string, boolean>();

function isReadOnlyAgent(name: string): boolean {
	const cached = readOnlyCache.get(name);
	if (cached !== undefined) return cached;

	let text: string;
	try {
		text = fs.readFileSync(path.join(AGENTS_DIR, `${name}.md`), "utf8");
	} catch {
		// Not cached: the file may appear later in the session.
		return false;
	}
	const frontmatter = FRONTMATTER.exec(text);
	const readOnly = frontmatter !== null && text.startsWith("---") && isReadOnlyFrontmatter(frontmatter[1]);
	readOnlyCache.set(name, readOnly);
	return readOnly;
}

export default function writeGuard(pi: ExtensionAPI) {
	pi.on("tool_call", (event, ctx) => {
		// Fail open: a bug in the guard must never block a call.
		try {
			const isShell = event.toolName.includes("bash") || event.toolName.includes("shell");
			const isWriteTool = WRITE_TOOLS.includes(event.toolName);
			if (!isShell && !isWriteTool) return undefined;

			const agentName = resolveAgentName(ctx);
			if (agentName === undefined || !isReadOnlyAgent(agentName)) return undefined;

			if (isWriteTool) return { block: true, reason: `Blocked ${event.toolName} tool. ${BLOCK_REASON}` };

			const input = event.input as { command?: unknown } | null | undefined;
			const command = input?.command;
			if (typeof command !== "string") return undefined;

			const violations = findViolations(command);
			if (violations.length === 0) return undefined;

			return { block: true, reason: `Blocked ${violations.join(", ")}. ${BLOCK_REASON}` };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[write-guard] " + message);
			return undefined;
		}
	});
}
