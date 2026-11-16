import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProfileRoutes, parseProjectProfile, resolveProjectRoutes, type ProfileRoutes } from "./project.ts";
import type { ModelRoutes } from "./routes.ts";

const GLOBAL: ModelRoutes = {
	implementer: { model: "a/sonnet", thinking: "medium" },
	"implementer-escalation": { model: "a/opus", thinking: "medium" },
	explorer: { model: "a/sonnet", thinking: "low" },
	"explorer-escalation": { model: "a/opus", thinking: "low" },
};
const KNOWN = ["architect", "implementer", "explorer"];

const NAMED: ProfileRoutes = {
	routes: {
		implementer: { model: "b/haiku", thinking: "low" },
		"implementer-escalation": { model: "b/sonnet", thinking: "low" },
	},
	primary: { architect: { model: "b/opus", thinking: "high" } },
};

test("parses a full project profile", () => {
	const json = JSON.stringify({
		profile: "cheap",
		agents: { implementer: { model: "a/haiku", escalationModel: "a/sonnet", thinking: "low" } },
	});
	assert.deepEqual(parseProjectProfile(json), {
		profile: "cheap",
		agents: { implementer: { model: "a/haiku", escalationModel: "a/sonnet", thinking: "low" } },
	});
});

test("parses agents only without a profile key", () => {
	const parsed = parseProjectProfile('{"agents": {"explorer": {"thinking": "high"}}}');
	assert.deepEqual(parsed, { agents: { explorer: { thinking: "high" } } });
	assert.equal(Object.hasOwn(parsed, "profile"), false);
});

test("parses an empty project profile", () => {
	assert.deepEqual(parseProjectProfile("{}"), { agents: {} });
});

test("rejects invalid project profiles", () => {
	assert.throws(() => parseProjectProfile("[]"), /JSON object/);
	assert.throws(() => parseProjectProfile("null"), /JSON object/);
	assert.throws(() => parseProjectProfile('"x"'), /JSON object/);
	assert.throws(() => parseProjectProfile('{"extra": 1}'), /unknown field: extra/);
	assert.throws(() => parseProjectProfile('{"profile": "../x"}'), /profile name/);
	assert.throws(() => parseProjectProfile('{"profile": 3}'), /profile name/);
	assert.throws(() => parseProjectProfile('{"agents": []}'), /agents must be an object/);
	assert.throws(() => parseProjectProfile('{"agents": null}'), /agents must be an object/);
	assert.throws(() => parseProjectProfile('{"agents": {"a": "x/y"}}'), /must be an object/);
	assert.throws(() => parseProjectProfile('{"agents": {"a": {"foo": 1}}}'), /unknown field: foo/);
	assert.throws(() => parseProjectProfile('{"agents": {"a": {"model": "plain"}}}'), /physical models/);
	assert.throws(() => parseProjectProfile('{"agents": {"a": {"model": "profile/implementer"}}}'), /physical models/);
	assert.throws(() => parseProjectProfile('{"agents": {"a": {"escalationModel": "plain"}}}'), /physical models/);
	assert.throws(() => parseProjectProfile('{"agents": {"a": {"thinking": "turbo"}}}'), /thinking level/);
});

test("parses profile routes", () => {
	const json = JSON.stringify({
		routes: { implementer: { model: "a/sonnet", thinking: "low" } },
		primary: { architect: { model: "a/opus" } },
	});
	assert.deepEqual(parseProfileRoutes(json), {
		routes: { implementer: { model: "a/sonnet", thinking: "low" } },
		primary: { architect: { model: "a/opus" } },
	});
});

test("rejects invalid profile routes", () => {
	assert.throws(() => parseProfileRoutes("[]"), /JSON object/);
	assert.throws(() => parseProfileRoutes("null"), /JSON object/);
	assert.throws(() => parseProfileRoutes('{"primary": {}}'), /JSON object/);
	assert.throws(() => parseProfileRoutes('{"routes": {}}'), /JSON object/);
});

