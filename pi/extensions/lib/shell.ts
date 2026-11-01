// quoted: any part was quoted. dynamic: contains $VAR, ${...}, $(...), $((...)), backticks or a process substitution.
// text has quotes removed and escapes resolved; expansions stay as raw source text.
export type Word = { text: string; quoted: boolean; dynamic: boolean };

export type Redirect = { op: string; fd?: string; target: string; targetDynamic: boolean };

export type SimpleCommand = {
	words: Word[];
	redirects: Redirect[];
	stdin?: "pipe" | "heredoc" | "herestring";
	heredocBody?: string;
	unterminated: boolean;
};

// piped: the script comes from a pipe, so there is no text to inspect.
// substitution: the script comes from this `<(...)`, which is not inspected either.
export type NestedScripts = { commands: SimpleCommand[]; opaque: boolean; piped?: boolean; substitution?: string };

export const STDIN_PIPE = "pipe";
const STDIN_HEREDOC = "heredoc";
const STDIN_HERESTRING = "herestring";

const BACKSLASH = "\\";
const SINGLE_QUOTE = "'";
const DOUBLE_QUOTE = '"';
const DOLLAR = "$";
const BACKTICK = "`";
const NEWLINE = "\n";
const OPEN_PAREN = "(";
const CLOSE_PAREN = ")";
const OPEN_BRACE = "{";
const CLOSE_BRACE = "}";
const HASH = "#";
const LESS = "<";
const GREATER = ">";
const AMP = "&";
const PIPE = "|";
const SEMICOLON = ";";
const SLASH = "/";

const OP_HEREDOC = "<<";
const OP_HEREDOC_STRIP = "<<-";
const OP_HERESTRING = "<<<";
const PIPE_AND = "|&";
const DOUBLE_AMP = "&&";
const DOUBLE_PIPE = "||";
const AMP_GREATER = "&>";
const ARITHMETIC_OPEN = "$((";
const COND_OPEN = "[[";
const COND_CLOSE = "]]";
const ARITHMETIC_COMMAND = "((";
// Inside `[[ ]]` these are conditional syntax, not separators or redirects. `||` comes before `|` so the longer one wins.
const COND_OPERATORS = [DOUBLE_AMP, DOUBLE_PIPE, PIPE, OPEN_PAREN, CLOSE_PAREN, LESS, GREATER];

const CASE_KEYWORD = "case";
const IN_KEYWORD = "in";
const ESAC_KEYWORD = "esac";
const FOR_KEYWORD = "for";
// Longest first so that `;;&` is not read as `;;`.
const CASE_TERMINATORS = [";;&", ";;", ";&"];
// A case clause is read as subject (`case WORD in`), then pattern lists up to `)`, then the commands of the clause.
const CASE_SUBJECT = "subject";
const CASE_PATTERNS = "patterns";
const CASE_BODY = "body";
type CasePhase = typeof CASE_SUBJECT | typeof CASE_PATTERNS | typeof CASE_BODY;
// A `( ... )` or `{ ...; }` group; piped means the group itself receives a pipe.
type Group = { paren: boolean; piped: boolean };

