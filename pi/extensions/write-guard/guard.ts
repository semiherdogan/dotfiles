import { basename, commandIndex, nestedScripts, parseCommands, type Redirect, type SimpleCommand, type Word } from "../lib/shell.ts";

const OPTION_PREFIX = "-";
const LONG_PREFIX = "--";
const OPTION_END = "--";
const STDIN_DASH = "-";
const VALUE_SEPARATOR = "=";
const MAX_SNIPPET_LENGTH = 40;

const LABEL_REDIRECT = "redirect";
const LABEL_SHELL_EVAL = "shell eval";
const LABEL_SED = "sed -i";
const LABEL_PERL = "perl -i";
const LABEL_TEE = "tee";
const LABEL_INLINE = "inline script";
const LABEL_MUTATION = "file mutation";

const EVAL_NAME = "eval";
const TEE_NAME = "tee";
const SHELL_COMMAND_SUFFIX = "-c";
const PIPE_PREFIX = "|";
const SUBSTITUTION_DETAIL = "<(...)";

const WRITE_REDIRECT_OPS = new Set([">", ">>", ">|", "&>", "&>>", "<>", ">&"]);
const DUP_OP = ">&";
// `>&2`, `>&-` and `>&2-` duplicate or close a descriptor instead of writing a file.
const FD_TARGET = /^(?:\d+-?|-)$/;
const HARMLESS_PATHS = new Set(["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"]);
const FD_PATH = /^\/dev\/fd\/\d+$/;
const PROCESS_SUBSTITUTION_PREFIXES = ["<(", ">("];
// Download output that goes nowhere or to stdout.
const DISCARD_TARGETS = new Set(["/dev/null", "-"]);

type Checker = (args: string[]) => boolean;
type Scan = { hit: boolean; takesNext: boolean };

function isShortCluster(arg: string): boolean {
	return arg.startsWith(OPTION_PREFIX) && !arg.startsWith(LONG_PREFIX) && arg.length > OPTION_PREFIX.length;
}

function longName(flag: string): string {
	const end = flag.indexOf(VALUE_SEPARATOR);
	return end === -1 ? flag : flag.slice(0, end);
}

function longValue(flag: string, next: string | undefined): string | undefined {
	const end = flag.indexOf(VALUE_SEPARATOR);
	return end === -1 ? next : flag.slice(end + 1);
}

function hasLetter(arg: string, letters: Set<string>): boolean {
	return isShortCluster(arg) && [...arg.slice(1)].some((letter) => letters.has(letter));
}

// Walks a short cluster; letters in `stops` take a value, so the rest of the cluster is data.
function scanCluster(arg: string, targets: Set<string>, stops: Set<string>): Scan {
	const letters = arg.slice(1);
	for (let i = 0; i < letters.length; i++) {
		if (targets.has(letters[i])) return { hit: true, takesNext: false };
		if (stops.has(letters[i])) return { hit: false, takesNext: i === letters.length - 1 };
	}
	return { hit: false, takesNext: false };
}

// Looks at option words only, up to the first positional (the script or file).
function flagHit(args: string[], targets: Set<string>, stops: Set<string>, longPrefix?: string): boolean {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === OPTION_END || !arg.startsWith(OPTION_PREFIX) || arg === OPTION_PREFIX) break;
		if (longPrefix !== undefined && arg.startsWith(longPrefix)) return true;
		if (!isShortCluster(arg)) continue;
		const scan = scanCluster(arg, targets, stops);
		if (scan.hit) return true;
		if (scan.takesNext) i++;
	}
	return false;
}

function isProcessSubstitution(word: Word): boolean {
	return word.dynamic && PROCESS_SUBSTITUTION_PREFIXES.some((prefix) => word.text.startsWith(prefix));
}

function isHarmlessPath(word: Word): boolean {
	return !word.dynamic && (HARMLESS_PATHS.has(word.text) || FD_PATH.test(word.text));
}

function redirectViolation(redirect: Redirect): string | undefined {
	if (!WRITE_REDIRECT_OPS.has(redirect.op)) return undefined;
	if (redirect.op === DUP_OP && !redirect.targetDynamic && FD_TARGET.test(redirect.target)) return undefined;
	const target: Word = { text: redirect.target, quoted: false, dynamic: redirect.targetDynamic };
	if (isProcessSubstitution(target) || isHarmlessPath(target)) return undefined;
	return `${LABEL_REDIRECT} "${snippet(`${redirect.fd ?? ""}${redirect.op}`, [redirect.target])}"`;
}

