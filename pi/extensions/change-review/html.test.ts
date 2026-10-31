import assert from "node:assert/strict";
import { test } from "node:test";
import { parseUnifiedDiff } from "./diff.ts";
import { FILE_STATUS, type Snapshot } from "./git.ts";
import { renderHtml } from "./html.ts";
import { SEVERITY, type Submission, TESTS_STATE, type ValidatedFinding, type Validation } from "./report.ts";

const DIFF = [
	"diff --git a/src/auth.ts b/src/auth.ts",
	"--- a/src/auth.ts",
	"+++ b/src/auth.ts",
	"@@ -1,3 +1,4 @@",
	" first",
	"+<img onerror=x>",
	" third",
	" fourth",
	"diff --git a/src/b.ts b/src/b.ts",
	"--- a/src/b.ts",
	"+++ b/src/b.ts",
	"@@ -1 +1 @@",
	"-x",
	"+y",
	"",
].join("\n");

function bigDiff(lines: number): string {
	const body = Array.from({ length: lines }, (_, i) => `+line ${i}`);
	return ["diff --git a/src/big.ts b/src/big.ts", "--- /dev/null", "+++ b/src/big.ts", `@@ -0,0 +1,${lines} @@`, ...body, ""].join("\n");
}

function file(path: string, additions = 1, deletions = 0) {
	return { path, status: FILE_STATUS.modified, additions, deletions, binary: false, lineCount: 100, hunks: [] };
}

function snapshot(extra = ""): Snapshot {
	return {
		root: "/repo",
		repoName: "repo",
		branch: "main",
		additions: 2,
		deletions: 1,
		files: [file("src/auth.ts"), file("src/b.ts", 1, 1), ...(extra ? [file("src/big.ts", 1600)] : [])],
		diffs: parseUnifiedDiff(DIFF + extra),
	};
}

function finding(overrides: Partial<ValidatedFinding> = {}): ValidatedFinding {
	return { severity: SEVERITY.high, path: "src/auth.ts", line: 2, claim: "Claim.", check: "Check it.", outsideChange: false, ...overrides };
}

function render(findings: ValidatedFinding[], snap = snapshot(), overrides: Partial<Submission> = {}): string {
	const submission: Submission = {
		summary: "Summary.",
		changes: [{ title: "Change", files: ["src/auth.ts"] }],
		findings: [],
		tests: TESTS_STATE.none,
		...overrides,
	};
	const validation: Validation = { errors: [], warnings: [], findings, affected: [] };
	return renderHtml({ submission, validation, snapshot: snap, generatedAt: new Date("2026-01-01T00:00:00Z"), reportId: "repo-1/20260101-000000" });
}

test("escapes agent text and code lines", () => {
	const html = render([finding({ claim: "<script>alert(1)</script>" })]);
	assert.ok(!html.includes("<script>alert(1)"));
	assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
	assert.ok(!html.includes("<img onerror=x>"));
	assert.ok(html.includes("&lt;img onerror=x&gt;"));
});

test("card sits right after its anchor row and before the next row", () => {
	const html = render([finding({ line: 2 })]);
	const card = html.indexOf('id="finding-0"');
	const anchorRow = html.indexOf("&lt;img onerror=x&gt;");
	const nextRow = html.indexOf(">third<");
	assert.ok(anchorRow !== -1 && anchorRow < card);
	assert.ok(card < nextRow);
});

test("finding on an unchanged file goes under Other referenced files", () => {
	const html = render([finding({ path: "src/other.ts", line: 3, outsideChange: true })]);
	const heading = html.indexOf("Other referenced files</h2>");
	assert.ok(heading !== -1);
	assert.ok(html.indexOf('id="finding-0"') > heading);
	assert.ok(html.includes(">outside changed lines<"));
});

test("finding outside the rendered rows is placed at the top of its file section", () => {
	const html = render([finding({ line: 90, outsideChange: true })]);
	const section = html.indexOf('id="file-0"');
	const card = html.indexOf('id="finding-0"');
	const firstRow = html.indexOf('<tr class="hunk">', section);
	assert.ok(section < card && card < firstRow);
});