const BLANKS = new Set([" ", "\t", "\r"]);
const WORD_BREAKS = new Set([...BLANKS, NEWLINE, SEMICOLON, AMP, PIPE, OPEN_PAREN, CLOSE_PAREN, LESS, GREATER]);
// Longest first so that prefixes do not shadow longer operators.
const REDIRECT_OPS = ["<<<", "<<-", "&>>", "<<", ">>", ">|", ">&", "&>", "<&", "<>", "<", ">"];
const DIGIT = /[0-9]/;
const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DOLLAR_SPECIAL = /[0-9@*#?!$-]/;
const DOUBLE_QUOTE_ESCAPABLE = new Set([DOLLAR, BACKTICK, DOUBLE_QUOTE, BACKSLASH]);
const BACKTICK_ESCAPABLE = new Set([DOLLAR, BACKTICK, BACKSLASH]);
const BACKTICK_IN_QUOTES_ESCAPABLE = new Set([...BACKTICK_ESCAPABLE, DOUBLE_QUOTE]);
const ANSI_C_ESCAPES = new Map([
	["n", "\n"], ["t", "\t"], ["r", "\r"], ["a", "\x07"], ["b", "\b"], ["e", "\x1b"], ["f", "\f"], ["v", "\v"],
	[BACKSLASH, BACKSLASH], [SINGLE_QUOTE, SINGLE_QUOTE], [DOUBLE_QUOTE, DOUBLE_QUOTE], ["?", "?"],
]);

type Expansion = { text: string; dynamic: boolean; unterminated: boolean };
type ReadWord = { word: Word; unterminated: boolean };
type PendingHeredoc = { cmd: SimpleCommand; delimiter: string; strip: boolean; quoted: boolean };

function emptyCommand(): SimpleCommand {
	return { words: [], redirects: [], unterminated: false };
}

class Scanner {
	private pos = 0;
	private readonly src: string;
	private readonly out: SimpleCommand[];

	constructor(src: string, out: SimpleCommand[]) {
		this.src = src;
		this.out = out;
	}

	// Parses until EOF, or until the closing paren inside $( ), <( ) and >( ).
	// Returns true when something in the list was left unterminated.
	parseList(closedByParen: boolean): boolean {
		const src = this.src;
		let unterminated = false;
		let cmd = emptyCommand();
		let hasContent = false;
		let inCond = false;
		const pending: PendingHeredoc[] = [];
		const groups: Group[] = [];
		const cases: CasePhase[] = [];

		// Commands inside a piped group are treated as reading the pipe, whatever their position in it.
		const finish = (piped: boolean) => {
			if (hasContent) this.out.push(cmd);
			cmd = emptyCommand();
			if (piped || groups.at(-1)?.piped) cmd.stdin = STDIN_PIPE;
			hasContent = false;
			inCond = false;
		};

		const startGroup = (paren: boolean) => {
			const piped = !hasContent && cmd.stdin === STDIN_PIPE;
			if (paren) finish(false);
			groups.push({ paren, piped });
			if (piped) cmd.stdin = STDIN_PIPE;
		};

		const endGroup = (paren: boolean): boolean => {
			if (groups.at(-1)?.paren !== paren) return false;
			groups.pop();
			if (!hasContent) {
				if (groups.at(-1)?.piped) cmd.stdin = STDIN_PIPE;
				else delete cmd.stdin;
			}
			return true;
		};

		while (this.pos < src.length) {
			const ch = src[this.pos];
			if (BLANKS.has(ch)) {
				this.pos++;
			} else if (ch === BACKSLASH && src[this.pos + 1] === NEWLINE) {
				this.pos += 2;
			} else if (ch === HASH) {
				const eol = src.indexOf(NEWLINE, this.pos);
				this.pos = eol === -1 ? src.length : eol;
			} else if (ch === NEWLINE) {
				this.pos++;
				// A pending pipe survives a newline: `a |\n b`.
				if (hasContent) finish(false);
				if (pending.length > 0) this.readHeredocBodies(pending);
			} else if (cases.at(-1) === CASE_PATTERNS) {
				// Pattern lists are data: `|` separates alternatives and the first `)` ends the list.
				if (ch === CLOSE_PAREN) {
					cases[cases.length - 1] = CASE_BODY;
					this.pos++;
				} else if (ch === OPEN_PAREN || ch === PIPE) {
					this.pos++;
				} else if (this.atWordStart()) {
					const { word, unterminated: wordUnterminated } = this.readWord();
					if (wordUnterminated) unterminated = cmd.unterminated = true;
					if (!word.quoted && word.text === ESAC_KEYWORD) cases.pop();
				} else {
					this.pos++;
				}
			} else if (inCond && this.condOperatorAt() !== undefined) {
				const operator = this.condOperatorAt()!;
				this.pos += operator.length;
				cmd.words.push({ text: operator, quoted: true, dynamic: false });
			} else if (src.startsWith(ARITHMETIC_COMMAND, this.pos) && (atCommandPosition(cmd) || isForHeader(cmd)) && this.skipArithmetic()) {
				cmd.words.push({ text: ARITHMETIC_COMMAND, quoted: true, dynamic: true });
				hasContent = true;
			} else if (ch === CLOSE_PAREN) {
				this.pos++;
				finish(false);
				if (!endGroup(true) && closedByParen) return unterminated;
			} else if (ch === SEMICOLON && cases.at(-1) === CASE_BODY && this.caseTerminatorAt() !== undefined) {
				this.pos += this.caseTerminatorAt()!.length;
				finish(false);
				cases[cases.length - 1] = CASE_PATTERNS;
			} else if (ch === OPEN_PAREN) {
				this.pos++;
				startGroup(true);
			} else if (ch === SEMICOLON) {
				this.pos++;
				finish(false);
			} else if (src.startsWith(PIPE_AND, this.pos)) {
				this.pos += PIPE_AND.length;
				finish(true);
			} else if (src.startsWith(DOUBLE_PIPE, this.pos)) {
				this.pos += DOUBLE_PIPE.length;
				finish(false);
			} else if (ch === PIPE) {
				this.pos++;
				finish(true);
			} else if (src.startsWith(DOUBLE_AMP, this.pos)) {
				this.pos += DOUBLE_AMP.length;
				finish(false);
			} else if (ch === AMP && !src.startsWith(AMP_GREATER, this.pos)) {
				this.pos++;
				finish(false);
			} else {
				const redirect = this.matchRedirect();
				if (redirect !== undefined) {
					this.pos = redirect.end;
					const operand = this.readOperand();
					if (operand?.unterminated) unterminated = cmd.unterminated = true;
					const target = operand?.word.text ?? "";
					const targetDynamic = operand?.word.dynamic ?? false;
					hasContent = true;
					if (redirect.op === OP_HEREDOC || redirect.op === OP_HEREDOC_STRIP) {
						cmd.stdin = STDIN_HEREDOC;
						// A quoted or escaped delimiter makes the body pure data; otherwise substitutions still run.
						const quoted = operand === undefined || operand.word.quoted || operand.raw.includes(BACKSLASH);
						pending.push({ cmd, delimiter: target, strip: redirect.op === OP_HEREDOC_STRIP, quoted });
					} else {
						// The here-string data is kept as a redirect so callers can inspect it.
						if (redirect.op === OP_HERESTRING) cmd.stdin = STDIN_HERESTRING;
						const entry: Redirect = { op: redirect.op, target, targetDynamic };
						if (redirect.fd !== undefined) entry.fd = redirect.fd;
						cmd.redirects.push(entry);
					}
				} else if (this.atWordStart()) {
					const { word, unterminated: wordUnterminated } = this.readWord();
					if (wordUnterminated) unterminated = cmd.unterminated = true;
					const isGroupBrace = !word.quoted && (word.text === OPEN_BRACE || word.text === CLOSE_BRACE);
					const dropped = isGroupBrace && (cmd.words.length === 0 || (word.text === OPEN_BRACE && atCommandPosition(cmd)));
					// `{` and `}` only separate at command position; elsewhere they are plain arguments.
					if (!dropped) {
						if (!word.quoted && word.text === COND_OPEN && atCommandPosition(cmd)) inCond = true;
						else if (!word.quoted && word.text === COND_CLOSE) inCond = false;
						else if (!word.quoted && word.text === CASE_KEYWORD && atCommandPosition(cmd)) cases.push(CASE_SUBJECT);
						else if (!word.quoted && word.text === ESAC_KEYWORD && cmd.words.length === 0 && cases.at(-1) === CASE_BODY) cases.pop();
						cmd.words.push(word);
						hasContent = true;
						if (!word.quoted && word.text === IN_KEYWORD && cases.at(-1) === CASE_SUBJECT) {
							cases[cases.length - 1] = CASE_PATTERNS;
							finish(false);
						}
					} else if (word.text === OPEN_BRACE) {
						groups.push({ paren: false, piped: !hasContent && cmd.stdin === STDIN_PIPE });
					} else {
						endGroup(false);
					}
				} else {
					this.pos++;
				}
			}
		}

		if (pending.length > 0) this.readHeredocBodies(pending);
		finish(false);
		return unterminated || closedByParen;
	}

	// Heredoc body with an unquoted delimiter: only substitutions matter, the rest is data.
	scanExpansions(): boolean {
		const src = this.src;
		let unterminated = false;
		while (this.pos < src.length) {
			const ch = src[this.pos];
			if (ch === BACKSLASH) this.pos += 2;
			else if (ch === DOLLAR) unterminated ||= this.readDollar().unterminated;
			else if (ch === BACKTICK) unterminated ||= this.readBacktick(false).unterminated;
			else this.pos++;
		}
		return unterminated;
	}

	private atWordStart(): boolean {
		if (this.pos >= this.src.length) return false;
		return !WORD_BREAKS.has(this.src[this.pos]) || this.isProcessSubstitution();
	}

	private isProcessSubstitution(): boolean {
		const ch = this.src[this.pos];
		return (ch === LESS || ch === GREATER) && this.src[this.pos + 1] === OPEN_PAREN;
	}

	private matchRedirect(): { op: string; fd?: string; end: number } | undefined {
		const src = this.src;
		let p = this.pos;
		while (p < src.length && DIGIT.test(src[p])) p++;
		const hasFd = p > this.pos && (src[p] === LESS || src[p] === GREATER);
		const fd = hasFd ? src.slice(this.pos, p) : undefined;
		if (!hasFd) p = this.pos;
		if ((src[p] === LESS || src[p] === GREATER) && src[p + 1] === OPEN_PAREN) return undefined;
		for (const op of REDIRECT_OPS) {
			if (src.startsWith(op, p)) return { op, fd, end: p + op.length };
		}
		return undefined;
	}

	private caseTerminatorAt(): string | undefined {
		return CASE_TERMINATORS.find((terminator) => this.src.startsWith(terminator, this.pos));
	}

	private condOperatorAt(): string | undefined {
		const operator = COND_OPERATORS.find((candidate) => this.src.startsWith(candidate, this.pos));
		return operator !== undefined && !this.isProcessSubstitution() ? operator : undefined;
	}

	// Called at `((` in command position; consumes through the matching `))`, or restores pos and returns false.
	private skipArithmetic(): boolean {
		const src = this.src;
		const start = this.pos;
		let depth = 0;
		let firstClose = -1;
		while (this.pos < src.length) {
			const ch = src[this.pos];
			if (ch === BACKSLASH) {
				this.pos += 2;
			} else if (ch === DOLLAR) {
				this.readDollar();
			} else if (ch === BACKTICK) {
				this.readBacktick(false);
			} else {
				this.pos++;
				if (ch === OPEN_PAREN) {
					depth++;
				} else if (ch === CLOSE_PAREN) {
					depth--;
					if (depth === 1) firstClose = this.pos;
					else if (depth === 0) {
						if (this.pos - 1 === firstClose) return true;
						break;
					}
				}
			}
		}
		this.pos = start;
		return false;
	}

	private readOperand(): (ReadWord & { raw: string }) | undefined {
		while (this.pos < this.src.length && BLANKS.has(this.src[this.pos])) this.pos++;
		if (!this.atWordStart()) return undefined;
		const start = this.pos;
		const read = this.readWord();
		return { ...read, raw: this.src.slice(start, this.pos) };
	}

	private readHeredocBodies(pending: PendingHeredoc[]): void {
		const src = this.src;
		for (const { cmd, delimiter, strip, quoted } of pending) {
			let body = "";
			let found = false;
			while (this.pos < src.length) {
				const eol = src.indexOf(NEWLINE, this.pos);
				const lineEnd = eol === -1 ? src.length : eol;
				const raw = src.slice(this.pos, lineEnd);
				this.pos = eol === -1 ? src.length : eol + 1;
				const line = strip ? raw.replace(/^\t+/, "") : raw;
				if (line === delimiter) {
					found = true;
					break;
				}
				body += line + NEWLINE;
			}
			cmd.heredocBody = body;
			if (!found) cmd.unterminated = true;
			if (!quoted && new Scanner(body, this.out).scanExpansions()) cmd.unterminated = true;
		}
		pending.length = 0;
	}

	private readWord(): ReadWord {
		const src = this.src;
		let text = "";
		let quoted = false;
		let dynamic = false;
		let unterminated = false;

		const absorb = (expansion: Expansion) => {
			text += expansion.text;
			dynamic ||= expansion.dynamic;
			unterminated ||= expansion.unterminated;
		};

		while (this.pos < src.length) {
			const ch = src[this.pos];
			if (ch === BACKSLASH) {
				const next = src[this.pos + 1];
				if (next === undefined) {
					text += ch;
					this.pos++;
				} else {
					if (next !== NEWLINE) text += next;
					this.pos += 2;
				}
			} else if (ch === SINGLE_QUOTE) {
				quoted = true;
				const end = src.indexOf(SINGLE_QUOTE, this.pos + 1);
				if (end === -1) {
					text += src.slice(this.pos + 1);
					this.pos = src.length;
					unterminated = true;
				} else {
					text += src.slice(this.pos + 1, end);
					this.pos = end + 1;
				}
			} else if (ch === DOUBLE_QUOTE) {
				quoted = true;
				this.pos++;
				absorb(this.readDoubleQuoted());
			} else if (ch === DOLLAR && src[this.pos + 1] === SINGLE_QUOTE) {
				quoted = true;
				absorb(this.readAnsiC());
			} else if (ch === DOLLAR) {
				absorb(this.readDollar());
			} else if (ch === BACKTICK) {
				absorb(this.readBacktick(false));
			} else if (this.isProcessSubstitution()) {
				const start = this.pos;
				this.pos += 2;
				const inner = this.parseList(true);
				absorb({ text: src.slice(start, this.pos), dynamic: true, unterminated: inner });
			} else if (WORD_BREAKS.has(ch)) {
				break;
			} else {
				text += ch;
				this.pos++;
			}
		}

		return { word: { text, quoted, dynamic }, unterminated };
	}

	// Called with pos just after the opening quote.
	private readDoubleQuoted(): Expansion {
		const src = this.src;
		const result: Expansion = { text: "", dynamic: false, unterminated: false };
		while (true) {
			if (this.pos >= src.length) {
				result.unterminated = true;
				return result;
			}
			const ch = src[this.pos];
			if (ch === DOUBLE_QUOTE) {
				this.pos++;
				return result;
			}
			if (ch === BACKSLASH) {
				const next = src[this.pos + 1];
				if (next === undefined) {
					result.text += ch;
					this.pos++;
				} else {
					if (DOUBLE_QUOTE_ESCAPABLE.has(next)) result.text += next;
					else if (next !== NEWLINE) result.text += ch + next;
					this.pos += 2;
				}
				continue;
			}
			const expansion = ch === DOLLAR ? this.readDollar() : ch === BACKTICK ? this.readBacktick(true) : undefined;
			if (expansion === undefined) {
				result.text += ch;
				this.pos++;
				continue;
			}
			result.text += expansion.text;
			result.dynamic ||= expansion.dynamic;
			result.unterminated ||= expansion.unterminated;
		}
	}

	// Called at `$'`.
	private readAnsiC(): Expansion {
		const src = this.src;
		let text = "";
		this.pos += 2;
		while (this.pos < src.length) {
			const ch = src[this.pos];
			if (ch === SINGLE_QUOTE) {
				this.pos++;
				return { text, dynamic: false, unterminated: false };
			}
			if (ch === BACKSLASH && this.pos + 1 < src.length) {
				const next = src[this.pos + 1];
				text += ANSI_C_ESCAPES.get(next) ?? ch + next;
				this.pos += 2;
			} else {
				text += ch;
				this.pos++;
			}
		}
		return { text, dynamic: false, unterminated: true };
	}

	// Called at `$` outside `$'`.
	private readDollar(): Expansion {
		const src = this.src;
		const start = this.pos;
		const next = src[start + 1];

		if (src.startsWith(ARITHMETIC_OPEN, start)) {
			let depth = 2;
			let unterminated = false;
			this.pos += ARITHMETIC_OPEN.length;
			// Substitutions in the body still run, so they are parsed instead of skipped.
			while (this.pos < src.length && depth > 0) {
				const ch = src[this.pos];
				if (ch === BACKSLASH) {
					this.pos += 2;
				} else if (ch === DOLLAR) {
					unterminated ||= this.readDollar().unterminated;
				} else if (ch === BACKTICK) {
					unterminated ||= this.readBacktick(false).unterminated;
				} else {
					if (ch === OPEN_PAREN) depth++;
					else if (ch === CLOSE_PAREN) depth--;
					this.pos++;
				}
			}
			this.pos = Math.min(this.pos, src.length);
			return { text: src.slice(start, this.pos), dynamic: true, unterminated: unterminated || depth > 0 };
		}
		if (next === OPEN_PAREN) {
			this.pos += 2;
			const unterminated = this.parseList(true);
			return { text: src.slice(start, this.pos), dynamic: true, unterminated };
		}
		if (next === OPEN_BRACE) {
			let closed = false;
			let unterminated = false;
			this.pos += 2;
			// The body can hold substitutions and nested `${...}`; the first `}` outside them closes it.
			while (this.pos < src.length) {
				const ch = src[this.pos];
				if (ch === BACKSLASH) {
					this.pos += 2;
				} else if (ch === CLOSE_BRACE) {
					this.pos++;
					closed = true;
					break;
				} else if (ch === DOLLAR) {
					unterminated ||= this.readDollar().unterminated;
				} else if (ch === BACKTICK) {
					unterminated ||= this.readBacktick(false).unterminated;
				} else if (ch === DOUBLE_QUOTE) {
					this.pos++;
					unterminated ||= this.readDoubleQuoted().unterminated;
				} else {
					this.pos++;
				}
			}
			this.pos = Math.min(this.pos, src.length);
			return { text: src.slice(start, this.pos), dynamic: true, unterminated: unterminated || !closed };
		}
		if (next !== undefined && IDENT_START.test(next)) {
			this.pos += 2;
			while (this.pos < src.length && IDENT_PART.test(src[this.pos])) this.pos++;
			return { text: src.slice(start, this.pos), dynamic: true, unterminated: false };
		}
		if (next !== undefined && DOLLAR_SPECIAL.test(next)) {
			this.pos += 2;
			return { text: src.slice(start, this.pos), dynamic: true, unterminated: false };
		}
		this.pos++;
		return { text: DOLLAR, dynamic: false, unterminated: false };
	}

	// Called at a backtick. The body is unescaped first, then parsed as its own script.
	private readBacktick(inDoubleQuote: boolean): Expansion {
		const src = this.src;
		const start = this.pos;
		const escapable = inDoubleQuote ? BACKTICK_IN_QUOTES_ESCAPABLE : BACKTICK_ESCAPABLE;
		let body = "";
		this.pos++;
		while (this.pos < src.length && src[this.pos] !== BACKTICK) {
			const ch = src[this.pos];
			if (ch === BACKSLASH && escapable.has(src[this.pos + 1])) {
				body += src[this.pos + 1];
				this.pos += 2;
			} else {
				body += ch;
				this.pos++;
			}
		}
		const closed = this.pos < src.length;
		if (closed) this.pos++;
		const inner = new Scanner(body, this.out).parseList(false);
		return { text: src.slice(start, this.pos), dynamic: true, unterminated: inner || !closed };
	}
}

export function parseCommands(source: string): SimpleCommand[] {
	const out: SimpleCommand[] = [];
	new Scanner(source, out).parseList(false);
	return out;
}

export function basename(name: string): string {
	return name.slice(name.lastIndexOf(SLASH) + 1);
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;
const KEYWORDS = new Set(["if", "then", "elif", "else", "do", "while", "until", "!", "time", OPEN_BRACE]);
const NO_COMMAND = new Set(["for", "select", "case", "fi", "done", "esac"]);
const FUNCTION_KEYWORD = "function";
const OPTION_END = "--";
const OPTION_PREFIX = "-";
const LONG_PREFIX = "--";
const SPLIT_LETTER = "S";
const SPLIT_LONG = "--split-string";
const SPLIT_LONG_VALUE = "--split-string=";
// Env options (other than -S) that take a value, so a following S is part of that value.
const SPLIT_VALUE_LETTERS = new Set(["u", "C", "P"]);
const SHORT_VALUE_OPTION = /^-[A-Za-z]$/;

// `for ((init; cond; step))`: the parens after a bare `for` are arithmetic.
function isForHeader(cmd: SimpleCommand): boolean {
	return cmd.words.length === 1 && !cmd.words[0].quoted && cmd.words[0].text === FOR_KEYWORD;
}

// True while only keywords precede, so the next word is where a command (or group opener) can start.
function atCommandPosition(cmd: SimpleCommand): boolean {
	return cmd.words.every((word) => !word.quoted && KEYWORDS.has(word.text));
}

type WrapperSpec = {
	values: Set<string>;
	// Single-letter value options, so that `-iu root` consumes the value of the cluster's last letter.
	letters: Set<string>;
	// Words after the options that are not the command (a duration, a lock file, a directory).
	positionals: number;
	// The command follows a `--` when there is one (mise exec TOOL -- CMD).
	dashDash: boolean;
	// env -S STRING: the string is a command line.
	splits: boolean;
};

function wrapper(values: string[], extra: Partial<Pick<WrapperSpec, "positionals" | "dashDash" | "splits">> = {}): WrapperSpec {
	return {
		values: new Set(values),
		letters: new Set(values.filter((value) => SHORT_VALUE_OPTION.test(value)).map((value) => value[1])),
		positionals: extra.positionals ?? 0,
		dashDash: extra.dashDash ?? false,
		splits: extra.splits ?? false,
	};
}

const COMMAND_NAME = "command";
// `command -v NAME` and `command -V NAME` look NAME up instead of running it.
const LOOKUP_LETTERS = new Set(["v", "V"]);
// These read their standard input themselves, so the command they run does not inherit a pipe.
const STDIN_CONSUMERS = new Set(["xargs", "parallel"]);
const TIMEOUT_OPTIONS = ["-s", "-k", "--signal", "--kill-after"];
const UV_RUN_OPTIONS = [
	"--with", "--with-requirements", "--with-editable", "--python", "-p", "--directory", "--project", "--env-file", "--package",
	"--extra", "--group", "--no-group", "--only-group", "-w",
];
const MISE_EXEC = wrapper(["-C", "--cd", "-j", "--jobs"], { dashDash: true });
const EXEC_SUBCOMMAND = "exec";
const RUN_SUBCOMMAND = "run";

// Wrapper name -> options that consume the next word.
const WRAPPERS = new Map<string, WrapperSpec>([
	["sudo", wrapper(["-u", "-g", "-h", "-p", "-C", "-r", "-t", "-T", "-U", "-D", "--user", "--group", "--host", "--prompt", "--chdir", "--role", "--type"])],
	["doas", wrapper(["-u", "-C"])],
	["env", wrapper(["-u", "-C", "-P", "--unset", "--chdir"], { splits: true })],
	[COMMAND_NAME, wrapper([])],
	["exec", wrapper(["-a"])],
	["builtin", wrapper([])],
	["nohup", wrapper([])],
	["time", wrapper([])],
	[
		"xargs",
		wrapper([
			"-I", "-J", "-R", "-S", "-n", "-P", "-L", "-d", "-E", "-s", "-a", "--arg-file", "--max-args", "--max-procs", "--max-lines",
			"--delimiter", "--max-chars",
		]),
	],
	["nice", wrapper(["-n", "--adjustment"])],
	["timeout", wrapper(TIMEOUT_OPTIONS, { positionals: 1 })],
	["gtimeout", wrapper(TIMEOUT_OPTIONS, { positionals: 1 })],
	["stdbuf", wrapper(["-i", "-o", "-e"])],
	["caffeinate", wrapper(["-t", "-w"])],
	// The command is the words before `:::`; what follows is data.
	["parallel", wrapper(["-j", "-n", "-N", "-S", "-a", "-I", "-L", "-d", "--jobs", "--max-args", "--sshlogin", "--arg-file", "--delimiter"])],
	["watch", wrapper(["-n", "--interval"])],
	["unbuffer", wrapper([])],
	["chronic", wrapper([])],
	["ionice", wrapper(["-c", "-n", "-p", "-P", "-u", "--class", "--classdata"])],
	["flock", wrapper(["-w", "-E", "--timeout", "--wait", "--conflict-exit-code"], { positionals: 1 })],
	["arch", wrapper([])],
]);

// Runner name -> second word -> spec. `uv pip list` is not a wrapper, `uv run x` is.
const RUNNERS = new Map<string, Map<string, WrapperSpec>>([
	["uv", new Map([[RUN_SUBCOMMAND, wrapper(UV_RUN_OPTIONS)]])],
	["poetry", new Map([[RUN_SUBCOMMAND, wrapper([])]])],
	["pipenv", new Map([[RUN_SUBCOMMAND, wrapper([])]])],
	["pnpm", new Map([[EXEC_SUBCOMMAND, wrapper(["--filter", "-F", "--dir", "-C"])]])],
	["npm", new Map([[EXEC_SUBCOMMAND, wrapper(["--package", "-p", "--workspace", "-w"])]])],
	["bundle", new Map([[EXEC_SUBCOMMAND, wrapper([])]])],
	["mise", new Map([[EXEC_SUBCOMMAND, MISE_EXEC], ["x", MISE_EXEC]])],
	["direnv", new Map([[EXEC_SUBCOMMAND, wrapper([], { positionals: 1 })]])],
]);

type Skipped = { next: number; split?: Word };

// Width in words of one option: its own word plus a value word when it takes one separately.
function optionWidth(text: string, spec: WrapperSpec): number {
	if (text.startsWith(LONG_PREFIX)) return spec.values.has(text) ? 2 : 1;
	const letters = text.slice(OPTION_PREFIX.length);
	for (let j = 0; j < letters.length; j++) {
		if (spec.letters.has(letters[j])) return j === letters.length - 1 ? 2 : 1;
	}
	return 1;
}

// The command line given to `env -S`, when words[i] is that option.
function splitString(words: Word[], i: number): { word: Word; next: number } | undefined {
	const current = words[i];
	const text = current.text;
	if (text.startsWith(SPLIT_LONG_VALUE)) return { word: { ...current, text: text.slice(SPLIT_LONG_VALUE.length) }, next: i + 1 };
	if (text === SPLIT_LONG) return i + 1 < words.length ? { word: words[i + 1], next: i + 2 } : undefined;
	if (text.startsWith(LONG_PREFIX)) return undefined;
	const letters = text.slice(OPTION_PREFIX.length);
	for (let j = 0; j < letters.length; j++) {
		if (letters[j] === SPLIT_LETTER) {
			if (j < letters.length - 1) return { word: { ...current, text: letters.slice(j + 1) }, next: i + 1 };
			return i + 1 < words.length ? { word: words[i + 1], next: i + 2 } : undefined;
		}
		if (SPLIT_VALUE_LETTERS.has(letters[j])) break;
	}
	return undefined;
}

function skipWrapper(words: Word[], start: number, spec: WrapperSpec): Skipped {
	if (spec.dashDash) {
		const dash = words.findIndex((candidate, j) => j >= start && candidate.text === OPTION_END);
		if (dash !== -1) return { next: dash + 1 };
	}
	let i = start;
	while (i < words.length) {
		const text = words[i].text;
		if (text === OPTION_END) {
			i++;
			break;
		}
		if (!text.startsWith(OPTION_PREFIX) || text === OPTION_PREFIX) break;
		const split = spec.splits ? splitString(words, i) : undefined;
		if (split !== undefined) return { next: split.next, split: split.word };
		i += optionWidth(text, spec);
	}
	return { next: i + spec.positionals };
}

type Located = { index?: number; split?: Word; consumesStdin?: boolean };

function isLookup(words: Word[], start: number): boolean {
	for (let i = start; i < words.length; i++) {
		const text = words[i].text;
		if (text === OPTION_END || !text.startsWith(OPTION_PREFIX) || text === OPTION_PREFIX) return false;
		if ([...text.slice(OPTION_PREFIX.length)].some((letter) => LOOKUP_LETTERS.has(letter))) return true;
	}
	return false;
}

// With `env -S`, index is the env word itself and split is the command line it runs.
function locate(words: Word[]): Located {
	let i = 0;
	let consumesStdin = false;
	while (i < words.length) {
		const word = words[i];
		if (ASSIGNMENT.test(word.text)) {
			i++;
			continue;
		}
		const name = basename(word.text);
		const spec = WRAPPERS.get(name);
		if (spec !== undefined) {
			if (name === COMMAND_NAME && isLookup(words, i + 1)) return {};
			if (STDIN_CONSUMERS.has(name)) consumesStdin = true;
			const skipped = skipWrapper(words, i + 1, spec);
			if (skipped.split !== undefined) return { index: i, split: skipped.split, consumesStdin };
			i = skipped.next;
			continue;
		}
		const runner = RUNNERS.get(name)?.get(words[i + 1]?.text ?? "");
		if (runner !== undefined) {
			i = skipWrapper(words, i + 2, runner).next;
			continue;
		}
		if (!word.quoted) {
			if (word.text === FUNCTION_KEYWORD) {
				// `function NAME` defines, it does not run anything.
				i += 2;
				continue;
			}
			if (KEYWORDS.has(word.text)) {
				i++;
				continue;
			}
			if (NO_COMMAND.has(word.text)) return {};
		}
		return { index: i, consumesStdin };
	}
	return {};
}

export function commandIndex(words: Word[]): number | undefined {
	return locate(words).index;
}

const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "fish"]);
// Cluster letters that each consume the next word (`-euo pipefail`), and long options that do.
const SHELL_VALUE_LETTERS = new Set(["o", "O"]);
const SHELL_VALUE_LONG = new Set(["--rcfile", "--init-file"]);
const SHELL_OPTION_CLUSTER = /^[-+][A-Za-z]+$/;
const SHELL_COMMAND_FLAG = "c";
const SHELL_STDIN_FLAG = "s";
const PLUS_PREFIX = "+";
const INPUT_REDIRECT = "<";
const INPUT_SUBSTITUTION = "<(";
const SOURCE_NAMES = new Set(["source", "."]);
const FIND_EXEC_FLAGS = new Set(["-exec", "-execdir", "-ok", "-okdir"]);
const FD_EXEC_FLAGS = new Set(["-x", "--exec", "-X", "--exec-batch"]);
const FIND_NAME = "find";
const FD_NAMES = new Set(["fd", "fdfind"]);
const EXEC_TERMINATORS = new Set([SEMICOLON, "+"]);

