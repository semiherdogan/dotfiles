import assert from "node:assert/strict";
import { test } from "node:test";
import { commandIndex, nestedScripts, parseCommands, type Redirect, type SimpleCommand } from "./shell.ts";

const texts = (cmd: SimpleCommand) => cmd.words.map((word) => word.text);
const allTexts = (commands: SimpleCommand[]) => commands.map(texts);

test("'\"'\"' idiom keeps one word and the next command intact", () => {
	const commands = parseCommands(`gh x -f n='a PiG'"'"'s b install c' && gh y`);
	assert.equal(commands.length, 2);
	assert.deepEqual(texts(commands[0]), ["gh", "x", "-f", "n=a PiG's b install c"]);
	assert.deepEqual(texts(commands[1]), ["gh", "y"]);
	const install = commands[0].words.filter((word) => word.text.includes("install"));
	assert.equal(install.length, 1);
	assert.equal(install[0].quoted, true);
});

test("command substitution inside double quotes is its own command", () => {
	const commands = parseCommands(`echo "a $(git log) b" ; git push`);
	assert.equal(commands.length, 3);
	assert.deepEqual(allTexts(commands).sort(), [["echo", "a $(git log) b"], ["git", "log"], ["git", "push"]]);
	const echo = commands.find((cmd) => cmd.words[0].text === "echo");
	assert.equal(echo?.words[1].dynamic, true);
});

test("a quoted paren inside $() does not close it", () => {
	const commands = parseCommands(`echo "a $(echo ')') b" ; rm x`);
	assert.ok(allTexts(commands).some((words) => words.join(" ") === "rm x"));
	assert.equal(commands.length, 3);
});

test("backticks inside double quotes", () => {
	const commands = parseCommands("echo \"a `git log` b\"; rm x");
	assert.deepEqual(allTexts(commands).sort(), [["echo", "a `git log` b"], ["git", "log"], ["rm", "x"]]);
	assert.equal(commands.find((cmd) => cmd.words[0].text === "echo")?.words[1].dynamic, true);
});

test("$'...' with an escaped quote is one word", () => {
	const commands = parseCommands("echo $'it\\'s'");
	assert.equal(commands.length, 1);
	assert.deepEqual(texts(commands[0]), ["echo", "it's"]);
	assert.equal(commands[0].words[1].quoted, true);
});

test("comment with an apostrophe does not open a quote", () => {
	const commands = parseCommands("ls # don't\nrm x");
	assert.deepEqual(allTexts(commands), [["ls"], ["rm", "x"]]);
	assert.equal(commands.every((cmd) => !cmd.unterminated), true);
});

test("heredoc body is stored and not parsed", () => {
	const commands = parseCommands("python3 - <<'EOF'\nsubprocess.run(['git','show'])\nEOF");
	assert.equal(commands.length, 1);
	assert.equal(commands[0].stdin, "heredoc");
	assert.equal(commands[0].heredocBody, "subprocess.run(['git','show'])\n");
	assert.deepEqual(texts(commands[0]), ["python3", "-"]);
	assert.equal(commands[0].unterminated, false);
});

test("<<- strips leading tabs from body and delimiter line", () => {
	const commands = parseCommands("cat <<-EOF\n\tfoo\n\t\tbar\n\tEOF\nrm x");
	assert.equal(commands.length, 2);
	assert.equal(commands[0].heredocBody, "foo\nbar\n");
	assert.deepEqual(texts(commands[1]), ["rm", "x"]);
});

test("heredoc without a terminator is flagged", () => {
	const commands = parseCommands("cat <<EOF\nfoo");
	assert.equal(commands[0].unterminated, true);
});

test("here-string", () => {
	const commands = parseCommands(`jq . <<<"$S"`);
	assert.equal(commands.length, 1);
	assert.equal(commands[0].stdin, "herestring");
	assert.deepEqual(texts(commands[0]), ["jq", "."]);
	assert.deepEqual(commands[0].redirects, [{ op: "<<<", target: "$S", targetDynamic: true }]);
});

