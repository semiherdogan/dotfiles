import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ALLOWED_SUBCOMMANDS = new Set(["status", "log", "diff", "show", "ls-files"]);

// Global options that consume the following token, so the subcommand is one further along.
const VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);

// Commands that run their arguments as another command, so git may sit further along in the segment.
const WRAPPERS = new Set([
	"sudo", "doas", "env", "command", "exec", "builtin", "nohup", "time", "xargs", "nice", "timeout", "stdbuf", "caffeinate",
]);
// Commands whose arguments are shell source, so the arguments are scanned as commands again.
const INTERPRETERS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish", "eval", "source", "."]);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SEGMENT_SEPARATORS = ";|&(){}`\n\r";

const BLOCK_REASON = [
	"Git operations are forbidden for the agent in this project. Only `git status`, `git log`, `git diff`, `git show` and `git ls-files` are allowed.",
	"Do not retry, do not work around it, and do not use a wrapper or alias.",
	"Tell the user which git command is needed and why, then let them run it themselves.",
].join(" ");

type Word = { text: string; quoted: boolean };

// Splits a command into pipeline segments of words. Quotes group text and mark the word, operators and
// command substitutions start a new segment. Not a full shell parser: the goal is to tell command position
// from argument position so that `grep "a|git|b"` is not read as running git.
function splitSegments(command: string): Word[][] {
	const segments: Word[][] = [];
	let segment: Word[] = [];
	let text = "";
	let quoted = false;
	let inWord = false;

	const endWord = () => {
		if (inWord) segment.push({ text, quoted });
		text = "";
		quoted = false;
		inWord = false;
	};
	const endSegment = () => {
		endWord();
		if (segment.length > 0) segments.push(segment);
		segment = [];
	};

	for (let i = 0; i < command.length; i++) {
		const ch = command[i];
		if (ch === "\\" && i + 1 < command.length) {
			text += command[++i];
			inWord = true;
		} else if (ch === "'") {
			const end = command.indexOf("'", i + 1);
			const stop = end === -1 ? command.length : end;
			text += command.slice(i + 1, stop);
			quoted = true;
			inWord = true;
			i = stop;
		} else if (ch === '"') {
			let j = i + 1;
			while (j < command.length && command[j] !== '"') {
				if (command[j] === "\\" && j + 1 < command.length) j++;
				text += command[j];
				j++;
			}
			quoted = true;
			inWord = true;
			i = j;
		} else if (ch === "$" && command[i + 1] === "(") {
			endSegment();
			i++;
		} else if (SEGMENT_SEPARATORS.includes(ch)) {
			endSegment();
		} else if (/\s/.test(ch)) {
			endWord();
		} else {
			text += ch;
			inWord = true;
		}
	}
	endSegment();

	return segments;
}

function isGitName(text: string): boolean {
	return text === "git" || text.endsWith("/git");
}

function subcommandViolation(words: Word[], start: number): string | undefined {
	let j = start;
	while (j < words.length) {
		const token = words[j].text;
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

	const subcommand = words[j]?.text;
	if (subcommand === undefined) return "git (bare)";
	return ALLOWED_SUBCOMMANDS.has(subcommand) ? undefined : `git ${subcommand}`;
}

function checkSegment(words: Word[], violations: string[]): void {
	let i = 0;
	while (i < words.length && !words[i].quoted && ENV_ASSIGNMENT.test(words[i].text)) i++;

	let wrapped = false;
	while (i < words.length && WRAPPERS.has(words[i].text)) {
		wrapped = true;
		i++;
		while (i < words.length && (words[i].text.startsWith("-") || ENV_ASSIGNMENT.test(words[i].text))) i++;
	}

	// Only the command position counts. Wrapper options with values (`sudo -u root`, `timeout 5`) hide the
	// real command, so after a wrapper any unquoted word is a candidate; quoted ones stay arguments.
	const last = wrapped ? words.length - 1 : i;
	for (let k = i; k <= last; k++) {
		const word = words[k];
		if (word.quoted && k > i) continue;
		if (isGitName(word.text)) {
			const violation = subcommandViolation(words, k + 1);
			if (violation !== undefined) violations.push(violation);
			return;
		}
		if (INTERPRETERS.has(word.text)) {
			for (const arg of words.slice(k + 1)) violations.push(...findViolations(arg.text));
			return;
		}
	}
}

export function findViolations(command: string): string[] {
	const violations: string[] = [];
	for (const segment of splitSegments(command)) checkSegment(segment, violations);
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
