import { basename, commandIndex, nestedScripts, parseCommands, STDIN_PIPE, type SimpleCommand, type Word } from "../lib/shell.ts";

const GIT_NAME = "git";
const GIT_PATH_SUFFIX = "/git";
const GIT_WORD = /\bgit\b/;
const INTERPRETERS = new Set(["eval", "source", "."]);
const OPTION_PREFIX = "-";
const OPTION_END = "--";
const VALUE_SEPARATOR = "=";
const LONG_PREFIX = "--";

const LABEL_BARE = "git (bare)";
const LABEL_OPAQUE_SHELL = "git (opaque shell -c)";
const LABEL_DYNAMIC_EVAL = "git (dynamic eval)";
const LABEL_PIPED_SHELL = "git (piped to shell)";

// Global options that consume the following word, unless written with `=`.
const GLOBAL_VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);
const INFO_FLAGS = new Set(["--version", "--help"]);
const INFO_SUBCOMMANDS = new Set(["version", "help"]);

const READ_ONLY_SUBCOMMANDS = new Set([
	"status", "log", "diff", "show", "ls-files", "grep", "blame", "annotate", "describe", "shortlog", "rev-parse", "rev-list",
	"cat-file", "ls-tree", "merge-base", "name-rev", "for-each-ref", "show-ref", "show-branch", "check-ignore", "check-attr",
	"diff-tree", "diff-index", "diff-files", "count-objects", "var", "whatchanged", "ls-remote", "range-diff", "cherry",
	"verify-commit", "verify-tag",
]);

// Diff and revision-walker commands accept `--output=<file>`, which writes a file.
const OUTPUT_FLAG = "--output";
const OUTPUT_FLAG_VALUE = "--output=";

const LS_REMOTE_SUBCOMMAND = "ls-remote";
// --upload-pack (and its synonym --exec) and -u run a command.
const UPLOAD_PACK_LONG = ["--upload-pack", "--exec"];
const UPLOAD_PACK_SHORT = "-u";

const GREP_SUBCOMMAND = "grep";
// -O<pager> and --open-files-in-pager run a command.
const GREP_PAGER_SHORT = /^-[^-]*O/;
const GREP_PAGER_LONG = "--open-files-in-pager";

type Options = { flags: string[]; positionals: string[] };
type Checker = (args: string[]) => boolean;

// Splits args into flags and positionals; after `--` everything is positional.
function splitOptions(args: string[], valueOptions: Set<string> = new Set()): Options {
	const flags: string[] = [];
	const positionals: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === OPTION_END) {
			positionals.push(...args.slice(i + 1));
			break;
		}
		if (!arg.startsWith(OPTION_PREFIX) || arg === OPTION_PREFIX) {
			positionals.push(arg);
			continue;
		}
		flags.push(arg);
		if (valueOptions.has(arg)) i++;
	}
	return { flags, positionals };
}

function longName(flag: string): string {
	const end = flag.indexOf(VALUE_SEPARATOR);
	return end === -1 ? flag : flag.slice(0, end);
}

function isLong(flag: string): boolean {
	return flag.startsWith(LONG_PREFIX);
}

// Letters of a single-dash cluster such as `-vv`; empty for long flags.
function shortLetters(flag: string): string {
	return isLong(flag) ? "" : flag.slice(1);
}

function hasLong(flags: string[], names: Set<string>): boolean {
	return flags.some((flag) => isLong(flag) && names.has(longName(flag)));
}

function hasShort(flags: string[], letters: Set<string>): boolean {
	return flags.some((flag) => [...shortLetters(flag)].some((letter) => letters.has(letter)));
}

const BRANCH_WRITE_LONG = new Set([
	"--delete", "--move", "--copy", "--force", "--set-upstream-to", "--unset-upstream", "--edit-description", "--track", "--no-track",
	"--create-reflog",
]);
const BRANCH_WRITE_SHORT = new Set(["d", "D", "m", "M", "c", "C", "f", "u", "t"]);
const BRANCH_LIST_LONG = new Set([
	"--list", "--verbose", "--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "--show-current", "--all", "--remotes",
]);
const BRANCH_LIST_SHORT = new Set(["l", "v", "a", "r"]);

