import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { GitError, inspectPath, repoRoot, type Snapshot, snapshot } from "./git.ts";
import { renderHtml } from "./html.ts";
import { REVIEW_INSTRUCTIONS } from "./prompt.ts";
import { render, SEVERITIES, type Submission, TESTS_STATES, type Validation, validate } from "./report.ts";

const TOOL_NAME = "review_submit";
const COMMAND_NAME = "review-summary";
const REPORT_DIR = join(homedir(), ".local", "share", "change-review");
const LATEST_MARKDOWN = "latest.md";
const LATEST_HTML = "latest.html";
const REPO_DIR_HASH_LENGTH = 8;
const MAC_PLATFORM = "darwin";
const WINDOWS_PLATFORM = "win32";

const Finding = Type.Object({
	severity: StringEnum(SEVERITIES),
	path: Type.String({ description: "Repo-relative path of the current file" }),
	line: Type.Integer({ minimum: 1, description: "Line number in the current (after) version of the file" }),
	endLine: Type.Optional(Type.Integer({ minimum: 1, description: "Last line when the evidence spans several lines" })),
	claim: Type.String({ maxLength: 240, description: "One sentence: what is wrong or risky" }),
	check: Type.String({ maxLength: 240, description: "One concrete action that confirms or clears the claim" }),
});

const Change = Type.Object({
	title: Type.String({ maxLength: 160, description: "Behavior-level description of one change" }),
	files: Type.Array(Type.String(), { minItems: 1, maxItems: 10, description: "Changed files involved" }),
});

const Affected = Type.Object({
	path: Type.String({ description: "Unchanged file that depends on the changed code" }),
	reason: Type.String({ maxLength: 160 }),
});

const Params = Type.Object({
	summary: Type.String({ maxLength: 240, description: "One line: what the change set does" }),
	changes: Type.Array(Change, { minItems: 1, maxItems: 8, description: "What changed, most important first" }),
	findings: Type.Array(Finding, {
		maxItems: 10,
		description: "Risks worth a human look, most severe first. Empty when nothing qualifies.",
	}),
	affected: Type.Optional(Type.Array(Affected, { maxItems: 8 })),
	tests: StringEnum(TESTS_STATES, { description: "Test coverage of this change set" }),
});

function timestamp(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
	return `${day}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function writeReport(
	snap: Snapshot,
	submission: Submission,
	validation: Validation,
	generatedAt: Date,
): { markdownFile: string; htmlFile: string } {
	// Same folder name in two places must not share one report directory.
	const suffix = createHash("sha1").update(snap.root).digest("hex").slice(0, REPO_DIR_HASH_LENGTH);
	const dirName = `${snap.repoName}-${suffix}`;
	const dir = join(REPORT_DIR, dirName);
	mkdirSync(dir, { recursive: true });
	const stamp = timestamp(generatedAt);
	const markdown = render(submission, validation, snap, generatedAt);
	const html = renderHtml({ submission, validation, snapshot: snap, generatedAt, reportId: `${dirName}/${stamp}` });
	const markdownFile = join(dir, `${stamp}.md`);
	const htmlFile = join(dir, `${stamp}.html`);
	writeFileSync(markdownFile, markdown);
	writeFileSync(join(dir, LATEST_MARKDOWN), markdown);
	writeFileSync(htmlFile, html);
	writeFileSync(join(dir, LATEST_HTML), html);
	return { markdownFile, htmlFile };
}

// Chosen by platform: on Debian `open` may be `openvt` and start without error.
function opener(file: string): { command: string; args: string[] } {
	if (process.platform === MAC_PLATFORM) return { command: "open", args: [file] };
	if (process.platform === WINDOWS_PLATFORM) return { command: "cmd", args: ["/c", "start", "", file] };
	return { command: "xdg-open", args: [file] };
}

function openReport(file: string, onFailure: (message: string) => void): void {
	const { command, args } = opener(file);
	const child = spawn(command, args, { detached: true, stdio: "ignore" });
	child.on("error", () => onFailure(`Could not open ${file}: ${command} failed`));
	child.on("spawn", () => child.unref());
}

export default function changeReview(pi: ExtensionAPI) {
	pi.registerTool({
		name: TOOL_NAME,
		label: "Submit change review",
		description:
			"Submit a structured review of the current working tree changes. Validates every path and line against the repository, writes a short markdown report and opens it for the user. Call it only when asked to review the working tree changes.",
		promptSnippet: "Submit a structured, evidence-linked review of the working tree changes",
		promptGuidelines: [
			`Call ${TOOL_NAME} only when the user or a review request asks for a review of the working tree changes; never to narrate ordinary edits.`,
		],
		parameters: Params,
		executionMode: "sequential",
		annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			let snap;
			try {
				snap = await snapshot(ctx.cwd);
			} catch (error) {
				if (error instanceof GitError) throw new Error(error.message);
				throw error;
			}
			if (snap.files.length === 0) throw new Error("Working tree has no changes against HEAD; nothing to review.");

			const validation = validate(params, snap, (path) => inspectPath(snap.root, path));
			if (validation.errors.length > 0) {
				const text = [
					`Review rejected. Fix these and call ${TOOL_NAME} again:`,
					...validation.errors.map((error) => `- ${error}`),
				].join("\n");
				return { content: [{ type: "text", text }], details: { errors: validation.errors }, isError: true };
			}

			const { markdownFile, htmlFile } = writeReport(snap, params, validation, new Date());
			if (ctx.hasUI) openReport(htmlFile, (message) => ctx.ui.notify(message, "warning"));

			const lines = [
				`Review screen: ${htmlFile}`,
				`Markdown: ${markdownFile}`,
				`${validation.findings.length} finding(s) across ${snap.files.length} changed file(s).`,
			];
			if (validation.warnings.length > 0) lines.push("Warnings:", ...validation.warnings.map((warning) => `- ${warning}`));
			return { content: [{ type: "text", text: lines.join("\n") }], details: { file: htmlFile, markdownFile, warnings: validation.warnings } };
		},
	});

	pi.registerCommand(COMMAND_NAME, {
		description: "Ask the agent to review the working tree changes and write a pinpoint report",
		handler: async (args, ctx) => {
			if ((await repoRoot(ctx.cwd)) === undefined) {
				ctx.ui.notify("Not a git repository", "error");
				return;
			}
			const focus = args.trim();
			pi.sendUserMessage(focus ? `${REVIEW_INSTRUCTIONS}\n\nFocus: ${focus}` : REVIEW_INSTRUCTIONS, {
				deliverAs: "followUp",
			});
		},
	});
}