type ShellArgs = { script?: Word; file?: Word };

// The first word after the options is the script for -c, else the script file; with -s the words are positional parameters.
function scanShellArgs(words: Word[], start: number): ShellArgs {
	let command = false;
	let stdin = false;
	let i = start;
	while (i < words.length) {
		const text = words[i].text;
		if (text === OPTION_END || text === OPTION_PREFIX) {
			i++;
			break;
		}
		if (!text.startsWith(OPTION_PREFIX) && !text.startsWith(PLUS_PREFIX)) break;
		if (text.startsWith(LONG_PREFIX)) {
			i += SHELL_VALUE_LONG.has(text) ? 2 : 1;
			continue;
		}
		if (SHELL_OPTION_CLUSTER.test(text)) {
			const setting = text.startsWith(OPTION_PREFIX);
			for (const letter of text.slice(1)) {
				if (setting && letter === SHELL_COMMAND_FLAG) command = true;
				else if (setting && letter === SHELL_STDIN_FLAG) stdin = true;
				else if (SHELL_VALUE_LETTERS.has(letter)) i++;
			}
		}
		i++;
	}
	const next = words[i];
	if (command) return { script: next };
	return { file: stdin ? undefined : next };
}

function isInputSubstitution(text: string, dynamic: boolean): boolean {
	return dynamic && text.startsWith(INPUT_SUBSTITUTION);
}

