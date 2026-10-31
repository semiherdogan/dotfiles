import { type ChangedFile, FILE_STATUS, type FileInfo, type LineRange, normalizeRepoPath, type Snapshot } from "./git.ts";

export const SEVERITY = { critical: "critical", high: "high", medium: "medium", low: "low" } as const;
export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];
export const SEVERITIES = [SEVERITY.critical, SEVERITY.high, SEVERITY.medium, SEVERITY.low] as const;
export const SEVERITY_ICON: Record<Severity, string> = { critical: "⛔", high: "🔴", medium: "🟡", low: "🔵" };

export const TESTS_STATE = {
	added: "added",
	updated: "updated",
	none: "none",
	notApplicable: "not_applicable",
} as const;
export type TestsState = (typeof TESTS_STATE)[keyof typeof TESTS_STATE];
export const TESTS_STATES = [TESTS_STATE.added, TESTS_STATE.updated, TESTS_STATE.none, TESTS_STATE.notApplicable] as const;
export const TESTS_LABEL: Record<TestsState, string> = {
	added: "added",
	updated: "updated",
	none: "none",
	not_applicable: "not applicable",
};

export type Finding = {
	severity: Severity;
	path: string;
	line: number;
	endLine?: number;
	claim: string;
	check: string;
};
export type Change = { title: string; files: string[] };
export type Affected = { path: string; reason: string };
export type Submission = {
	summary: string;
	changes: Change[];
	findings: Finding[];
	affected?: Affected[];
	tests: TestsState;
};

// A finding whose lines are outside the diff: allowed, but shown as context rather than as a change.
export type ValidatedFinding = Finding & { outsideChange: boolean };
export type Validation = {
	errors: string[];
	warnings: string[];
	findings: ValidatedFinding[];
	affected: Affected[];
};

const OUTSIDE_CHANGE_LABEL = "(outside changed lines)";
const NOTHING_FLAGGED = "Nothing flagged.";
const VSCODE_FILE_SCHEME = "vscode://file";

// vscode://file/<absolute path>:<line> opens the file at that line in VS Code; the root already starts with "/".
export function vscodeLink(root: string, path: string, line?: number): string {
	const target = `${root}/${path}`.split("/").map(encodeURIComponent).join("/");
	return `${VSCODE_FILE_SCHEME}${target}${line === undefined ? "" : `:${line}`}`;
}

function overlaps(hunks: LineRange[], start: number, end: number): boolean {
	return hunks.some((hunk) => hunk.start <= end && start <= hunk.end);
}

export function validate(submission: Submission, snapshot: Snapshot, lookup: (path: string) => FileInfo | undefined): Validation {
	const errors: string[] = [];
	const warnings: string[] = [];
	const changed = new Map<string, ChangedFile>(snapshot.files.map((file) => [file.path, file]));

	const resolvePath = (raw: string, where: string): string | undefined => {
		const path = normalizeRepoPath(raw);
		if (path === undefined) errors.push(`${where}: invalid path "${raw}"`);
		return path;
	};

	const findings: ValidatedFinding[] = [];
	submission.findings.forEach((finding, index) => {
		const where = `findings[${index}]`;
		const path = resolvePath(finding.path, where);
		if (path === undefined) return;
		const end = finding.endLine ?? finding.line;
		if (end < finding.line) {
			errors.push(`${where}: endLine ${end} is before line ${finding.line}`);
			return;
		}
		const file = changed.get(path);
		if (file !== undefined && file.status === FILE_STATUS.deleted) {
			errors.push(`${where}: "${path}" was deleted; reference the caller instead`);
			return;
		}
		const info = file ?? lookup(path);
		if (info === undefined) {
			errors.push(`${where}: "${path}" is neither changed nor present in the repository`);
			return;
		}
		if (info.binary) {
			errors.push(`${where}: "${path}" is binary; line references are not possible`);
			return;
		}
		if (info.lineCount !== undefined && end > info.lineCount) {
			errors.push(`${where}: "${path}" has ${info.lineCount} lines, got ${end}`);
			return;
		}
		const outsideChange = file === undefined || !overlaps(file.hunks, finding.line, end);
		if (file === undefined) warnings.push(`${where}: "${path}" is not part of the change`);
		else if (outsideChange) warnings.push(`${where}: lines ${finding.line}-${end} of "${path}" are outside the diff`);
		findings.push({ ...finding, path, outsideChange });
	});

	submission.changes.forEach((change, index) => {
		change.files.forEach((raw, fileIndex) => {
			const where = `changes[${index}].files[${fileIndex}]`;
			const path = resolvePath(raw, where);
			if (path !== undefined && !changed.has(path)) errors.push(`${where}: "${path}" is not a changed file`);
		});
	});

	const affected: Affected[] = [];
	(submission.affected ?? []).forEach((entry, index) => {
		const where = `affected[${index}]`;
		const path = resolvePath(entry.path, where);
		if (path === undefined) return;
		if (lookup(path) === undefined) {
			errors.push(`${where}: "${path}" does not exist`);
			return;
		}
		if (changed.has(path)) warnings.push(`${where}: "${path}" is a changed file, not an untouched dependent`);
		affected.push({ ...entry, path });
	});

	const rank = (severity: Severity) => SEVERITIES.indexOf(severity);
	findings.sort((a, b) => rank(a.severity) - rank(b.severity));
	return { errors, warnings, findings, affected };
}

function location(finding: Finding): string {
	const end = finding.endLine !== undefined && finding.endLine !== finding.line ? `-${finding.endLine}` : "";
	return `${finding.path}:${finding.line}${end}`;
}

export function render(submission: Submission, validation: Validation, snapshot: Snapshot, generatedAt: Date): string {
	const lines: string[] = [];
	const count = validation.findings.length;
	lines.push(
		`# Review: ${snapshot.branch} · ${snapshot.files.length} files · +${snapshot.additions} -${snapshot.deletions} · ${count} finding${count === 1 ? "" : "s"}`,
	);
	lines.push("", submission.summary, "", "## Look at", "");
	if (count === 0) lines.push(NOTHING_FLAGGED);
	for (const finding of validation.findings) {
		const suffix = finding.outsideChange ? `  ${OUTSIDE_CHANGE_LABEL}` : "";
		// Two trailing spaces keep the check on its own line in rendered markdown.
		lines.push(
			`- ${SEVERITY_ICON[finding.severity]} [\`${location(finding)}\`](${vscodeLink(snapshot.root, finding.path, finding.line)})  ${finding.claim}${suffix}  `,
		);
		lines.push(`  Check: ${finding.check}`);
	}
	lines.push("", "## What changed", "");
	for (const change of submission.changes) lines.push(`- ${change.title}  (${change.files.map((file) => `[${file}](${vscodeLink(snapshot.root, file)})`).join(", ")})`);
	lines.push(`- Tests: ${TESTS_LABEL[submission.tests]}`);
	if (validation.affected.length > 0) {
		lines.push("", "## Untouched but affected", "");
		for (const entry of validation.affected) {
			lines.push(`- [\`${entry.path}\`](${vscodeLink(snapshot.root, entry.path)})  ${entry.reason}`);
		}
	}
	lines.push("", `_${generatedAt.toISOString()} · ${snapshot.root}_`, "");
	return lines.join("\n");
}
