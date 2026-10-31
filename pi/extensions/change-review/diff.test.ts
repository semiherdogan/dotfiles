import assert from "node:assert/strict";
import { test } from "node:test";
import { addedFileDiff, LINE_KIND, parseUnifiedDiff } from "./diff.ts";

test("modified file keeps context and numbers old and new lines", () => {
	const raw = [
		"diff --git a/src/a.ts b/src/a.ts",
		"index 111..222 100644",
		"--- a/src/a.ts",
		"+++ b/src/a.ts",
		"@@ -10,4 +10,4 @@ fn",
		" keep",
		"-old",
		"+new",
		" tail",
		" end",
		"",
	].join("\n");
	const diff = parseUnifiedDiff(raw).get("src/a.ts");
	assert.equal(diff?.hunks.length, 1);
	assert.equal(diff?.hunks[0].header, "@@ -10,4 +10,4 @@ fn");
	assert.deepEqual(diff?.hunks[0].lines, [
		{ kind: LINE_KIND.context, oldLine: 10, newLine: 10, text: "keep" },
		{ kind: LINE_KIND.removed, oldLine: 11, text: "old" },
		{ kind: LINE_KIND.added, newLine: 11, text: "new" },
		{ kind: LINE_KIND.context, oldLine: 12, newLine: 12, text: "tail" },
		{ kind: LINE_KIND.context, oldLine: 13, newLine: 13, text: "end" },
	]);
});

test("deleted file is keyed by its old path", () => {
	const raw = [
		"diff --git a/gone.ts b/gone.ts",
		"deleted file mode 100644",
		"--- a/gone.ts",
		"+++ /dev/null",
		"@@ -1,2 +0,0 @@",
		"-one",
		"-two",
		"",
	].join("\n");
	const files = parseUnifiedDiff(raw);
	assert.deepEqual([...files.keys()], ["gone.ts"]);
	assert.deepEqual(files.get("gone.ts")?.hunks[0].lines, [
		{ kind: LINE_KIND.removed, oldLine: 1, text: "one" },
		{ kind: LINE_KIND.removed, oldLine: 2, text: "two" },
	]);
});

test("pure rename is keyed by the new path and has no hunks", () => {
	const raw = [
		"diff --git a/old.ts b/new.ts",
		"similarity index 100%",
		"rename from old.ts",
		"rename to new.ts",
		"",
	].join("\n");
	const files = parseUnifiedDiff(raw);
	assert.deepEqual([...files.keys()], ["new.ts"]);
	assert.deepEqual(files.get("new.ts"), { hunks: [] });
});

test("rename with content changes is keyed by the new path with its hunk", () => {
	const raw = [
		"diff --git a/old.ts b/new.ts",
		"similarity index 80%",
		"rename from old.ts",
		"rename to new.ts",
		"--- a/old.ts",
		"+++ b/new.ts",
		"@@ -1,2 +1,2 @@",
		" keep",
		"-a",
		"+b",
		"",
	].join("\n");
	const files = parseUnifiedDiff(raw);
	assert.deepEqual([...files.keys()], ["new.ts"]);
	assert.equal(files.get("new.ts")?.hunks.length, 1);
	assert.deepEqual(files.get("new.ts")?.hunks[0].lines, [
		{ kind: LINE_KIND.context, oldLine: 1, newLine: 1, text: "keep" },
		{ kind: LINE_KIND.removed, oldLine: 2, text: "a" },
		{ kind: LINE_KIND.added, newLine: 2, text: "b" },
	]);
});

