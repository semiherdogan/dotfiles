import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { findViolations } from "./guard.ts";

const BLOCK_REASON = [
	"Git is restricted for the agent in this project. Read-only inspection is allowed (status, log, diff, show, grep, blame, branch/tag listing, config reads).",
	"Anything that changes the working tree, index, refs, config, stash or remote state is forbidden.",
	"Do not retry, do not work around it, and do not use a wrapper or alias.",
	"Tell the user which git command is needed and why, then let them run it themselves.",
].join(" ");

export default function gitGuard(pi: ExtensionAPI) {
	pi.on("tool_call", (event) => {
		try {
			if (!event.toolName.includes("bash") && !event.toolName.includes("shell")) return undefined;

			const command = (event.input as { command?: unknown }).command;
			if (typeof command !== "string") return undefined;

			const violations = findViolations(command);
			if (violations.length === 0) return undefined;

			return { block: true, reason: `Blocked ${violations.join(", ")}. ${BLOCK_REASON}` };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[git-guard] " + message);
			return undefined;
		}
	});
}
