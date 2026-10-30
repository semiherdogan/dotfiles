import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const AGENT_STATE_ENTRY = "open-agents-state";
const CUSTOM_ENTRY_TYPE = "custom";
const AGENT_NAME_ENV = "PI_OPEN_AGENTS_NAME";
const AGENTS_DIR = path.join(os.homedir(), ".pi", "agent", "agents");
const WRITE_TOOLS = ["edit", "write"];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\s*$/m;
const TOOLS_LIST = /^tools:\s*\[([^\]]*)\]/m;
const TOOLS_LINE = /^tools:/m;
const EDIT_DENY = /^\s+edit:\s*deny\s*$/m;
const WRITE_DENY = /^\s+write:\s*deny\s*$/m;

const MUTATING_COMMANDS = [
	"cp", "mv", "rm", "touch", "mkdir", "rmdir", "ln", "chmod", "chown", "truncate", "install",
	"dd", "curl", "wget", "tar", "unzip", "gzip", "gunzip", "patch", "rsync", "ditto", "unlink", "defaults",
];
// Downloaders only write files with an explicit output flag; plain fetches stay allowed for researcher.
const DOWNLOADERS = new Set(["curl", "wget"]);
const DOWNLOAD_OUTPUT_FLAG = /\s(-o|-O|-J|--output(?:-dir)?|--remote-name)\b/;

const MAX_SNIPPET_LENGTH = 40;

const BLOCK_REASON = [
	"This agent has no edit or write tool, so it must not write files through the shell either: no redirects, heredocs, sed -i, tee, inline scripts, sh -c, or cp/mv/rm/touch/mkdir.",
	"Do not retry and do not work around it.",
	"Do not write a helper script or pipe into an interpreter instead. Delegate the change to the implementer subagent in this turn, or tell the user what needs to change.",
].join(" ");

// Whitespace before /dev/null is tolerated so `cmd > /dev/null` is not flagged.
const HARMLESS_REDIRECTS = /2>&1|1>&2|>&2|(?:&|[12])?>>?\s*\/dev\/null(?![^\s;|&)])/g;
const REDIRECTS = [/(^|[^<>])>{1,2}(?!=)\|?\s*\S+/, /&>>?\s*\S+/, />&\s*[^0-9\s]\S*/, /<>\s*\S+/];
// Quoted delimiters reach this check as empty quotes after stripQuotes.
const HEREDOCS = [/<<-?\s*(?:['"]{2}|['"]?\w+)/, /<<</];
const SHELL_EVAL = [/\b(sh|bash|zsh|dash|ksh|fish)\s+(?:-\S+\s+)*-c\b/, /(?:^|[\s;&|(])(eval)\s/];
const SED_IN_PLACE = /\b(g?sed)\s+(?:-\S+\s+)*(?:--in-place\b|-[a-zA-Z]*i)/;
// Any perl cluster with i or p is treated as suspicious; false positives are acceptable.
const PERL_IN_PLACE = /\bperl\s+(?:-\S+\s+)*-[a-zA-Z0-9]*[ip][a-zA-Z0-9]*\b/;
const TEE = /\btee\b/;
const INLINE_SCRIPT = /\b(python(?:\d+(?:\.\d+)?)?|node|ruby|perl)\s+(?:-\S+\s+)*(-[ce]\b|--eval\b|-p\b|-(?!\S))/;
const PIPED_SCRIPT = /\|\s*(python(?:\d+(?:\.\d+)?)?|node|ruby|perl)\b/;

// Shell operators cannot occur inside quotes, so the operator regexes run on quote-free text.
function stripQuotes(command: string): string {
	return command.replace(/'[^']*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

function firstMatch(patterns: RegExp[], text: string): RegExpExecArray | null {
	for (const pattern of patterns) {
		const match = pattern.exec(text);
		if (match) return match;
	}
	return null;
}

function label(category: string, match: RegExpExecArray): string {
	return `${category} "${match[0].trim().slice(0, MAX_SNIPPET_LENGTH)}"`;
}

export function findViolations(command: string): string[] {
	const violations: string[] = [];

	// The inner command is opaque, and quote stripping would hide a redirect inside sh -c "...".
	const evalMatch = firstMatch(SHELL_EVAL, command);
	if (evalMatch) violations.push(label("shell eval", evalMatch));

	const unquoted = stripQuotes(command);
	const stripped = unquoted.replace(HARMLESS_REDIRECTS, " ");
	const redirect = firstMatch(REDIRECTS, stripped);
	if (redirect) violations.push(label("redirect", redirect));
	const heredoc = firstMatch(HEREDOCS, unquoted);
	if (heredoc) violations.push(label("heredoc", heredoc));

	const sed = SED_IN_PLACE.exec(unquoted);
	if (sed) violations.push(label("sed -i", sed));
	const perl = PERL_IN_PLACE.exec(unquoted);
	if (perl) violations.push(label("perl -i", perl));

	const tee = TEE.exec(unquoted);
	if (tee) violations.push(label("tee", tee));

	const inline = INLINE_SCRIPT.exec(unquoted);
	if (inline) violations.push(label("inline script", inline));
	const piped = PIPED_SCRIPT.exec(unquoted);
	if (piped) violations.push(label("piped interpreter", piped));

	// Every unquoted token is a candidate: quoted text is data (grep patterns, messages), the rest is cheap to over-block.
	const tokens = unquoted
		.replace(/[;&|(){}`'"\n\r\t]/g, " ")
		.split(/\s+/)
		.filter(Boolean)
		.map((token) => token.replace(/^\\/, ""));
	const writesDownload = DOWNLOAD_OUTPUT_FLAG.test(command);
	let mutation: string | undefined;
	for (const token of tokens) {
		mutation = MUTATING_COMMANDS.find(
			(name) => (token === name || token.endsWith(`/${name}`)) && (writesDownload || !DOWNLOADERS.has(name)),
		);
		if (mutation !== undefined) break;
	}
	if (mutation !== undefined) violations.push(`file mutation: ${mutation}`);

	return violations;
}

// getActiveTools() reports edit/write even when the agent cannot call them, so the agent file is the source of truth.
// Order: env first (set only in subagent children, which may carry forked parent entries), then the last session entry.
function resolveAgentName(ctx: ExtensionContext): string | undefined {
	const envName = process.env[AGENT_NAME_ENV];
	if (envName) return envName;

	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as { type?: string; customType?: string; data?: { name?: unknown } };
		if (entry.type === CUSTOM_ENTRY_TYPE && entry.customType === AGENT_STATE_ENTRY) {
			const name = entry.data?.name;
			if (typeof name === "string" && name !== "") return name;
			break;
		}
	}

	return undefined;
}

function isReadOnlyFrontmatter(frontmatter: string): boolean {
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
			if (!event.toolName.includes("bash") && !event.toolName.includes("shell")) return undefined;

			const agentName = resolveAgentName(ctx);
			if (agentName === undefined || !isReadOnlyAgent(agentName)) return undefined;

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