// Git refuses a branch name together with -a/-r, and -v implies list mode, so those flags make positionals patterns.
const branchAllowed: Checker = (args) => {
	const { flags, positionals } = splitOptions(args);
	if (hasLong(flags, BRANCH_WRITE_LONG) || hasShort(flags, BRANCH_WRITE_SHORT)) return false;
	return positionals.length === 0 || hasLong(flags, BRANCH_LIST_LONG) || hasShort(flags, BRANCH_LIST_SHORT);
};

const TAG_WRITE_LONG = new Set([
	"--annotate", "--sign", "--local-user", "--force", "--delete", "--message", "--file", "--edit", "--create-reflog",
]);
const TAG_WRITE_SHORT = new Set(["s", "u", "f", "d", "m", "F", "e"]);
const TAG_LIST_LONG = new Set(["--list", "--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "--verify"]);
const TAG_LIST_SHORT = new Set(["l", "n", "v"]);

const tagAllowed: Checker = (args) => {
	const { flags, positionals } = splitOptions(args);
	if (hasLong(flags, TAG_WRITE_LONG) || hasShort(flags, TAG_WRITE_SHORT)) return false;
	return positionals.length === 0 || hasLong(flags, TAG_LIST_LONG) || hasShort(flags, TAG_LIST_SHORT);
};

const REMOTE_READ_ACTIONS = new Set(["show", "get-url"]);

const remoteAllowed: Checker = (args) => {
	const { positionals } = splitOptions(args);
	return positionals.length === 0 || REMOTE_READ_ACTIONS.has(positionals[0]);
};

const CONFIG_VALUE_OPTIONS = new Set(["-f", "--file", "--blob", "--type", "--default"]);
const CONFIG_WRITE_FLAGS = new Set([
	"--add", "--replace-all", "--unset", "--unset-all", "--rename-section", "--remove-section", "--edit",
]);
const CONFIG_WRITE_SHORT = "-e";
const CONFIG_WRITE_ACTIONS = new Set(["set", "unset", "rename-section", "remove-section", "edit"]);
const CONFIG_READ_FLAGS = new Set([
	"--get", "--get-all", "--get-regexp", "--get-urlmatch", "--get-color", "--get-colorbool", "--list",
]);
const CONFIG_READ_SHORT = "-l";
const CONFIG_READ_ACTIONS = new Set(["get", "list"]);

const configAllowed: Checker = (args) => {
	const { flags, positionals } = splitOptions(args, CONFIG_VALUE_OPTIONS);
	if (hasLong(flags, CONFIG_WRITE_FLAGS) || flags.includes(CONFIG_WRITE_SHORT)) return false;
	if (positionals.length > 0 && CONFIG_WRITE_ACTIONS.has(positionals[0])) return false;
	if (hasLong(flags, CONFIG_READ_FLAGS) || flags.includes(CONFIG_READ_SHORT)) return true;
	if (positionals.length > 0 && CONFIG_READ_ACTIONS.has(positionals[0])) return true;
	return positionals.length === 1;
};

const STASH_READ_ACTIONS = new Set(["list", "show"]);

const stashAllowed: Checker = (args) => {
	const { positionals } = splitOptions(args);
	return positionals.length > 0 && STASH_READ_ACTIONS.has(positionals[0]);
};

const REFLOG_WRITE_ACTIONS = new Set(["expire", "delete", "drop"]);

const reflogAllowed: Checker = (args) => {
	const { positionals } = splitOptions(args);
	return positionals.length === 0 || !REFLOG_WRITE_ACTIONS.has(positionals[0]);
};

const WORKTREE_READ_ACTION = "list";

const worktreeAllowed: Checker = (args) => splitOptions(args).positionals[0] === WORKTREE_READ_ACTION;

const NOTES_READ_ACTIONS = new Set(["list", "show"]);

const notesAllowed: Checker = (args) => {
	const { positionals } = splitOptions(args);
	return positionals.length === 0 || NOTES_READ_ACTIONS.has(positionals[0]);
};

const SUBMODULE_READ_ACTION = "status";

const submoduleAllowed: Checker = (args) => {
	const { positionals } = splitOptions(args);
	return positionals.length === 0 || positionals[0] === SUBMODULE_READ_ACTION;
};

const SYMBOLIC_REF_WRITE_FLAGS = new Set(["-d", "--delete"]);

const symbolicRefAllowed: Checker = (args) => {
	const { flags, positionals } = splitOptions(args);
	return positionals.length === 1 && !flags.some((flag) => SYMBOLIC_REF_WRITE_FLAGS.has(flag));
};

const CONDITIONAL_SUBCOMMANDS = new Map<string, Checker>([
	["branch", branchAllowed],
	["tag", tagAllowed],
	["remote", remoteAllowed],
	["config", configAllowed],
	["stash", stashAllowed],
	["reflog", reflogAllowed],
	["worktree", worktreeAllowed],
	["notes", notesAllowed],
	["submodule", submoduleAllowed],
	["symbolic-ref", symbolicRefAllowed],
]);

function writesOutputFile(args: string[]): boolean {
	return args.some((arg) => arg === OUTPUT_FLAG || arg.startsWith(OUTPUT_FLAG_VALUE));
}

function runsPager(args: string[]): boolean {
	return args.some((arg) => GREP_PAGER_SHORT.test(arg) || arg.startsWith(GREP_PAGER_LONG));
}

function runsUploadPack(args: string[]): boolean {
	return args.some(
		(arg) => (arg.startsWith(UPLOAD_PACK_SHORT) && !arg.startsWith(LONG_PREFIX)) || UPLOAD_PACK_LONG.includes(longName(arg)),
	);
}

function readOnlyAllowed(subcommand: string, args: string[]): boolean {
	if (writesOutputFile(args)) return false;
	if (subcommand === LS_REMOTE_SUBCOMMAND && runsUploadPack(args)) return false;
	if (subcommand === GREP_SUBCOMMAND && runsPager(args)) return false;
	return true;
}

function gitViolation(words: Word[], start: number): string | undefined {
	let i = start;
	let info = false;
	while (i < words.length && words[i].text.startsWith(OPTION_PREFIX)) {
		const text = words[i].text;
		if (INFO_FLAGS.has(text)) info = true;
		i += GLOBAL_VALUE_OPTIONS.has(text) ? 2 : 1;
	}

	const subcommand = words[i]?.text;
	if (subcommand === undefined) return info ? undefined : LABEL_BARE;
	if (INFO_SUBCOMMANDS.has(subcommand)) return undefined;

	const args = words.slice(i + 1).map((word) => word.text);
	const label = `${GIT_NAME} ${subcommand}`;
	if (READ_ONLY_SUBCOMMANDS.has(subcommand)) return readOnlyAllowed(subcommand, args) ? undefined : label;
	const checker = CONDITIONAL_SUBCOMMANDS.get(subcommand);
	return checker?.(args) ? undefined : label;
}

type Context = { source: string; violations: string[] };

function mentionsGit(commands: SimpleCommand[]): boolean {
	return commands.some((cmd) => cmd.words.some((word) => word.text === GIT_NAME || word.text.endsWith(GIT_PATH_SUFFIX)));
}

// `earlier` holds the commands before this one in the same pipeline.
function checkCommand(cmd: SimpleCommand, earlier: SimpleCommand[], context: Context): void {
	const { violations } = context;
	const index = commandIndex(cmd.words);
	if (index === undefined) return;
	const name = basename(cmd.words[index].text);

	if (name === GIT_NAME) {
		const violation = gitViolation(cmd.words, index + 1);
		if (violation !== undefined) violations.push(violation);
		return;
	}

	const args = cmd.words.slice(index + 1);
	if (INTERPRETERS.has(name)) {
		for (const arg of args) {
			if (!arg.dynamic) checkCommands(parseCommands(arg.text), context);
			else if (GIT_WORD.test(arg.text)) violations.push(LABEL_DYNAMIC_EVAL);
		}
		return;
	}

	// nestedScripts is not recursive, so the commands it returns go through checkCommands again.
	const nested = nestedScripts(cmd);
	if (nested.opaque && args.some((arg) => arg.dynamic && GIT_WORD.test(arg.text))) violations.push(LABEL_OPAQUE_SHELL);
	// A shell reading its script from a pipe hides the command; flag it when git appears anywhere upstream.
	if (nested.piped && (mentionsGit(earlier) || GIT_WORD.test(context.source))) violations.push(LABEL_PIPED_SHELL);
	checkCommands(nested.commands, context);
}

function checkCommands(commands: SimpleCommand[], context: Context): void {
	let pipelineStart = 0;
	commands.forEach((cmd, i) => {
		if (cmd.stdin !== STDIN_PIPE) pipelineStart = i;
		checkCommand(cmd, commands.slice(pipelineStart, i), context);
	});
}

export function findViolations(command: string): string[] {
	const context: Context = { source: command, violations: [] };
	checkCommands(parseCommands(command), context);
	return context.violations;
}