function substitutionScript(text: string): NestedScripts {
	return { commands: [], opaque: true, substitution: text };
}

function readsInputFile(cmd: SimpleCommand): boolean {
	return cmd.redirects.some((redirect) => redirect.op === INPUT_REDIRECT);
}

function execCommands(words: Word[], start: number, flags: Set<string>): SimpleCommand[] {
	const commands: SimpleCommand[] = [];
	let i = start;
	while (i < words.length) {
		if (!flags.has(words[i].text)) {
			i++;
			continue;
		}
		const collected: Word[] = [];
		i++;
		while (i < words.length && !EXEC_TERMINATORS.has(words[i].text)) collected.push(words[i++]);
		i++;
		if (collected.length > 0) commands.push({ words: collected, redirects: [], unterminated: false });
	}
	return commands;
}

function parsedScript(source: string, dynamic: boolean): NestedScripts {
	return dynamic ? { commands: [], opaque: true } : { commands: parseCommands(source), opaque: false };
}

export function nestedScripts(cmd: SimpleCommand): NestedScripts {
	const none: NestedScripts = { commands: [], opaque: false };
	const { index, split, consumesStdin } = locate(cmd.words);
	if (index === undefined) return none;
	if (split !== undefined) return parsedScript(split.text, split.dynamic);
	const name = basename(cmd.words[index].text);

	if (SHELLS.has(name)) {
		const { script, file } = scanShellArgs(cmd.words, index + 1);
		if (script !== undefined) return parsedScript(script.text, script.dynamic);
		if (file !== undefined) return isInputSubstitution(file.text, file.dynamic) ? substitutionScript(file.text) : none;
		const input = cmd.redirects.find((redirect) => redirect.op === INPUT_REDIRECT && isInputSubstitution(redirect.target, redirect.targetDynamic));
		if (input !== undefined) return substitutionScript(input.target);
		if (cmd.stdin === STDIN_HEREDOC && cmd.heredocBody !== undefined) return parsedScript(cmd.heredocBody, false);
		if (cmd.stdin === STDIN_HERESTRING) {
			const data = cmd.redirects.find((redirect) => redirect.op === OP_HERESTRING);
			if (data !== undefined) return parsedScript(data.target, data.targetDynamic);
		}
		// The script arrives through a pipe: there is nothing to inspect.
		if (cmd.stdin === STDIN_PIPE && !consumesStdin && !readsInputFile(cmd)) return { commands: [], opaque: true, piped: true };
		return none;
	}
	if (SOURCE_NAMES.has(name)) {
		const script = cmd.words.slice(index + 1).find((word) => isInputSubstitution(word.text, word.dynamic));
		return script === undefined ? none : substitutionScript(script.text);
	}
	if (name === FIND_NAME) return { commands: execCommands(cmd.words, index + 1, FIND_EXEC_FLAGS), opaque: false };
	if (FD_NAMES.has(name)) return { commands: execCommands(cmd.words, index + 1, FD_EXEC_FLAGS), opaque: false };
	return none;
}
