import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, join, posix } from "node:path";

export const FILE_STATUS = {
	added: "A",
	modified: "M",
	deleted: "D",
	renamed: "R",
	copied: "C",
	typeChanged: "T",
	untracked: "?",
} as const;
export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

export type LineRange = { start: number; end: number };

export type FileInfo = { binary: boolean; lineCount?: number };

export type ChangedFile = {
	path: string;
	oldPath?: string;
	status: FileStatus;
	additions: number;
	deletions: number;
	binary: boolean;
	// Undefined for deleted, binary and oversized files.
	lineCount?: number;
	// Line ranges in the current file touched by the change.
	hunks: LineRange[];
};

export type Snapshot = {
	root: string;
	repoName: string;
	branch: string;
	files: ChangedFile[];
	additions: number;
	deletions: number;
};

export class GitError extends Error {}

const HEAD = "HEAD";
const NO_BRANCH = "no commits";
const MAX_COUNTED_BYTES = 2 * 1024 * 1024;
const BINARY_PROBE_BYTES = 8000;
const NEWLINE = 0x0a;
const NUL_BYTE = 0;
const UNTRACKED_CODE = "??";
const UNCHANGED_CODE = " ";
const NUMSTAT_BINARY = "-";
const OLD_FILE_PREFIX = "--- ";
const NEW_FILE_PREFIX = "+++ b/";
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
const STATUS_CHARS = new Set<string>(Object.values(FILE_STATUS));

type RunResult = { stdout: string; stderr: string; code: number };

function run(args: string[], cwd: string, input?: string): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		const child = spawn("git", args, { cwd, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.on("error", reject);
		child.on("close", (code) =>
			resolve({
				stdout: Buffer.concat(stdout).toString("utf8"),
				stderr: Buffer.concat(stderr).toString("utf8"),
				code: code ?? 1,
			}),
		);
		if (input !== undefined) child.stdin?.end(input);
	});
}

async function git(args: string[], cwd: string, input?: string): Promise<string> {
	const result = await run(args, cwd, input);
	if (result.code !== 0) throw new GitError(result.stderr.trim() || `git ${args.join(" ")} failed`);
	return result.stdout;
}

export async function repoRoot(cwd: string): Promise<string | undefined> {
	const result = await run(["rev-parse", "--show-toplevel"], cwd);
	return result.code === 0 ? result.stdout.trim() : undefined;
}

// A repository without commits diffs against the empty tree of its own hash algorithm.
async function diffBase(root: string): Promise<string> {
	const result = await run(["rev-parse", "--verify", "--quiet", HEAD], root);
	if (result.code === 0) return HEAD;
	return (await git(["hash-object", "-t", "tree", "/dev/null"], root)).trim();
}

// Rejects absolute paths and parent traversal; returns a normalized repo-relative posix path.
export function normalizeRepoPath(input: string): string | undefined {
	const trimmed = input.trim().replace(/\\/g, "/");
	if (trimmed === "" || posix.isAbsolute(trimmed)) return undefined;
	const normalized = posix.normalize(trimmed);
	if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return undefined;
	return normalized.startsWith("./") ? normalized.slice(2) : normalized;
}

export function fileExists(root: string, path: string): boolean {
	try {
		return statSync(join(root, path)).isFile();
	} catch {
		return false;
	}
}

type StatusEntry = Pick<ChangedFile, "path" | "oldPath" | "status">;

function toStatus(code: string): FileStatus {
	const index = code[0];
	const worktree = code[1];
	const char = worktree !== UNCHANGED_CODE ? worktree : index;
	return STATUS_CHARS.has(char) ? (char as FileStatus) : FILE_STATUS.modified;
}

// Parses `git status --porcelain=v1 -z`. Rename entries carry the original path in the following field.
export function parseStatus(raw: string): StatusEntry[] {
	const fields = raw.split("\0");
	const entries: StatusEntry[] = [];
	for (let i = 0; i < fields.length; i++) {
		const field = fields[i];
		if (field.length < 4) continue;
		const code = field.slice(0, 2);
		const path = field.slice(3);
		if (code === UNTRACKED_CODE) {
			entries.push({ path, status: FILE_STATUS.untracked });
			continue;
		}
		const copyKind = code.includes(FILE_STATUS.renamed)
			? FILE_STATUS.renamed
			: code.includes(FILE_STATUS.copied)
				? FILE_STATUS.copied
				: undefined;
		if (copyKind !== undefined) {
			entries.push({ path, oldPath: fields[++i], status: copyKind });
			continue;
		}
		entries.push({ path, status: toStatus(code) });
	}
	return entries;
}

type NumStat = { additions: number; deletions: number; binary: boolean };