test("line continuation", () => {
	assert.deepEqual(allTexts(parseCommands("git \\\n  push")), [["git", "push"]]);
	assert.deepEqual(allTexts(parseCommands("ab\\\ncd x")), [["abcd", "x"]]);
});

test("${HOME}/bin is one dynamic word", () => {
	const commands = parseCommands("ls ${HOME}/bin");
	assert.equal(commands.length, 1);
	assert.deepEqual(commands[0].words[1], { text: "${HOME}/bin", quoted: false, dynamic: true });
});

test("$((...)) is opaque word text", () => {
	const commands = parseCommands("echo $((1 + (2 * 3))) x");
	assert.deepEqual(texts(commands[0]), ["echo", "$((1 + (2 * 3)))", "x"]);
	assert.equal(commands[0].words[1].dynamic, true);
});

test("process substitution is a dynamic word and its inner command is parsed", () => {
	const commands = parseCommands("tee >(wc -c >&2)");
	assert.equal(commands.length, 2);
	const tee = commands.find((cmd) => cmd.words[0].text === "tee");
	const wc = commands.find((cmd) => cmd.words[0].text === "wc");
	assert.equal(tee?.words[1].text.startsWith(">("), true);
	assert.equal(tee?.words[1].dynamic, true);
	assert.deepEqual(wc?.redirects, [{ op: ">&", target: "2", targetDynamic: false }]);
	assert.equal(tee?.redirects.length, 0);
});

const REDIRECT_CASES: [string, Redirect[]][] = [
	["echo a 2>&1", [{ op: ">&", fd: "2", target: "1", targetDynamic: false }]],
	["ls > /dev/null", [{ op: ">", target: "/dev/null", targetDynamic: false }]],
	["x &>> f", [{ op: "&>>", target: "f", targetDynamic: false }]],
	["x >| f", [{ op: ">|", target: "f", targetDynamic: false }]],
	["x 2>/tmp/x", [{ op: ">", fd: "2", target: "/tmp/x", targetDynamic: false }]],
	["x >& -", [{ op: ">&", target: "-", targetDynamic: false }]],
	["x < in >> out", [
		{ op: "<", target: "in", targetDynamic: false },
		{ op: ">>", target: "out", targetDynamic: false },
	]],
	["x > $OUT", [{ op: ">", target: "$OUT", targetDynamic: true }]],
];
for (const [source, expected] of REDIRECT_CASES) {
	test(`redirects: ${source}`, () => {
		const commands = parseCommands(source);
		assert.equal(commands.length, 1);
		assert.deepEqual(commands[0].redirects, expected);
		assert.equal(commands[0].words.some((word) => /[<>]/.test(word.text)), false);
	});
}

test("pipes set stdin on the next command only", () => {
	const commands = parseCommands("a | b |& c && d");
	assert.deepEqual(commands.map((cmd) => cmd.stdin), [undefined, "pipe", "pipe", undefined]);
});

test("{ and } separate only at command position", () => {
	assert.deepEqual(allTexts(parseCommands("{ rm x; }")), [["rm", "x"]]);
	assert.deepEqual(allTexts(parseCommands("echo { }")), [["echo", "{", "}"]]);
});

test("assignment-only command has no command word and inner commands are parsed", () => {
	const commands = parseCommands("f=$(rg -l y | head -1)");
	assert.equal(commands.length, 3);
	const outer = commands.find((cmd) => cmd.words[0].text.startsWith("f="));
	assert.ok(outer);
	assert.equal(commandIndex(outer.words), undefined);
	assert.ok(allTexts(commands).some((words) => words.join(" ") === "rg -l y"));
	assert.ok(allTexts(commands).some((words) => words.join(" ") === "head -1"));
});

