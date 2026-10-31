import assert from "node:assert/strict";
import { test } from "node:test";
import { FILE_STATUS, normalizeRepoPath, parseHunks, parseNumstat, parseStatus } from "./git.ts";

test("parseStatus handles modified, untracked, renamed and added entries", () => {
	const raw = " M src/a.ts\0?? src/new.ts\0R  src/b.ts\0src/old.ts\0A  src/c.ts\0C  src/d.ts\0src/c.ts\0";
	assert.deepEqual(parseStatus(raw), [
		{ path: "src/a.ts", status: FILE_STATUS.modified },
		{ path: "src/new.ts", status: FILE_STATUS.untracked },
		{ path: "src/b.ts", oldPath: "src/old.ts", status: FILE_STATUS.renamed },
		{ path: "src/c.ts", status: FILE_STATUS.added },
		{ path: "src/d.ts", oldPath: "src/c.ts", status: FILE_STATUS.copied },
	]);
});

test("parseNumstat reads counts, binaries and renames", () => {
	const raw = "3\t1\tsrc/a.ts\0-\t-\timg.png\0" + "0\t0\t\0src/old.ts\0src/b.ts\0";
	const stats = parseNumstat(raw);
	assert.deepEqual(stats.get("src/a.ts"), { additions: 3, deletions: 1, binary: false });
	assert.deepEqual(stats.get("img.png"), { additions: 0, deletions: 0, binary: true });
	assert.deepEqual(stats.get("src/b.ts"), { additions: 0, deletions: 0, binary: false });
});

test("parseHunks maps new-file ranges per path and skips deletions", () => {
	const diff = [
		"diff --git a/src/a.ts b/src/a.ts",
		"--- a/src/a.ts",
		"+++ b/src/a.ts",
		"@@ -10,2 +10,3 @@ ctx",
		"+x",
		"+++ b/fake.ts",
		"@@ -30 +31,0 @@",
		"-y",
		"diff --git a/gone.ts b/gone.ts",
		"--- a/gone.ts",
		"+++ /dev/null",
		"@@ -1,5 +0,0 @@",
		"diff --git a/single.ts b/single.ts",
		"--- a/single.ts",
		"+++ b/single.ts",
		"@@ -4 +4 @@",
		"--- a/src/my file.ts\t",
		"+++ b/src/my file.ts\t",
		"@@ -1 +1,2 @@",
	].join("\n");
	const hunks = parseHunks(diff);
	assert.deepEqual(hunks.get("src/a.ts"), [
		{ start: 10, end: 12 },
		{ start: 31, end: 31 },
	]);
	assert.equal(hunks.has("gone.ts"), false);
	assert.equal(hunks.has("fake.ts"), false);
	assert.deepEqual(hunks.get("single.ts"), [{ start: 4, end: 4 }]);
	assert.deepEqual(hunks.get("src/my file.ts"), [{ start: 1, end: 2 }]);
});

test("normalizeRepoPath rejects escapes and strips ./", () => {
	assert.equal(normalizeRepoPath("./src/a.ts"), "src/a.ts");
	assert.equal(normalizeRepoPath("src/../src/a.ts"), "src/a.ts");
	assert.equal(normalizeRepoPath("/etc/passwd"), undefined);
	assert.equal(normalizeRepoPath("../x.ts"), undefined);
	assert.equal(normalizeRepoPath(""), undefined);
});