const CURL_REMOTE_NAME = new Set(["--remote-name", "--remote-name-all"]);
const CURL_OUTPUT = "--output";
const CURL_OUTPUT_DIR = "--output-dir";
const CURL_REMOTE_NAME_LETTER = "O";
const CURL_OUTPUT_LETTER = "o";
// Short options that take a value, so the rest of a cluster is not flags.
const CURL_VALUE_LETTERS = new Set([..."AbcCdDeEFHKmPQrtTuUwxXyYz"]);

const curlWrites: Checker = (args) => {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === OPTION_END) break;
		const name = longName(arg);
		if (CURL_REMOTE_NAME.has(name) || name === CURL_OUTPUT_DIR) return true;
		if (name === CURL_OUTPUT) {
			const value = longValue(arg, args[i + 1]);
			if (value === undefined || !DISCARD_TARGETS.has(value)) return true;
			continue;
		}
		if (!isShortCluster(arg)) continue;
		const letters = arg.slice(1);
		for (let j = 0; j < letters.length; j++) {
			const letter = letters[j];
			if (letter === CURL_REMOTE_NAME_LETTER) return true;
			if (letter === CURL_OUTPUT_LETTER) {
				const rest = letters.slice(j + 1);
				const value = rest === "" ? args[i + 1] : rest;
				if (value === undefined || !DISCARD_TARGETS.has(value)) return true;
				if (rest === "") i++;
				break;
			}
			if (CURL_VALUE_LETTERS.has(letter)) {
				if (j === letters.length - 1) i++;
				break;
			}
		}
	}
	return false;
};

const WGET_SPIDER = "--spider";
const WGET_OUTPUT_LONG = "--output-document";
const WGET_OUTPUT_LETTER = "O";
const WGET_TARGETS = new Set([WGET_OUTPUT_LETTER]);
const WGET_VALUE_LETTERS = new Set([..."aeilotwBDIPQRTUXA"]);

const wgetWrites: Checker = (args) => {
	if (args.includes(WGET_SPIDER)) return false;
	let output: string | undefined;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === OPTION_END) break;
		if (longName(arg) === WGET_OUTPUT_LONG) {
			output = longValue(arg, args[i + 1]);
			continue;
		}
		if (!isShortCluster(arg)) continue;
		const letters = arg.slice(1);
		for (let j = 0; j < letters.length; j++) {
			const letter = letters[j];
			if (WGET_TARGETS.has(letter)) {
				const rest = letters.slice(j + 1);
				output = rest === "" ? args[i + 1] : rest;
				if (rest === "") i++;
				break;
			}
			if (WGET_VALUE_LETTERS.has(letter)) {
				if (j === letters.length - 1) i++;
				break;
			}
		}
	}
	return output === undefined || !DISCARD_TARGETS.has(output);
};

const PATCH_DRY_RUN = "--dry-run";
const patchWrites: Checker = (args) => !args.includes(PATCH_DRY_RUN);

const TAR_MODE_LETTERS = new Set([..."cxruA"]);
const TAR_MODE_LONG = new Set(["--create", "--extract", "--get", "--append", "--update", "--delete"]);

const tarWrites: Checker = (args) => {
	if (args.some((arg) => TAR_MODE_LONG.has(longName(arg)))) return true;
	if (args.length > 0 && !args[0].startsWith(OPTION_PREFIX) && [...args[0]].some((letter) => TAR_MODE_LETTERS.has(letter))) return true;
	return args.some((arg) => hasLetter(arg, TAR_MODE_LETTERS));
};

const UNZIP_READ_LETTERS = new Set([..."lptZv"]);
const unzipWrites: Checker = (args) => !args.some((arg) => hasLetter(arg, UNZIP_READ_LETTERS));

const GZIP_READ_LETTERS = new Set([..."clt"]);
const GZIP_STDOUT = "--stdout";
const gzipWrites: Checker = (args) => !args.some((arg) => arg === GZIP_STDOUT || hasLetter(arg, GZIP_READ_LETTERS));

