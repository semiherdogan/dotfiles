import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import reviewGate from "./index.ts";
import { ACTIVE_AGENT_ENTRY, ARCHITECT, IMPLEMENTER, OUTCOME_COMPLETED, SUBAGENT_TOOL } from "./gate.ts";

type Entry = { type: string; customType?: string; data?: { enabled?: boolean; name?: string } };

function harness(entries: Entry[] = [], settings: Record<string, unknown> = {}) {
	const handlers = new Map<string, Function>();
	const commands = new Map<string, { handler: Function }>();
	const statuses: Array<string | undefined> = [];
	const notices: string[] = [];
	const pi = {
		getSettings: () => settings,
		on: (name: string, handler: Function) => handlers.set(name, handler),
		registerCommand: (name: string, command: { handler: Function }) => commands.set(name, command),
		appendEntry: (customType: string, data: { enabled: boolean }) => entries.push({ type: "custom", customType, data }),
		exec: async (_command: string, args: string[]) => ({ code: 0, stdout: args.includes("--show-toplevel") ? "/repo" : " M changed.ts\0" }),
	};
	const ctx = {
		cwd: "/repo",
		hasUI: true,
		sessionManager: { getEntries: () => entries },
		ui: {
			theme: { fg: (color: string, text: string) => `<${color}>${text}</${color}>` },
			setStatus: (_key: string, value: string | undefined) => statuses.push(value),
			notify: (value: string) => notices.push(value),
		},
	};
	const depth = process.env.PI_OPEN_AGENTS_DEPTH;
	delete process.env.PI_OPEN_AGENTS_DEPTH;
	try {
		reviewGate(pi as unknown as ExtensionAPI);
	} finally {
		if (depth !== undefined) process.env.PI_OPEN_AGENTS_DEPTH = depth;
	}
	return { handlers, commands, ctx, statuses, notices, entries };
}

const ON_STATUS = "<success>●</success> <accent>Review ON</accent>";

async function start(h: ReturnType<typeof harness>) {
	await h.handlers.get("session_start")!({}, h.ctx);
}

async function command(h: ReturnType<typeof harness>, args: string) {
	await h.commands.get("review-gate")!.handler(args, h.ctx);
}

async function finish(h: ReturnType<typeof harness>) {
	await h.handlers.get("before_agent_start")!({ messageType: "user" }, h.ctx);
	await h.handlers.get("tool_result")!({ toolName: SUBAGENT_TOOL, toolCallId: "1", input: { agent: IMPLEMENTER } }, h.ctx);
	return h.handlers.get("turn_end")!({ toolResults: [], outcome: OUTCOME_COMPLETED, entries: [] }, h.ctx);
}

test("defaults on, toggles, accepts explicit settings and rejects invalid arguments", async () => {
	const h = harness();
	await start(h);
	assert.equal(h.statuses.at(-1), ON_STATUS);
	await command(h, "");
	assert.equal(h.statuses.at(-1), undefined);
	await command(h, "on");
	assert.equal(h.statuses.at(-1), ON_STATUS);
	await command(h, "off");
	await command(h, "invalid");
	assert.equal(h.statuses.at(-1), undefined);
	assert.equal(h.notices.length, 1);
	await command(h, "");
	assert.equal(h.statuses.at(-1), ON_STATUS);
});

test("uses effective settings for fresh sessions and leaves settings unchanged", async () => {
	const settings = { "review-gate": "OFF" };
	const h = harness([], settings);
	await start(h);
	assert.equal(h.statuses.at(-1), undefined);
	await command(h, "on");
	assert.equal(h.statuses.at(-1), ON_STATUS);
	assert.deepEqual(settings, { "review-gate": "OFF" });
	const fresh = harness([], settings);
	await start(fresh);
	assert.equal(fresh.statuses.at(-1), undefined);
	const projectOverride = harness([], { ...settings, "review-gate": "ON" });
	await start(projectOverride);
	assert.equal(projectOverride.statuses.at(-1), ON_STATUS);
});

test("session choices override changed defaults on resume", async () => {
	const first = harness([], { "review-gate": "OFF" });
	await start(first);
	await command(first, "on");
	const resumed = harness(first.entries, { "review-gate": "OFF" });
	await start(resumed);
	assert.equal(resumed.statuses.at(-1), ON_STATUS);
	await command(resumed, "off");
	const reloaded = harness(first.entries, { "review-gate": "ON" });
	await start(reloaded);
	assert.equal(reloaded.statuses.at(-1), undefined);
});

test("restores each session's latest setting on resume and reload", async () => {
	const first = harness();
	await start(first);
	await command(first, "off");
	const second = harness();
	await start(second);
	assert.equal(second.statuses.at(-1), ON_STATUS);
	const resumed = harness(first.entries);
	await start(resumed);
	assert.equal(resumed.statuses.at(-1), undefined);
	await command(resumed, "on");
	const reloaded = harness(first.entries);
	await start(reloaded);
	assert.equal(reloaded.statuses.at(-1), ON_STATUS);
	await start(second);
	assert.equal(second.statuses.at(-1), ON_STATUS);
});

test("off suppresses the finish gate and on restores its request and continuation", async () => {
	const h = harness([{ type: "custom", customType: ACTIVE_AGENT_ENTRY, data: { name: ARCHITECT } }]);
	await start(h);
	await command(h, "off");
	assert.equal(await finish(h), undefined);
	await command(h, "on");
	const result = await finish(h);
	assert.equal(result.continue, true);
	assert.equal(result.entries.length, 1);
	assert.equal(result.entries[0].customType, "review-gate-request");
});
