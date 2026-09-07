import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ALLOWED_SUBCOMMANDS = new Set(["status", "log", "diff"]);

// Global options that consume the following token, so the subcommand is one further along.
const VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);

const BLOCK_REASON = [
	"Git operations are forbidden for the agent in this project. Only `git status`, `git log` and `git diff` are allowed.",
	"Do not retry, do not work around it, and do not use a wrapper or alias.",
	"Tell the user which git command is needed and why, then let them run it themselves.",
].join(" ");

// Quotes are flattened rather than parsed so that `sh -c "git commit"` is still seen.
function findViolations(command: string): string[] {
	const tokens = command
		.replace(/[;&|(){}`'"\n\r\t]/g, " ")
		.split(/\s+/)
		.filter(Boolean);

	const violations: string[] = [];

	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i] !== "git" && !tokens[i].endsWith("/git")) continue;

		let j = i + 1;
		while (j < tokens.length) {
			const token = tokens[j];
			if (VALUE_OPTIONS.has(token)) {
				j += 2;
				continue;
			}
			if (token.startsWith("-")) {
				j += 1;
				continue;
			}
			break;
		}

		const subcommand = tokens[j];
		if (subcommand === undefined || !ALLOWED_SUBCOMMANDS.has(subcommand)) {
			violations.push(subcommand === undefined ? "git (bare)" : `git ${subcommand}`);
		}
		i = j;
	}

	return violations;
}

export default function gitGuard(pi: ExtensionAPI) {
	pi.on("tool_call", (event) => {
		if (!event.toolName.includes("bash") && !event.toolName.includes("shell")) return undefined;

		const command = (event.input as { command?: unknown }).command;
		if (typeof command !== "string") return undefined;

		const violations = findViolations(command);
		if (violations.length === 0) return undefined;

		return { block: true, reason: `Blocked ${violations.join(", ")}. ${BLOCK_REASON}` };
	});
}