const word = (text: string, quoted = false) => ({ text, quoted, dynamic: false });
const COMMAND_INDEX_CASES: [string, string, number | undefined][] = [
	["sudo -u root env A=1 timeout 5 xargs -n 1 rm", "rm", 10],
	["FOO=1 BAR=2 git push", "git", 2],
	["nice -n 5 /bin/rm x", "/bin/rm", 3],
	["xargs -I X -P 4 rm X", "rm", 5],
	["env -i A=1 rm x", "rm", 3],
	["command -p ls", "ls", 2],
	["if ! git push", "git", 2],
	["for x in a b", "for", undefined],
	["done", "done", undefined],
	["A=1", "A=1", undefined],
	["gtimeout 5 rm x", "rm", 2],
	["uv run --with x python -c 1", "python", 4],
	["uv pip list", "uv", 0],
	["poetry run rm x", "rm", 2],
	["pnpm exec tsc", "tsc", 2],
	["npm exec -- tsc", "tsc", 3],
	["bundle exec rm x", "rm", 2],
	["mise exec node@20 -- rm x", "rm", 4],
	["mise x rm x", "rm", 2],
	["direnv exec . rm x", "rm", 3],
	["parallel -j 4 rm ::: a", "rm", 3],
	["flock f rm x", "rm", 2],
	["arch -arm64 rm x", "rm", 2],
	["sudo -iu root rm x", "rm", 3],
	["env -P /bin -u A rm x", "rm", 5],
	["nice --adjustment 5 rm x", "rm", 3],
	["xargs -J % cp %", "cp", 3],
	["xargs --max-args 1 rm", "rm", 3],
	["xargs --replace rm", "rm", 2],
	["function f { rm x", "rm", 3],
	["function f", "function", undefined],
	["then { rm x", "rm", 2],
	["! { rm x", "rm", 2],
	["time { rm x", "rm", 2],
];
for (const [source, name, expected] of COMMAND_INDEX_CASES) {
	test(`commandIndex: ${source}`, () => {
		const words = source.split(" ").map((text) => word(text));
		const index = commandIndex(words);
		assert.equal(index, expected);
		if (expected !== undefined) assert.equal(words[index!].text, name);
	});
}

test("quoted keyword is a command word", () => {
	assert.equal(commandIndex([word("if", true), word("x")]), 0);
});

test("for loop: rm is found via do", () => {
	const commands = parseCommands("for x in a b; do rm $x; done");
	assert.equal(commandIndex(commands[0].words), undefined);
	const body = commands.find((cmd) => cmd.words[0].text === "do");
	assert.ok(body);
	assert.equal(body.words[commandIndex(body.words)!].text, "rm");
	assert.equal(commandIndex(commands[2].words), undefined);
});

const NESTED_CASES: [string, string[][], boolean][] = [
	["sh -c 'rm x'", [["rm", "x"]], false],
	["bash -lc 'git push'", [["git", "push"]], false],
	["sudo bash -ec 'a; b'", [["a"], ["b"]], false],
	[`sh -c "$CMD"`, [], true],
	["bash <<'EOF'\nrm x\nEOF", [["rm", "x"]], false],
	["bash script.sh <<'EOF'\nrm x\nEOF", [], false],
	["bash <<< 'rm x'", [["rm", "x"]], false],
	["bash <<< \"$X\"", [], true],
	["find . -exec rm {} \\;", [["rm", "{}"]], false],
	["find . -name a -execdir rm {} + -print", [["rm", "{}"]], false],
	["find . -exec rm {} ';' -exec ls {} \\;", [["rm", "{}"], ["ls", "{}"]], false],
	["fd -x rm", [["rm"]], false],
	["fd -e txt --exec rm {}", [["rm", "{}"]], false],
	["echo hi", [], false],
	["xargs rm", [], false],
	["bash -euo pipefail -c 'git commit -am x'", [["git", "commit", "-am", "x"]], false],
	["bash -eo pipefail -c 'rm f'", [["rm", "f"]], false],
	["bash -O shopt -c 'rm f'", [["rm", "f"]], false],
	["bash --rcfile f -c 'rm x'", [["rm", "x"]], false],
	["bash --init-file f -c 'rm x'", [["rm", "x"]], false],
	["bash -c -e 'rm f'", [["rm", "f"]], false],
	["bash -c -- 'rm f'", [["rm", "f"]], false],
	["bash -s arg <<'EOF'\nrm f\nEOF", [["rm", "f"]], false],
	["bash -s -- x <<'EOF'\nrm f\nEOF", [["rm", "f"]], false],
	["bash -e script.sh", [], false],
	["env -S 'rm x'", [["rm", "x"]], false],
	["env --split-string='rm x'", [["rm", "x"]], false],
	["env -S \"$X\"", [], true],
	["cat <<EOF\n$(rm x)\nEOF", [], false],
];
for (const [source, expected, opaque] of NESTED_CASES) {
	test(`nestedScripts: ${JSON.stringify(source)}`, () => {
		const commands = parseCommands(source);
		const nested = nestedScripts(commands[0]);
		assert.deepEqual(allTexts(nested.commands), expected);
		assert.equal(nested.opaque, opaque);
	});
}