test("a named profile replaces routes and supplies primary", () => {
	const result = resolveProjectRoutes(GLOBAL, { agents: {} }, NAMED, KNOWN);
	assert.deepEqual(result.routes.implementer, { model: "b/haiku", thinking: "low" });
	assert.deepEqual(result.routes["implementer-escalation"], { model: "b/sonnet", thinking: "low" });
	assert.deepEqual(result.routes.explorer, GLOBAL.explorer);
	assert.deepEqual(result.primary, { architect: { model: "b/opus", thinking: "high" } });
});

test("a subagent override changes the route and the escalation thinking only", () => {
	const project = parseProjectProfile('{"agents": {"implementer": {"model": "a/haiku", "thinking": "high"}}}');
	const result = resolveProjectRoutes(GLOBAL, project, undefined, KNOWN);
	assert.deepEqual(result.routes.implementer, { model: "a/haiku", thinking: "high" });
	assert.deepEqual(result.routes["implementer-escalation"], { model: "a/opus", thinking: "high" });
	assert.deepEqual(result.routes.explorer, GLOBAL.explorer);
});

test("escalationModel changes only the escalation route model", () => {
	const project = parseProjectProfile('{"agents": {"explorer": {"escalationModel": "a/haiku"}}}');
	const result = resolveProjectRoutes(GLOBAL, project, undefined, KNOWN);
	assert.deepEqual(result.routes.explorer, GLOBAL.explorer);
	assert.deepEqual(result.routes["explorer-escalation"], { model: "a/haiku", thinking: "low" });
});

test("a primary agent override merges over the named profile field by field", () => {
	const project = parseProjectProfile('{"agents": {"architect": {"thinking": "low"}}}');
	const result = resolveProjectRoutes(GLOBAL, project, NAMED, KNOWN);
	assert.deepEqual(result.primary, { architect: { model: "b/opus", thinking: "low" } });
	assert.deepEqual(result.routes.implementer, NAMED.routes.implementer);
});

test("a primary agent override without a named profile lands in primary", () => {
	const project = parseProjectProfile('{"agents": {"architect": {"model": "a/opus"}}}');
	const result = resolveProjectRoutes(GLOBAL, project, undefined, KNOWN);
	assert.deepEqual(result.primary, { architect: { model: "a/opus" } });
	assert.deepEqual(result.routes, GLOBAL);
});

test("an agents-only project keeps global routes for unmentioned agents", () => {
	const project = parseProjectProfile('{"agents": {"implementer": {"thinking": "high"}}}');
	const result = resolveProjectRoutes(GLOBAL, project, undefined, KNOWN);
	assert.deepEqual(result.routes.explorer, GLOBAL.explorer);
	assert.deepEqual(result.routes["explorer-escalation"], GLOBAL["explorer-escalation"]);
});

test("rejects unknown agents", () => {
	const typo = parseProjectProfile('{"agents": {"implementor": {"thinking": "high"}}}');
	assert.throws(() => resolveProjectRoutes(GLOBAL, typo, undefined, KNOWN), /unknown agent/);

	const proto = parseProjectProfile('{"agents": {"__proto__": {"thinking": "high"}}}');
	assert.throws(() => resolveProjectRoutes(GLOBAL, proto, undefined, KNOWN), /unknown agent/);
});

test("rejects an escalationModel on a primary agent", () => {
	const project = parseProjectProfile('{"agents": {"architect": {"escalationModel": "a/opus"}}}');
	assert.throws(() => resolveProjectRoutes(GLOBAL, project, undefined, KNOWN), /no escalation route/);
});

test("does not mutate the global routes", () => {
	const before = structuredClone(GLOBAL);
	const project = parseProjectProfile(
		'{"agents": {"implementer": {"model": "a/haiku", "escalationModel": "a/sonnet", "thinking": "high"}}}',
	);
	resolveProjectRoutes(GLOBAL, project, NAMED, KNOWN);
	assert.deepEqual(GLOBAL, before);
});
