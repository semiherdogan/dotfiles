import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_STATE, formatRow, formatStatus, modelFromFrontmatter, parseModelRef, pickModel } from "./resolve.ts";

const plain = (_color: string, text: string) => text;

test("parseModelRef splits on the first slash only", () => {
	assert.deepEqual(parseModelRef("llm-gateway/claude-sonnet-5-5"), {
		provider: "llm-gateway",
		model: "claude-sonnet-5-5",
	});
	assert.deepEqual(parseModelRef("openrouter/anthropic/claude-opus-5.5"), {
		provider: "openrouter",
		model: "anthropic/claude-opus-5.5",
	});
	assert.equal(parseModelRef("claude-sonnet-5-5"), undefined);
	assert.equal(parseModelRef("/x"), undefined);
	assert.equal(parseModelRef("x/"), undefined);
	assert.equal(parseModelRef(42), undefined);
});

test("modelFromFrontmatter reads quoted and bare values from the header only", () => {
	assert.equal(modelFromFrontmatter('---\nname: a\nmodel: "p/m"\n---\nmodel: body/ignored\n'), "p/m");
	assert.equal(modelFromFrontmatter("---\nmodel: p/m\nthinking: low\n---\n"), "p/m");
	assert.equal(modelFromFrontmatter("---\nname: a\n---\nmodel: p/m\n"), undefined);
	assert.equal(modelFromFrontmatter("model: p/m\n"), undefined);
	assert.equal(modelFromFrontmatter("---\nmodel:\n---\n"), undefined);
});

test("pickModel prefers the call override, then the first agent file with a model", () => {
	const project = "---\nmodel: proj/m1\n---\n";
	const global = "---\nmodel: glob/m2\n---\n";
	assert.deepEqual(pickModel("over/m0", [project, global]), { provider: "over", model: "m0" });
	assert.deepEqual(pickModel(undefined, [project, global]), { provider: "proj", model: "m1" });
	assert.deepEqual(pickModel(undefined, [undefined, global]), { provider: "glob", model: "m2" });
	assert.deepEqual(pickModel(undefined, ["---\nname: x\n---\n", global]), { provider: "glob", model: "m2" });
	assert.equal(pickModel(undefined, [undefined, undefined]), undefined);
	// A bare id in the agent file resolves to nothing rather than a guessed provider.
	assert.equal(pickModel(undefined, ["---\nmodel: bare-id\n---\n"]), undefined);
});

test("formatRow always shows provider/model and keeps the provider when the child reports a bare id", () => {
	const resolved = { provider: "llm-gateway", model: "claude-sonnet-5-5" };
	assert.equal(
		formatRow({ name: "implementer", resolved, state: AGENT_STATE.running }, plain),
		"● implementer llm-gateway/claude-sonnet-5-5",
	);
	assert.equal(
		formatRow({ name: "implementer", resolved, reportedModel: "claude-sonnet-5-5-x", state: AGENT_STATE.done }, plain),
		"✓ implementer llm-gateway/claude-sonnet-5-5-x",
	);
	assert.equal(formatRow({ name: "explorer", state: AGENT_STATE.error, reportedModel: "m" }, plain), "✗ explorer ?/m");
	assert.equal(formatRow({ name: "explorer", state: AGENT_STATE.starting }, plain), "● explorer ?/model?");
});

test("formatStatus joins agents and hides when empty", () => {
	const resolved = { provider: "p", model: "m" };
	assert.equal(formatStatus([], plain), undefined);
	assert.equal(
		formatStatus(
			[
				{ name: "a", resolved, state: AGENT_STATE.running },
				{ name: "b", resolved, state: AGENT_STATE.done },
			],
			plain,
		),
		"● a p/m · ✓ b p/m",
	);
});