const FIND_DELETE = "-delete";
const findWrites: Checker = (args) => args.includes(FIND_DELETE);

const DEFAULTS_WRITE_SUBCOMMANDS = new Set(["write", "delete", "import", "rename"]);
const DEFAULTS_HOST_OPTION = "-host";

const defaultsWrites: Checker = (args) => {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === DEFAULTS_HOST_OPTION) i++;
		else if (!args[i].startsWith(OPTION_PREFIX)) return DEFAULTS_WRITE_SUBCOMMANDS.has(args[i]);
	}
	return false;
};

const ALWAYS_MUTATING = new Set([
	"cp", "mv", "rm", "touch", "mkdir", "rmdir", "ln", "chmod", "chown", "truncate", "install", "dd", "rsync", "ditto", "unlink",
]);
const CONDITIONAL_MUTATING = new Map<string, Checker>([
	["defaults", defaultsWrites],
	["curl", curlWrites],
	["wget", wgetWrites],
	["patch", patchWrites],
	["tar", tarWrites],
	["unzip", unzipWrites],
	["gzip", gzipWrites],
	["gunzip", gzipWrites],
	["find", findWrites],
]);
// Without context these would flag every mention, so the raw token scan skips them.
const TOKEN_SKIPPED = new Set(["curl", "wget", "defaults", "find"]);
const TOKEN_MUTATING = new Set([
	...ALWAYS_MUTATING,
	...[...CONDITIONAL_MUTATING.keys()].filter((name) => !TOKEN_SKIPPED.has(name)),
]);
const TOKEN_SPLIT = /[\s;&|(){}`'"\\]+/;

const SED_NAMES = new Set(["sed", "gsed"]);
const SED_IN_PLACE_LONG = "--in-place";
const SED_TARGETS = new Set(["i"]);
const SED_STOPS = new Set([..."efl"]);
const PERL_NAME = "perl";
const PERL_STOPS = new Set([..."IMmCFDx"]);

const PYTHON_NAME = /^python(?:\d+(?:\.\d+)*)?$/;
const INLINE_FLAGS = new Set(["-c", "-e", "-E", "--eval", "-p", "--print"]);
const INLINE_CLUSTER_LETTERS = new Set(["e", "c"]);
const INFO_FLAGS = new Set(["--version", "-V", "-v", "--help", "-h"]);
const PYTHON_MODULE_FLAG = "-m";

type InterpreterSpec = { valueWords: Set<string>; clusterStops: Set<string>; inlineCluster: boolean };

const NODE_VALUE_WORDS = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader"]);
const PYTHON_SPEC: InterpreterSpec = { valueWords: new Set(["-W", "-X"]), clusterStops: new Set([..."WXm"]), inlineCluster: true };
const RUBY_SPEC: InterpreterSpec = { valueWords: new Set(["-I", "-r", "-C", "-E"]), clusterStops: new Set([..."IrCEK"]), inlineCluster: true };
const PERL_SPEC: InterpreterSpec = { valueWords: new Set(["-I", "-M", "-m", "-C"]), clusterStops: PERL_STOPS, inlineCluster: true };
const NODE_SPEC: InterpreterSpec = { valueWords: NODE_VALUE_WORDS, clusterStops: new Set(), inlineCluster: false };
const INTERPRETERS = new Map<string, InterpreterSpec>([
	["node", NODE_SPEC],
	["ruby", RUBY_SPEC],
	[PERL_NAME, PERL_SPEC],
	["deno", NODE_SPEC],
	["bun", NODE_SPEC],
]);

function interpreterSpec(name: string): InterpreterSpec | undefined {
	return PYTHON_NAME.test(name) ? PYTHON_SPEC : INTERPRETERS.get(name);
}

// Returns the offending flag (or the bare name when stdin is the script), undefined when a script file or module runs.
function inlineScript(name: string, spec: InterpreterSpec, cmd: SimpleCommand, args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === OPTION_END) return i + 1 < args.length ? undefined : stdinScript(name, cmd);
		if (arg === STDIN_DASH) return `${name} ${arg}`;
		if (!arg.startsWith(OPTION_PREFIX)) return undefined;
		if (arg === PYTHON_MODULE_FLAG && PYTHON_NAME.test(name)) return undefined;
		if (INFO_FLAGS.has(arg)) return undefined;
		if (INLINE_FLAGS.has(longName(arg))) return `${name} ${longName(arg)}`;
		if (spec.valueWords.has(arg)) {
			i++;
			continue;
		}
		if (!spec.inlineCluster || !isShortCluster(arg)) continue;
		const scan = scanCluster(arg, INLINE_CLUSTER_LETTERS, spec.clusterStops);
		if (scan.hit) return `${name} ${arg}`;
		if (scan.takesNext) i++;
	}
	return stdinScript(name, cmd);
}

function stdinScript(name: string, cmd: SimpleCommand): string | undefined {
	return cmd.stdin !== undefined ? name : undefined;
}

function teeWrites(args: Word[]): boolean {
	let options = true;
	for (const arg of args) {
		if (options && arg.text === OPTION_END) {
			options = false;
			continue;
		}
		if (options && arg.text.startsWith(OPTION_PREFIX) && arg.text !== STDIN_DASH) continue;
		if (!isProcessSubstitution(arg) && !isHarmlessPath(arg)) return true;
	}
	return false;
}

function snippet(name: string, args: string[]): string {
	return [name, ...args].join(" ").slice(0, MAX_SNIPPET_LENGTH);
}

function checkTokens(text: string, violations: string[]): void {
	for (const token of text.split(TOKEN_SPLIT)) {
		const name = basename(token);
		if (TOKEN_MUTATING.has(name)) violations.push(`${LABEL_MUTATION}: ${name}`);
	}
}

function checkCommand(cmd: SimpleCommand, violations: string[]): void {
	for (const redirect of cmd.redirects) {
		const violation = redirectViolation(redirect);
		if (violation !== undefined) violations.push(violation);
	}

	const index = commandIndex(cmd.words);
	if (index === undefined) return;
	const name = basename(cmd.words[index].text);
	const argWords = cmd.words.slice(index + 1);
	const args = argWords.map((word) => word.text);

	if (name === EVAL_NAME) violations.push(`${LABEL_SHELL_EVAL} "${EVAL_NAME}"`);

	// nestedScripts is not recursive, so the commands it returns go through checkCommands again.
	const nested = nestedScripts(cmd);
	if (nested.opaque) {
		const detail = nested.substitution !== undefined
			? SUBSTITUTION_DETAIL
			: nested.piped ? `${PIPE_PREFIX} ${name}` : `${name} ${SHELL_COMMAND_SUFFIX}`;
		violations.push(`${LABEL_SHELL_EVAL} "${detail}"`);
	}
	checkCommands(nested.commands, violations);
	// The nested source is not exposed, so fall back to the words of the wrapper command.
	if (nested.commands.some((inner) => inner.unterminated)) checkTokens(cmd.words.map((word) => word.text).join(" "), violations);

	if (ALWAYS_MUTATING.has(name) || CONDITIONAL_MUTATING.get(name)?.(args)) violations.push(`${LABEL_MUTATION}: ${name}`);

	if (SED_NAMES.has(name) && flagHit(args, SED_TARGETS, SED_STOPS, SED_IN_PLACE_LONG)) {
		violations.push(`${LABEL_SED} "${snippet(name, args)}"`);
	}
	if (name === PERL_NAME && flagHit(args, SED_TARGETS, PERL_STOPS)) violations.push(`${LABEL_PERL} "${snippet(name, args)}"`);
	if (name === TEE_NAME && teeWrites(argWords)) violations.push(`${LABEL_TEE} "${TEE_NAME}"`);

	const spec = interpreterSpec(name);
	if (spec !== undefined) {
		const inline = inlineScript(name, spec, cmd, args);
		if (inline !== undefined) violations.push(`${LABEL_INLINE} "${inline}"`);
	}
}

function checkCommands(commands: SimpleCommand[], violations: string[]): void {
	for (const cmd of commands) checkCommand(cmd, violations);
}

export function findViolations(command: string): string[] {
	const violations: string[] = [];
	const commands = parseCommands(command);
	checkCommands(commands, violations);
	// An unterminated quote makes the parse unreliable, so every token is a candidate: over-block rather than under-block.
	if (commands.some((cmd) => cmd.unterminated)) checkTokens(command, violations);
	return [...new Set(violations)];
}