test("a shell reading its script from a pipe is opaque and piped", () => {
	const [, sh] = parseCommands("echo rm | sh");
	assert.deepEqual(nestedScripts(sh), { commands: [], opaque: true, piped: true });
	const [, redirected] = parseCommands("echo rm | sh < in");
	assert.deepEqual(nestedScripts(redirected), { commands: [], opaque: false });
	const [, withFile] = parseCommands("echo rm | sh script.sh");
	assert.deepEqual(nestedScripts(withFile), { commands: [], opaque: false });
});

test("unquoted heredoc body expands substitutions, quoted stays data", () => {
	assert.ok(allTexts(parseCommands("cat <<EOF\n$(rm x)\nEOF")).some((words) => words.join(" ") === "rm x"));
	assert.ok(allTexts(parseCommands("cat <<EOF\n`rm x`\nEOF")).some((words) => words.join(" ") === "rm x"));
	for (const delimiter of ["'EOF'", '"EOF"', "\\EOF"]) {
		assert.deepEqual(allTexts(parseCommands(`cat <<${delimiter}\n$(rm x)\nEOF`)), [["cat"]]);
	}
});

test("${...} bodies are parsed for substitutions", () => {
	const commands = parseCommands('cd "${D:-$(git stash)}"');
	assert.ok(allTexts(commands).some((words) => words.join(" ") === "git stash"));
	const nested = parseCommands('echo "${X:-${Y:-`rm x`}}"');
	assert.ok(allTexts(nested).some((words) => words.join(" ") === "rm x"));
});

test("[[ ]] comparisons and (( )) are not redirects", () => {
	const cond = parseCommands("[[ a > b ]] && echo y");
	assert.deepEqual(allTexts(cond), [["[[", "a", ">", "b", "]]"], ["echo", "y"]]);
	assert.equal(cond.every((cmd) => cmd.redirects.length === 0), true);
	const arith = parseCommands("(( a > b )) && echo y");
	assert.equal(arith.length, 2);
	assert.equal(arith.every((cmd) => cmd.redirects.length === 0), true);
	const real = parseCommands("[[ -f a ]] && echo x > f");
	assert.equal(real[1].redirects.length, 1);
});

test("group closers followed by a redirect keep the redirect", () => {
	assert.equal(parseCommands("{ echo a; } > f").some((cmd) => cmd.redirects.length === 1), true);
	assert.equal(parseCommands("( echo a ) > f").some((cmd) => cmd.redirects.length === 1), true);
});

test("unterminated quote takes the rest of the input and sets the flag", () => {
	const double = parseCommands(`echo "abc; rm x`);
	assert.equal(double.length, 1);
	assert.deepEqual(texts(double[0]), ["echo", "abc; rm x"]);
	assert.equal(double[0].unterminated, true);

	const single = parseCommands("echo 'abc");
	assert.equal(single[0].unterminated, true);
	assert.equal(parseCommands("echo 'abc'")[0].unterminated, false);
});
