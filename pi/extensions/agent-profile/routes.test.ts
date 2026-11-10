import assert from "node:assert/strict";
import { test } from "node:test";
import { parseModelRoutes, resolveRoute, splitModelRef, subagentModelViolation, type ModelRoutes } from "./routes.ts";

const ROUTES: ModelRoutes = {
	implementer: { model: "claude-bridge/sonnet", thinking: "medium" },
	"implementer-escalation": { model: "claude-bridge/opus" },
};

test("parses valid routes", () => {
	const json = JSON.stringify({
		implementer: { model: "claude-bridge/sonnet", thinking: "medium" },
		"implementer-escalation": { model: "codex-bridge/gpt-5/high" },
	});
	assert.deepEqual(parseModelRoutes(json), {
		implementer: { model: "claude-bridge/sonnet", thinking: "medium" },
		"implementer-escalation": { model: "codex-bridge/gpt-5/high" },
	});
});

test("rejects invalid shapes", () => {
	assert.throws(() => parseModelRoutes("[]"), /JSON object/);
	assert.throws(() => parseModelRoutes("null"), /JSON object/);
	assert.throws(() => parseModelRoutes('{"a": "x/y"}'), /must be an object/);
	assert.throws(() => parseModelRoutes('{"a": {}}'), /provider\/id/);
	assert.throws(() => parseModelRoutes('{"a": {"model": "plain"}}'), /provider\/id/);
	assert.throws(() => parseModelRoutes('{"a": {"model": "x/"}}'), /provider\/id/);
	assert.throws(() => parseModelRoutes('{"a": {"model": "x/y", "thinking": "turbo"}}'), /thinking level/);
});

test("splits at the first slash", () => {
	assert.deepEqual(splitModelRef("llm-gateway/a/b"), { provider: "llm-gateway", id: "a/b" });
	assert.equal(splitModelRef("plain"), undefined);
	assert.equal(splitModelRef("/id"), undefined);
});

test("resolveRoute prefers the profile thinking level", () => {
	const find = (provider: string, id: string) => `${provider}:${id}`;
	assert.deepEqual(resolveRoute("implementer", ROUTES.implementer, find, "high"), {
		model: "claude-bridge:sonnet",
		thinkingLevel: "medium",
	});
});

test("resolveRoute falls back to the request thinking level", () => {
	const find = (provider: string, id: string) => `${provider}:${id}`;
	assert.deepEqual(resolveRoute("implementer-escalation", ROUTES["implementer-escalation"], find, "high"), {
		model: "claude-bridge:opus",
		thinkingLevel: "high",
	});
});

test("resolveRoute throws when the model is not found", () => {
	assert.throws(() => resolveRoute("implementer", ROUTES.implementer, () => undefined, "low"), /not available/);
});

test("guard accepts an omitted model and known virtual ids", () => {
	assert.equal(subagentModelViolation(undefined, ROUTES), undefined);
	assert.equal(subagentModelViolation("profile/implementer", ROUTES), undefined);
	assert.equal(subagentModelViolation("profile/implementer-escalation", ROUTES), undefined);
});

test("guard rejects physical and unknown ids with the allowed list", () => {
	const physical = subagentModelViolation("claude-bridge/sonnet", ROUTES);
	assert.match(physical ?? "", /profile\/implementer, profile\/implementer-escalation/);
	assert.ok(subagentModelViolation("profile/x", ROUTES));
	assert.ok(subagentModelViolation("profile/toString", ROUTES));
	assert.ok(subagentModelViolation(42, ROUTES));
});
