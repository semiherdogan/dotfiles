import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildThinkingLevelMap,
	createLineDecoder,
	effortFor,
	encodeMessage,
	type RpcMessage,
	toToolOutputItems,
	toUserInput,
} from "./protocol.ts";

test("line decoder joins split chunks and skips blank lines", () => {
	const messages: RpcMessage[] = [];
	const invalid: string[] = [];
	const push = createLineDecoder((message) => messages.push(message), (line) => invalid.push(line));
	push('{"id":1,"res');
	push('ult":{"ok":true}}\n\n{"method":"turn/started","params":{}}');
	assert.equal(messages.length, 1);
	push("\nnot json\n");
	assert.deepEqual(messages, [{ id: 1, result: { ok: true } }, { method: "turn/started", params: {} }]);
	assert.deepEqual(invalid, ["not json"]);
});

test("encodeMessage writes one line without a jsonrpc field", () => {
	assert.equal(encodeMessage({ id: 3, method: "initialize" }), '{"id":3,"method":"initialize"}\n');
});

test("tool result content maps text and images to contentItems", () => {
	assert.deepEqual(
		toToolOutputItems([
			{ type: "text", text: "hello" },
			{ type: "image", data: "AAAA", mimeType: "image/png" },
		]),
		[
			{ type: "inputText", text: "hello" },
			{ type: "inputImage", imageUrl: "data:image/png;base64,AAAA" },
		],
	);
});

test("empty tool result still sends one content item", () => {
	assert.deepEqual(toToolOutputItems([]), [{ type: "inputText", text: "" }]);
});

test("user input drops images when the model has no image input", () => {
	const content = [
		{ type: "text" as const, text: "look" },
		{ type: "image" as const, data: "BBBB", mimeType: "image/jpeg" },
	];
	assert.deepEqual(toUserInput(content, false), [{ type: "text", text: "look", text_elements: [] }]);
	assert.deepEqual(toUserInput(content, true)[1], { type: "image", url: "data:image/jpeg;base64,BBBB" });
	assert.deepEqual(toUserInput("hi", true), [{ type: "text", text: "hi", text_elements: [] }]);
});

test("thinking level map marks unsupported levels null", () => {
	const map = buildThinkingLevelMap(["low", "medium", "high", "xhigh", "max", "ultra"]);
	assert.deepEqual(map, { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" });
	assert.equal(buildThinkingLevelMap(["low", "medium", "high"]).max, null);
});

test("effortFor resolves only mapped levels", () => {
	const map = buildThinkingLevelMap(["low", "high"]);
	assert.equal(effortFor(map, "high"), "high");
	assert.equal(effortFor(map, "medium"), undefined);
	assert.equal(effortFor(map, undefined), undefined);
	assert.equal(effortFor(undefined, "high"), undefined);
});
