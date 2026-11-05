import { type ChildProcessWithoutNullStreams, execFile, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { createLineDecoder, encodeMessage, METHOD, type RpcId, type RpcMessage } from "./protocol.ts";

// pi's tools replace Codex's built-ins; apply_patch cannot be disabled, so threads also run
// read-only with approvals off (see thread/start in bridge.ts).
const DISABLED_FEATURES = [
	"shell_tool",
	"sleep_tool",
	"unified_exec",
	"view_image",
	"image_generation",
	"multi_agent",
	"apps",
	"browser_use",
	"computer_use",
	"goals",
	"tool_suggest",
	"plugins",
];
// pi's system prompt is authoritative: drop Codex's injected context. The permissions block
// would tell the model it is read-only and make it refuse pi's edit/write tools.
const CONFIG_OVERRIDES = [
	'web_search="disabled"',
	"project_doc_max_bytes=0",
	"include_permissions_instructions=false",
	"include_environment_context=false",
	"include_apps_instructions=false",
	"include_collaboration_mode_instructions=false",
];

const CLIENT_INFO = { name: "pi-codex-bridge", title: "pi codex bridge", version: "0.1.0" };
const STDERR_TAIL_CHARS = 4_000;
const MULTI_AGENT_DISABLED = "disabled";
const CATALOG_MAX_BUFFER = 64 * 1024 * 1024;
const execFileAsync = promisify(execFile);

// Codex's catalog pins multi_agent_version=v2 per model, which adds the collaboration.* sub-agent
// tools regardless of feature flags; a model_catalog_json override is the only setting that turns
// it off. The catalog is re-read on every start so new models still appear.
async function writeModelCatalog(codexPath: string, timeoutMs: number): Promise<string> {
	const { stdout } = await execFileAsync(codexPath, ["debug", "models"], { timeout: timeoutMs, maxBuffer: CATALOG_MAX_BUFFER });
	const catalog = JSON.parse(stdout) as { models?: Record<string, unknown>[] };
	if (!Array.isArray(catalog.models) || catalog.models.length === 0) throw new Error("codex debug models returned no models");
	for (const model of catalog.models) model.multi_agent_version = MULTI_AGENT_DISABLED;
	const dir = mkdtempSync(path.join(tmpdir(), "pi-codex-bridge-"));
	const file = path.join(dir, "models.json");
	try {
		writeFileSync(file, JSON.stringify(catalog));
	} catch (error) {
		rmSync(dir, { recursive: true, force: true });
		throw error;
	}
	return file;
}

export class RpcRequestError extends Error {
	readonly code: number | undefined;
	constructor(message: string, code: number | undefined) {
		super(message);
		this.code = code;
	}
}

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer?: NodeJS.Timeout };

export type ClientHandlers = {
	onNotification: (message: RpcMessage) => void;
	onServerRequest: (client: CodexClient, message: RpcMessage) => void;
	onExit: (client: CodexClient, reason: string) => void;
};

export class CodexClient {
	readonly generation: number;
	closed = false;
	private readonly codexPath: string;
	private child?: ChildProcessWithoutNullStreams;
	private catalogPath?: string;
	private readonly pending = new Map<RpcId, Pending>();
	private nextId = 1;
	private stderrTail = "";
	private killed = false;
	private readonly handlers: ClientHandlers;

	constructor(codexPath: string, generation: number, handlers: ClientHandlers) {
		this.codexPath = codexPath;
		this.generation = generation;
		this.handlers = handlers;
	}

	async start(timeoutMs: number): Promise<void> {
		let catalogPath: string;
		try {
			catalogPath = await writeModelCatalog(this.codexPath, timeoutMs);
		} catch (error) {
			throw new Error(`cannot build the Codex model catalog override: ${error instanceof Error ? error.message : String(error)}`);
		}
		this.catalogPath = catalogPath;
		// Killed while the catalog was being built.
		if (this.closed) {
			this.removeCatalog();
			throw new Error("codex app-server is not running");
		}
		const args = ["app-server"];
		for (const feature of DISABLED_FEATURES) args.push("--disable", feature);
		for (const override of CONFIG_OVERRIDES) args.push("-c", override);
		args.push("-c", `model_catalog_json=${JSON.stringify(catalogPath)}`);
		const child = spawn(this.codexPath, args, { stdio: ["pipe", "pipe", "pipe"] });
		this.child = child;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		const decode = createLineDecoder(
			(message) => this.dispatch(message),
			(line) => console.error(`[codex-bridge] ignored non-JSON line (${line.length} chars)`),
		);
		child.stdout.on("data", decode);
		child.stderr.on("data", (chunk: string) => {
			this.stderrTail = (this.stderrTail + chunk).slice(-STDERR_TAIL_CHARS);
		});
		child.on("error", (error) => this.close(`spawn failed: ${error.message}`));
		child.on("exit", (code, signal) => this.close(`codex app-server exited (code=${code} signal=${signal})`));
		child.stdin.on("error", () => {});
		await this.request(METHOD.initialize, { clientInfo: CLIENT_INFO, capabilities: { experimentalApi: true } }, timeoutMs);
		this.send({ method: METHOD.initialized });
	}

	request<T>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
		if (this.closed) return Promise.reject(new Error("codex app-server is not running"));
		const id = this.nextId++;
		return new Promise<T>((resolve, reject) => {
			const entry: Pending = { resolve: resolve as (value: unknown) => void, reject };
			if (timeoutMs) {
				entry.timer = setTimeout(() => {
					this.pending.delete(id);
					reject(new Error(`codex app-server: ${method} timed out after ${timeoutMs} ms`));
				}, timeoutMs);
			}
			this.pending.set(id, entry);
			this.send({ id, method, params });
		});
	}

	respond(id: RpcId, result: unknown): void {
		this.send({ id, result });
	}

	respondError(id: RpcId, code: number, message: string): void {
		this.send({ id, error: { code, message } });
	}

	kill(): void {
		if (this.closed) return;
		this.killed = true;
		this.child?.kill();
		this.close("killed");
	}

	private send(message: RpcMessage): void {
		if (this.closed || !this.child) return;
		this.child.stdin.write(encodeMessage(message));
	}

	private removeCatalog(): void {
		if (!this.catalogPath) return;
		rmSync(path.dirname(this.catalogPath), { recursive: true, force: true });
		this.catalogPath = undefined;
	}

	private dispatch(message: RpcMessage): void {
		if (message.method === undefined) {
			if (message.id === undefined) return;
			const entry = this.pending.get(message.id);
			if (!entry) return;
			this.pending.delete(message.id);
			if (entry.timer) clearTimeout(entry.timer);
			if (message.error) entry.reject(new RpcRequestError(message.error.message ?? "unknown error", message.error.code));
			else entry.resolve(message.result);
			return;
		}
		if (message.id !== undefined) this.handlers.onServerRequest(this, message);
		else this.handlers.onNotification(message);
	}

	private close(reason: string): void {
		if (this.closed) return;
		this.closed = true;
		this.removeCatalog();
		if (!this.killed && this.stderrTail) console.error(`[codex-bridge] ${reason}; stderr tail:\n${this.stderrTail}`);
		for (const entry of this.pending.values()) {
			if (entry.timer) clearTimeout(entry.timer);
			entry.reject(new Error(reason));
		}
		this.pending.clear();
		this.handlers.onExit(this, reason);
	}
}