test("type change as delete plus create sections keeps both hunks under the path", () => {
	const raw = [
		"diff --git a/t b/t",
		"deleted file mode 120000",
		"--- a/t",
		"+++ /dev/null",
		"@@ -1 +0,0 @@",
		"-target",
		"diff --git a/t b/t",
		"new file mode 100644",
		"--- /dev/null",
		"+++ b/t",
		"@@ -0,0 +1 @@",
		"+content",
		"",
	].join("\n");
	const files = parseUnifiedDiff(raw);
	assert.deepEqual([...files.keys()], ["t"]);
	assert.deepEqual(files.get("t")?.hunks.map((hunk) => hunk.lines.map((line) => line.kind)), [[LINE_KIND.removed], [LINE_KIND.added]]);
});

test("a blank context line written as a single space stays context", () => {
	const raw = [
		"diff --git a/b.ts b/b.ts",
		"--- a/b.ts",
		"+++ b/b.ts",
		"@@ -1,3 +1,3 @@",
		" a",
		" ",
		"-x",
		"+y",
		"",
	].join("\n");
	const lines = parseUnifiedDiff(raw).get("b.ts")?.hunks[0].lines;
	assert.deepEqual(lines?.[1], { kind: LINE_KIND.context, oldLine: 2, newLine: 2, text: "" });
	assert.equal(lines?.length, 4);
});

test("a removed line with content '-- x' stays a removed line", () => {
	const raw = [
		"diff --git a/q.sql b/q.sql",
		"--- a/q.sql",
		"+++ b/q.sql",
		"@@ -1,3 +1,2 @@",
		" a",
		"--- x",
		" b",
		"diff --git a/other.ts b/other.ts",
		"--- a/other.ts",
		"+++ b/other.ts",
		"@@ -1 +1 @@",
		"-p",
		"+q",
		"",
	].join("\n");
	const files = parseUnifiedDiff(raw);
	assert.deepEqual([...files.keys()], ["q.sql", "other.ts"]);
	assert.deepEqual(files.get("q.sql")?.hunks[0].lines[1], { kind: LINE_KIND.removed, oldLine: 2, text: "-- x" });
	assert.equal(files.get("other.ts")?.hunks[0].lines.length, 2);
});

test("no-newline markers are skipped mid-hunk and after a hunk", () => {
	const raw = [
		"diff --git a/n.txt b/n.txt",
		"--- a/n.txt",
		"+++ b/n.txt",
		"@@ -1,2 +1,2 @@",
		" same",
		"-last",
		"\\ No newline at end of file",
		"+last!",
		"\\ No newline at end of file",
		"diff --git a/m.txt b/m.txt",
		"--- a/m.txt",
		"+++ b/m.txt",
		"@@ -1 +1 @@",
		"-a",
		"+b",
		"",
	].join("\n");
	const files = parseUnifiedDiff(raw);
	assert.deepEqual(
		files.get("n.txt")?.hunks[0].lines.map((line) => line.text),
		["same", "last", "last!"],
	);
	assert.equal(files.get("m.txt")?.hunks[0].lines.length, 2);
});

test("path with a space and trailing tab is cleaned", () => {
	const raw = [
		"diff --git a/my file.ts b/my file.ts",
		"--- a/my file.ts\t",
		"+++ b/my file.ts\t",
		"@@ -1 +1 @@",
		"-a",
		"+b",
		"",
	].join("\n");
	assert.deepEqual([...parseUnifiedDiff(raw).keys()], ["my file.ts"]);
});

test("addedFileDiff numbers lines from 1 and ignores the trailing newline", () => {
	const diff = addedFileDiff("a\nb\n");
	assert.equal(diff.hunks.length, 1);
	assert.equal(diff.hunks[0].header, "@@ -0,0 +1,2 @@");
	assert.deepEqual(diff.hunks[0].lines, [
		{ kind: LINE_KIND.added, newLine: 1, text: "a" },
		{ kind: LINE_KIND.added, newLine: 2, text: "b" },
	]);
	assert.equal(addedFileDiff("a\nb").hunks[0].lines.length, 2);
});

test("addedFileDiff of empty content has no hunks", () => {
	assert.deepEqual(addedFileDiff(""), { hunks: [] });
});
