import assert from "node:assert/strict";
import { test } from "node:test";
import type { Model } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { resolvePhysicalModel } from "./physical-model.ts";

const model = (api: string, provider: string, id: string) => ({ api, provider, id }) as Model<any>;

const response = (provider: string, id: string) =>
	({ type: "message", message: { role: "assistant", provider, model: id } }) as unknown as SessionEntry;

const latest = model("anthropic-messages", "anthropic", "claude-sonnet-5-5");
const virtual = model("pi-virtual", "profile", "implementer");

test("a physical selection passes through unchanged", () => {
	assert.equal(resolvePhysicalModel(latest, [], () => undefined), latest);
});

test("a virtual selection resolves to the model of the latest response", () => {
	const older = response("openai", "gpt-6-luna");
	const find = (provider: string, id: string) => (provider === "anthropic" && id === "claude-sonnet-5-5" ? latest : undefined);
	assert.equal(resolvePhysicalModel(virtual, [older, response("anthropic", "claude-sonnet-5-5")], find), latest);
});

test("a virtual selection without a response has no physical model", () => {
	assert.equal(resolvePhysicalModel(virtual, [], () => latest), undefined);
});

test("a response naming an unknown model has no physical model", () => {
	assert.equal(resolvePhysicalModel(virtual, [response("anthropic", "gone")], () => undefined), undefined);
});

test("a failed routing response is skipped for the previous physical model", () => {
	const find = (provider: string, id: string) => {
		if (provider === "profile" && id === virtual.id) return virtual;
		return provider === "anthropic" && id === latest.id ? latest : undefined;
	};
	const branch = [response("anthropic", latest.id), response("profile", virtual.id)];
	assert.equal(resolvePhysicalModel(virtual, branch, find), latest);
});

test("only failed routing responses leave no physical model", () => {
	const find = (provider: string, id: string) =>
		provider === "profile" && id === virtual.id ? virtual : undefined;
	assert.equal(resolvePhysicalModel(virtual, [response("profile", virtual.id)], find), undefined);
});
