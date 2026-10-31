export const LINE_KIND = { context: "context", added: "added", removed: "removed" } as const;
export type LineKind = (typeof LINE_KIND)[keyof typeof LINE_KIND];
export type DiffLine = { kind: LineKind; oldLine?: number; newLine?: number; text: string };
export type DiffHunk = { header: string; lines: DiffLine[] };
export type FileDiff = { hunks: DiffHunk[] };

const FILE_START = "diff --git ";
const OLD_FILE_PREFIX = "--- ";
const NEW_FILE_PREFIX = "+++ ";
const RENAME_FROM = "rename from ";
const RENAME_TO = "rename to ";
const OLD_PATH_PREFIX = "a/";
const NEW_PATH_PREFIX = "b/";
const NO_FILE = "/dev/null";
const MARKER_CONTEXT = " ";
const MARKER_REMOVED = "-";
const MARKER_ADDED = "+";
const MARKER_NO_NEWLINE = "\\";
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function diffPath(raw: string, prefix: string): string | undefined {
	const path = raw.replace(/\t$/, "");
	if (path === NO_FILE) return undefined;
	return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

// Parses `git diff -U3 --src-prefix=a/ --dst-prefix=b/` output (core.quotePath=false) into hunks per path.
export function parseUnifiedDiff(raw: string): Map<string, FileDiff> {
	const files = new Map<string, FileDiff>();
	let inFile = false;
	let oldPath: string | undefined;
	let newPath: string | undefined;
	let hunks: DiffHunk[] = [];
	let hunk: DiffHunk | undefined;
	let remainingOld = 0;
	let remainingNew = 0;
	let oldLine = 0;
	let newLine = 0;

	const flush = () => {
		const key = newPath ?? oldPath;
		if (inFile && key !== undefined) {
			// A type change arrives as a delete and a create section for the same path.
			const existing = files.get(key);
			if (existing === undefined) files.set(key, { hunks });
			else existing.hunks.push(...hunks);
		}
		inFile = false;
		oldPath = undefined;
		newPath = undefined;
		hunks = [];
		hunk = undefined;
		remainingOld = 0;
		remainingNew = 0;
	};

	for (const line of raw.split("\n")) {
		if (hunk !== undefined && (remainingOld > 0 || remainingNew > 0)) {
			const marker = line.slice(0, 1);
			const text = line.slice(1);
			if (marker === MARKER_NO_NEWLINE) continue;
			if (marker === MARKER_CONTEXT) {
				hunk.lines.push({ kind: LINE_KIND.context, oldLine, newLine, text });
				oldLine++;
				newLine++;
				remainingOld--;
				remainingNew--;
				continue;
			}
			if (marker === MARKER_REMOVED) {
				hunk.lines.push({ kind: LINE_KIND.removed, oldLine, text });
				oldLine++;
				remainingOld--;
				continue;
			}
			if (marker === MARKER_ADDED) {
				hunk.lines.push({ kind: LINE_KIND.added, newLine, text });
				newLine++;
				remainingNew--;
				continue;
			}
			hunk = undefined;
		}
		if (line.startsWith(MARKER_NO_NEWLINE)) continue;
		if (line.startsWith(FILE_START)) {
			flush();
			inFile = true;
		} else if (!inFile) {
			continue;
		} else if (line.startsWith(OLD_FILE_PREFIX)) {
			oldPath = diffPath(line.slice(OLD_FILE_PREFIX.length), OLD_PATH_PREFIX);
		} else if (line.startsWith(NEW_FILE_PREFIX)) {
			newPath = diffPath(line.slice(NEW_FILE_PREFIX.length), NEW_PATH_PREFIX);
		} else if (line.startsWith(RENAME_FROM)) {
			oldPath = line.slice(RENAME_FROM.length);
		} else if (line.startsWith(RENAME_TO)) {
			newPath = line.slice(RENAME_TO.length);
		} else {
			const match = HUNK_HEADER.exec(line);
			if (match) {
				hunk = { header: line, lines: [] };
				hunks.push(hunk);
				oldLine = Number(match[1]);
				remainingOld = match[2] === undefined ? 1 : Number(match[2]);
				newLine = Number(match[3]);
				remainingNew = match[4] === undefined ? 1 : Number(match[4]);
			}
		}
	}
	flush();
	return files;
}

// Renders a new file as a single all-added hunk.
export function addedFileDiff(content: string): FileDiff {
	if (content === "") return { hunks: [] };
	const texts = content.split("\n");
	if (content.endsWith("\n")) texts.pop();
	const lines: DiffLine[] = texts.map((text, index) => ({ kind: LINE_KIND.added, newLine: index + 1, text }));
	return { hunks: [{ header: `@@ -0,0 +1,${lines.length} @@`, lines }] };
}
