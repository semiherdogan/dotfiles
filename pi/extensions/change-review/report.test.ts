import assert from "node:assert/strict";
import { test } from "node:test";
import { FILE_STATUS, type Snapshot } from "./git.ts";
import { render, SEVERITY, type Submission, TESTS_STATE, validate } from "./report.ts";

const snapshot: Snapshot = {
	root: "/repo",
	repoName: "repo",
	branch: "main",
	additions: 12,
	deletions: 3,
	diffs: new Map(),
	files: [
		{
			path: "src/auth.ts",
			status: FILE_STATUS.modified,
			additions: 10,
			deletions: 3,
			binary: false,
			lineCount: 80,
			hunks: [{ start: 40, end: 48 }],
		},
		{
			path: "src/new.ts",
			status: FILE_STATUS.untracked,
			additions: 2,
			deletions: 0,
			binary: false,
			lineCount: 2,
			hunks: [{ start: 1, end: 2 }],
		},
		{ path: "src/gone.ts", status: FILE_STATUS.deleted, additions: 0, deletions: 0, binary: false, hunks: [] },
	],
};
const known = new Map([
	["src/auth.ts", { binary: false, lineCount: 80 }],
	["src/new.ts", { binary: false, lineCount: 2 }],
	["src/caller.ts", { binary: false, lineCount: 20 }],
	["logo.png", { binary: true }],
]);
const lookup = (path: string) => known.get(path);

function submission(overrides: Partial<Submission> = {}): Submission {
	return {
		summary: "Moves token checks into middleware.",
		changes: [{ title: "Auth refactor", files: ["src/auth.ts", "src/new.ts"] }],
		findings: [
			{ severity: SEVERITY.low, path: "src/auth.ts", line: 42, claim: "Low thing.", check: "Look." },
			{
				severity: SEVERITY.high,
				path: "src/auth.ts",
				line: 44,
				endLine: 46,
				claim: "next() runs on failure.",
				check: "Send an invalid token.",
			},
		],
		tests: TESTS_STATE.none,
		...overrides,
	};
}

test("valid submission passes and sorts findings by severity", () => {
	const result = validate(submission(), snapshot, lookup);
	assert.deepEqual(result.errors, []);
	assert.deepEqual(
		result.findings.map((finding) => finding.severity),
		[SEVERITY.high, SEVERITY.low],
	);
	assert.equal(
		result.findings.every((finding) => !finding.outsideChange),
		true,
	);
});

test("rejects unknown paths, deleted files, out-of-range lines and bad references", () => {
	const result = validate(
		submission({
			findings: [
				{ severity: SEVERITY.high, path: "src/missing.ts", line: 1, claim: "x", check: "y" },
				{ severity: SEVERITY.high, path: "src/gone.ts", line: 1, claim: "x", check: "y" },
				{ severity: SEVERITY.high, path: "src/auth.ts", line: 81, claim: "x", check: "y" },
				{ severity: SEVERITY.high, path: "src/auth.ts", line: 10, endLine: 5, claim: "x", check: "y" },
			],
			changes: [{ title: "t", files: ["src/caller.ts"] }],
			affected: [{ path: "src/nope.ts", reason: "r" }],
		}),
		snapshot,
		lookup,
	);
	assert.equal(result.errors.length, 6);
	assert.deepEqual(result.findings, []);
});

test("rejects unchanged files with out-of-range lines and binary files", () => {
	const result = validate(
		submission({
			findings: [
				{ severity: SEVERITY.medium, path: "src/caller.ts", line: 21, claim: "x", check: "y" },
				{ severity: SEVERITY.medium, path: "logo.png", line: 1, claim: "x", check: "y" },
			],
		}),
		snapshot,
		lookup,
	);
	assert.equal(result.errors.length, 2);
	assert.deepEqual(result.findings, []);
});

test("flags findings outside the diff as context with a warning", () => {
	const result = validate(
		submission({
			findings: [
				{ severity: SEVERITY.medium, path: "src/auth.ts", line: 5, claim: "x", check: "y" },
				{ severity: SEVERITY.medium, path: "src/caller.ts", line: 3, claim: "x", check: "y" },
			],
		}),
		snapshot,
		lookup,
	);
	assert.deepEqual(result.errors, []);
	assert.equal(result.warnings.length, 2);
	assert.deepEqual(
		result.findings.map((finding) => finding.outsideChange),
		[true, true],
	);
});

test("render produces header, findings, changes and affected sections", () => {
	const input = submission({ affected: [{ path: "src/caller.ts", reason: "imports requireAuth" }] });
	const validation = validate(input, snapshot, lookup);
	const markdown = render(input, validation, snapshot, new Date("2026-10-31T10:00:00Z"));
	assert.match(markdown, /^# Review: main · 3 files · \+12 -3 · 2 findings$/m);
	assert.match(markdown, /🔴 \[`src\/auth\.ts:44-46`\]\(vscode:\/\/file\/repo\/src\/auth\.ts:44\)  next\(\) runs on failure\./);
	assert.match(markdown, /\(\[src\/auth\.ts\]\(vscode:\/\/file\/repo\/src\/auth\.ts\), \[src\/new\.ts\]\(vscode:\/\/file\/repo\/src\/new\.ts\)\)/);
	assert.match(markdown, /Check: Send an invalid token\./);
	assert.match(markdown, /- Tests: none/);
	assert.match(markdown, /## Untouched but affected\n\n- \[`src\/caller\.ts`\]\(vscode:\/\/file\/repo\/src\/caller\.ts\)  imports requireAuth/);
	assert.ok(markdown.indexOf("🔴") < markdown.indexOf("🔵"));
});

test("render percent-encodes paths in file links", () => {
	const spaced: Snapshot = {
		...snapshot,
		files: [
			...snapshot.files,
			{ path: "src/my file.ts", status: FILE_STATUS.added, additions: 1, deletions: 0, binary: false, lineCount: 1, hunks: [{ start: 1, end: 1 }] },
		],
	};
	const input = submission({ findings: [], changes: [{ title: "t", files: ["src/my file.ts"] }] });
	const markdown = render(input, validate(input, spaced, lookup), spaced, new Date());
	assert.ok(markdown.includes("vscode://file/repo/src/my%20file.ts"));
});

test("render says so when nothing is flagged and omits the empty affected section", () => {
	const input = submission({ findings: [] });
	const markdown = render(input, validate(input, snapshot, lookup), snapshot, new Date());
	assert.match(markdown, /## Look at\n\nNothing flagged\./);
	assert.doesNotMatch(markdown, /Untouched but affected/);
});