test("a deletion-only finding highlights the removed rows and its card follows the last one", () => {
	const raw = [
		"diff --git a/src/auth.ts b/src/auth.ts",
		"--- a/src/auth.ts",
		"+++ b/src/auth.ts",
		"@@ -1,5 +1,3 @@",
		" first",
		"-gone one",
		"-gone two",
		" after",
		" end",
		"",
	].join("\n");
	const snap = { ...snapshot(), diffs: parseUnifiedDiff(raw) };
	const html = render([finding({ line: 1 })], snap);
	const card = html.indexOf('id="finding-0"');
	const rows = html.match(/<tr class="line [^"]*">.*<\/tr>/g) ?? [];
	const highlighted = rows.filter((row) => row.includes(" hl "));
	assert.equal(highlighted.length, 2);
	assert.ok(highlighted.every((row) => row.startsWith('<tr class="line removed hl sev-')));
	assert.ok(html.indexOf(">gone two<") < card);
	assert.ok(card < html.indexOf(">after<"));
	assert.ok(!rows.find((row) => row.includes(">first<"))?.includes(" hl "));
});

test("What changed links resolve a ./-prefixed path to its file section", () => {
	const html = render([], snapshot(), { changes: [{ title: "Change", files: ["./src/b.ts"] }] });
	assert.ok(html.includes('<a href="#file-1">./src/b.ts</a>'));
});

test("has no remote resources and one Reviewed checkbox per changed file", () => {
	const html = render([finding()]);
	assert.ok(!html.includes('src="http'));
	assert.ok(!html.includes('href="http'));
	assert.equal(html.match(/class="reviewed-box"/g)?.length, 2);
});

test("collapses reviewed files via a JS-managed peek class, not :has(:target)", () => {
	const html = render([finding()]);
	assert.ok(!html.includes(":has(:target)"));
	assert.ok(html.includes(".reviewed:not(.peek) .diff-body"));
	assert.ok(html.includes("hashchange"));
	assert.ok(html.includes("scrollBy"));
	assert.ok(html.includes("applyPeek"));
	assert.ok(html.includes('addEventListener("click"'));
	assert.ok(html.indexOf(", true)", html.indexOf('addEventListener("click"')) > -1);
	assert.ok(!html.includes("peekTarget"));
});

test("caps rendered lines per file", () => {
	const html = render([], snapshot(bigDiff(1600)));
	assert.ok(html.includes("100 more lines not shown."));
	// One added row each in auth.ts and b.ts, plus the 1500 cap for big.ts.
	assert.equal(html.match(/<tr class="line added"/g)?.length, 1502);
});

test("says so when nothing is flagged", () => {
	assert.ok(render([]).includes("Nothing flagged."));
});

test("uses SVG severity icons, never emoji", () => {
	const html = render([finding({ severity: SEVERITY.critical }), finding({ severity: SEVERITY.high }), finding({ severity: SEVERITY.medium }), finding({ severity: SEVERITY.low })]);
	for (const emoji of ["\u26D4", "\u{1F534}", "\u{1F7E1}", "\u{1F535}"]) assert.ok(!html.includes(emoji));
	assert.ok(html.includes('<svg class="icon"'));
});

test("highlighted rows keep their added class alongside the highlight class", () => {
	const html = render([finding({ line: 2 })]);
	const rows = html.match(/<tr class="line [^"]*">/g) ?? [];
	assert.ok(rows.some((row) => row === '<tr class="line added hl sev-high">'));
});

test("escapes a path containing quote and angle bracket everywhere it appears", () => {
	const weird = 'src/a"<b.ts';
	const escaped = "src/a&quot;&lt;b.ts";
	const snap = { ...snapshot(), files: [file(weird)] };
	const html = render([], snap);
	assert.ok(!html.includes('a"<b'));
	assert.ok(html.includes(`data-path="${escaped}"`));
	assert.ok(html.includes(`title="${escaped}"`));
	assert.ok(html.includes("a&quot;&lt;b.ts</span>"));
});

test("severity pills link to the first finding of that severity by global index", () => {
	const html = render([
		finding({ severity: SEVERITY.critical }),
		finding({ severity: SEVERITY.high, line: 2 }),
		finding({ severity: SEVERITY.high, line: 3 }),
		finding({ severity: SEVERITY.low, line: 3 }),
	]);
	assert.ok(/<a class="pill sev-high" href="#finding-1">/.test(html));
	assert.ok(/<a class="pill sev-low" href="#finding-3">/.test(html));
});

test("severity pill text includes the severity word", () => {
	const html = render([finding({ severity: SEVERITY.critical }), finding({ severity: SEVERITY.low, line: 3 })]);
	for (const word of ["critical", "low"]) {
		assert.ok(new RegExp(`<span class="pill sev-${word}"><svg[^\\n]*?</svg><span>${word}</span></span>`).test(html));
	}
});
