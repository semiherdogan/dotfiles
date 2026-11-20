import assert from "node:assert/strict";
import { test } from "node:test";
import { mapCatalog, mapModel, parseSnapshot } from "./catalog.ts";

function entry(overrides: Record<string, unknown> = {}, capabilities: Record<string, unknown> = {}) {
	return {
		id: "cc/claude-opus-5-5",
		owned_by: "cc",
		capabilities: { vision: true, tools: true, reasoning: true, contextWindow: 200000, maxOutput: 32000, ...capabilities },
		...overrides,
	};
}

test("vision adds image input, otherwise text only", () => {
	assert.deepEqual(mapModel(entry())?.input, ["text", "image"]);
	assert.deepEqual(mapModel(entry({}, { vision: false }))?.input, ["text"]);
});

test("maps id, limits and zero cost", () => {
	const model = mapModel(entry());
	assert.equal(model?.id, "cc/claude-opus-5-5");
	assert.equal(model?.name, "cc/claude-opus-5-5");
	assert.equal(model?.contextWindow, 200000);
	assert.equal(model?.maxTokens, 32000);
	assert.deepEqual(model?.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
});

test("falls back to context_length and max_completion_tokens", () => {
	const model = mapModel(
		entry({ context_length: 100, max_completion_tokens: 10 }, { contextWindow: undefined, maxOutput: undefined }),
	);
	assert.equal(model?.contextWindow, 100);
	assert.equal(model?.maxTokens, 10);
});

test("skips models without usable limits", () => {
	assert.equal(mapModel(entry({}, { contextWindow: undefined })), undefined);
	assert.equal(mapModel(entry({}, { maxOutput: 0 })), undefined);
});

test("reasoning-less model has no thinking level map", () => {
	const model = mapModel(entry({}, { reasoning: false }));
	assert.equal(model?.reasoning, false);
	assert.equal(model?.thinkingLevelMap, undefined);
});

test("reasoning model without thinking_levels has no map", () => {
	const model = mapModel(entry());
	assert.equal(model?.reasoning, true);
	assert.equal(model?.thinkingLevelMap, undefined);
});

test("none maps to off and unlisted levels are unsupported", () => {
	const model = mapModel(entry({ thinking_levels: ["none", "low", "high"] }));
	assert.deepEqual(model?.thinkingLevelMap, {
		off: "none",
		minimal: null,
		low: "low",
		medium: null,
		high: "high",
		xhigh: null,
		max: null,
	});
});

test("ultra has no pi equivalent and is dropped", () => {
	const model = mapModel(entry({ thinking_levels: ["high", "max", "ultra"] }));
	assert.deepEqual(model?.thinkingLevelMap, {
		off: null,
		minimal: null,
		low: null,
		medium: null,
		high: "high",
		xhigh: null,
		max: "max",
	});
	assert.ok(!Object.values(model?.thinkingLevelMap ?? {}).includes("ultra"));
});

test("only-ultra levels yield no thinking level map", () => {
	const model = mapModel(entry({ thinking_levels: ["ultra"] }));
	assert.equal(model?.reasoning, true);
	assert.equal(model?.thinkingLevelMap, undefined);
});

test("parseSnapshot accepts a list of mapped models", () => {
	const models = mapCatalog({ data: [entry({ thinking_levels: ["low"] }), entry({ id: "cc/b" }, { reasoning: false })] });
	assert.deepEqual(parseSnapshot(JSON.parse(JSON.stringify(models))), models);
});

test("parseSnapshot rejects a wrong-shape entry", () => {
	const valid = mapModel(entry());
	assert.equal(parseSnapshot([valid, { ...valid, contextWindow: 0 }]), undefined);
	assert.equal(parseSnapshot([valid, { ...valid, input: "text" }]), undefined);
	assert.equal(parseSnapshot([valid, { ...valid, reasoning: "yes" }]), undefined);
	assert.equal(parseSnapshot([valid, { ...valid, cost: null }]), undefined);
	assert.equal(parseSnapshot([valid, null]), undefined);
});

test("parseSnapshot rejects a cost without the four numeric fields", () => {
	const valid = mapModel(entry());
	assert.equal(parseSnapshot([{ ...valid, cost: {} }]), undefined);
	assert.equal(parseSnapshot([{ ...valid, cost: { ...valid?.cost, output: "0" } }]), undefined);
	assert.equal(parseSnapshot([{ ...valid, cost: { ...valid?.cost, cacheWrite: Number.NaN } }]), undefined);
});

test("parseSnapshot rejects unknown or mistyped thinking map entries", () => {
	const valid = mapModel(entry());
	const map = valid?.thinkingLevelMap;
	assert.equal(parseSnapshot([{ ...valid, thinkingLevelMap: { ...map, ultra: "ultra" } }]), undefined);
	assert.equal(parseSnapshot([{ ...valid, thinkingLevelMap: { ...map, high: 1 } }]), undefined);
});

test("parseSnapshot rejects non-arrays and empty lists", () => {
	assert.equal(parseSnapshot({ data: [] }), undefined);
	assert.equal(parseSnapshot(null), undefined);
	assert.equal(parseSnapshot([]), undefined);
});

test("ignores non-string and inherited level names", () => {
	const model = mapModel(entry({ thinking_levels: [1, null, "toString", "medium"] }));
	assert.equal(model?.thinkingLevelMap?.medium, "medium");
	assert.equal(model?.thinkingLevelMap?.low, null);
});

test("keeps [1m] ids unchanged", () => {
	assert.equal(mapModel(entry({ id: "cx/gpt-6-sol[1m]" }))?.id, "cx/gpt-6-sol[1m]");
});

test("skips models with tools:false", () => {
	assert.equal(mapModel(entry({}, { tools: false })), undefined);
	assert.ok(mapModel(entry({}, { tools: undefined })));
});

test("skips malformed entries", () => {
	assert.equal(mapModel(null), undefined);
	assert.equal(mapModel("cc/x"), undefined);
	assert.equal(mapModel([]), undefined);
	assert.equal(mapModel(entry({ id: undefined })), undefined);
	assert.equal(mapModel(entry({ id: "" })), undefined);
	assert.equal(mapModel(entry({ id: 5 })), undefined);
});

test("mapCatalog keeps valid entries only", () => {
	const models = mapCatalog({
		object: "list",
		data: [entry(), null, entry({ id: "cc/no-tools" }, { tools: false }), entry({ id: "cx/gpt-6-sol[1m]" })],
	});
	assert.deepEqual(
		models.map((model) => model.id),
		["cc/claude-opus-5-5", "cx/gpt-6-sol[1m]"],
	);
});

test("mapCatalog rejects non-list responses", () => {
	assert.throws(() => mapCatalog(null));
	assert.throws(() => mapCatalog([]));
	assert.throws(() => mapCatalog({ object: "list" }));
	assert.throws(() => mapCatalog({ data: {} }));
});