// Parses `git diff --numstat -z`. Rename entries have an empty path followed by old and new path fields.
export function parseNumstat(raw: string): Map<string, NumStat> {
	const fields = raw.split("\0");
	const stats = new Map<string, NumStat>();
	for (let i = 0; i < fields.length; i++) {
		const field = fields[i];
		if (field === "") continue;
		const [added, deleted, inlinePath] = field.split("\t");
		let path = inlinePath;
		if (path === undefined || path === "") {
			i += 2;
			path = fields[i];
		}
		if (path === undefined) break;
		const binary = added === NUMSTAT_BINARY;
		stats.set(path, {
			additions: binary ? 0 : Number(added),
			deletions: binary ? 0 : Number(deleted),
			binary,
		});
	}
	return stats;
}

// Parses `git diff -U0` output into new-file line ranges per path.
export function parseHunks(diff: string): Map<string, LineRange[]> {
	const hunks = new Map<string, LineRange[]>();
	let ranges: LineRange[] | undefined;
	let previous = "";
	for (const line of diff.split("\n")) {
		if (line.startsWith("+++ ") && previous.startsWith(OLD_FILE_PREFIX)) {
			ranges = undefined;
			if (line.startsWith(NEW_FILE_PREFIX)) {
				ranges = [];
				hunks.set(line.slice(NEW_FILE_PREFIX.length).replace(/\t$/, ""), ranges);
			}
		} else if (ranges !== undefined) {
			const match = HUNK_HEADER.exec(line);
			if (match) {
				const start = Number(match[1]);
				const count = match[2] === undefined ? 1 : Number(match[2]);
				ranges.push({ start, end: count === 0 ? start : start + count - 1 });
			}
		}
		previous = line;
	}
	return hunks;
}

// Undefined when the path is not a regular file. lineCount is omitted for binary and oversized files.
export function inspectPath(root: string, path: string): FileInfo | undefined {
	const absPath = join(root, path);
	let content: Buffer;
	try {
		const stat = statSync(absPath);
		if (!stat.isFile()) return undefined;
		if (stat.size > MAX_COUNTED_BYTES) return { binary: false };
		content = readFileSync(absPath);
	} catch {
		return undefined;
	}
	if (content.subarray(0, BINARY_PROBE_BYTES).includes(NUL_BYTE)) return { binary: true };
	let lineCount = 0;
	for (let at = content.indexOf(NEWLINE); at !== -1; at = content.indexOf(NEWLINE, at + 1)) lineCount++;
	if (content.length > 0 && content[content.length - 1] !== NEWLINE) lineCount++;
	return { binary: false, lineCount };
}

export async function snapshot(cwd: string): Promise<Snapshot> {
	const root = await repoRoot(cwd);
	if (root === undefined) throw new GitError(`Not a git repository: ${cwd}`);
	const base = await diffBase(root);
	const [statusRaw, numstatRaw, diffRaw, branch] = await Promise.all([
		git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], root),
		git(["diff", base, "--numstat", "-z", "--no-ext-diff"], root),
		git(["-c", "core.quotePath=false", "diff", base, "-U0", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"], root),
		run(["rev-parse", "--abbrev-ref", HEAD], root),
	]);
	const numstat = parseNumstat(numstatRaw);
	const hunks = parseHunks(diffRaw);
	const files: ChangedFile[] = [];
	for (const entry of parseStatus(statusRaw)) {
		const deleted = entry.status === FILE_STATUS.deleted;
		const inspected: FileInfo = deleted ? { binary: false } : (inspectPath(root, entry.path) ?? { binary: false });
		if (entry.status === FILE_STATUS.untracked) {
			const lineCount = inspected.lineCount ?? 0;
			files.push({
				...entry,
				...inspected,
				additions: lineCount,
				deletions: 0,
				hunks: lineCount > 0 ? [{ start: 1, end: lineCount }] : [],
			});
			continue;
		}
		const stat = numstat.get(entry.path);
		files.push({
			...entry,
			binary: inspected.binary || (stat?.binary ?? false),
			lineCount: inspected.lineCount,
			additions: stat?.additions ?? 0,
			deletions: stat?.deletions ?? 0,
			hunks: hunks.get(entry.path) ?? [],
		});
	}
	return {
		root,
		repoName: basename(root),
		branch: branch.code === 0 ? branch.stdout.trim() : NO_BRANCH,
		files,
		additions: files.reduce((sum, file) => sum + file.additions, 0),
		deletions: files.reduce((sum, file) => sum + file.deletions, 0),
	};
}

// Cheap identity of the working tree state, used to detect whether a run changed anything.
export async function fingerprint(cwd: string): Promise<string | undefined> {
	const root = await repoRoot(cwd);
	if (root === undefined) return undefined;
	const statusRaw = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], root);
	// Submodules and files removed mid-run have no blob to hash; the status text still covers them.
	const paths = parseStatus(statusRaw)
		.filter((entry) => entry.status !== FILE_STATUS.deleted && fileExists(root, entry.path))
		.map((entry) => entry.path);
	const hashes = paths.length > 0 ? await git(["hash-object", "--stdin-paths"], root, `${paths.join("\n")}\n`) : "";
	return createHash("sha256").update(statusRaw).update(hashes).digest("hex");
}
