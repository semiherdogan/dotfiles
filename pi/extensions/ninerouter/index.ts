import * as fs from "node:fs";
import * as path from "node:path";
import { type ExtensionAPI, getAgentDir } from "@earendil-works/pi-coding-agent";
import { type CatalogModel, mapCatalog, parseSnapshot } from "./catalog.ts";

const PROVIDER_ID = "9router";
const PROVIDER_NAME = "9router";
const PROVIDER_API = "openai-completions";
const NOTIFY_WARNING = "warning";

const ENV_BASE_URL = "NINE_ROUTER_BASE_URL";
const ENV_API_KEY = "NINE_ROUTER_API_KEY";
const ENV_CF_CLIENT_ID = "CF_ACCESS_CLIENT_ID";
const ENV_CF_CLIENT_SECRET = "CF_ACCESS_CLIENT_SECRET";
const REQUIRED_ENV = [ENV_BASE_URL, ENV_API_KEY, ENV_CF_CLIENT_ID, ENV_CF_CLIENT_SECRET] as const;

const HEADER_CF_CLIENT_ID = "CF-Access-Client-Id";
const HEADER_CF_CLIENT_SECRET = "CF-Access-Client-Secret";
const HEADER_AUTHORIZATION = "Authorization";
const HEADER_ACCEPT = "Accept";
const MIME_JSON = "application/json";

const MODELS_PATH = "/models";
const FETCH_TIMEOUT_MS = 5000;
const SNAPSHOT_FILE = "ninerouter-models.json";
const REDIRECT_ERROR = "error";

interface Config {
	baseUrl: string;
	apiKey: string;
	cfClientId: string;
	cfClientSecret: string;
}

function envRef(name: string): string {
	return `$${name}`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function readConfig(): { config?: Config; problem?: string } {
	const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
	if (missing.length > 0) {
		return { problem: `9router disabled: set ${missing.join(", ")} in the environment.` };
	}
	return {
		config: {
			baseUrl: (process.env[ENV_BASE_URL] as string).replace(/\/+$/, ""),
			apiKey: process.env[ENV_API_KEY] as string,
			cfClientId: process.env[ENV_CF_CLIENT_ID] as string,
			cfClientSecret: process.env[ENV_CF_CLIENT_SECRET] as string,
		},
	};
}

function snapshotPath(): string {
	return path.join(getAgentDir(), SNAPSHOT_FILE);
}

function readSnapshot(): CatalogModel[] | undefined {
	try {
		return parseSnapshot(JSON.parse(fs.readFileSync(snapshotPath(), "utf8")));
	} catch {
		return undefined;
	}
}

// Best effort: a failed write only costs the offline fallback.
function writeSnapshot(models: CatalogModel[]): void {
	const target = snapshotPath();
	const temp = `${target}.${process.pid}.tmp`;
	try {
		fs.writeFileSync(temp, JSON.stringify(models), { mode: 0o600 });
		fs.renameSync(temp, target);
	} catch {
		fs.rmSync(temp, { force: true });
	}
}

// Errors carry the HTTP status or failure kind only, never headers or the response body.
async function fetchModels(config: Config, signal?: AbortSignal): Promise<CatalogModel[]> {
	const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
	let response: Response;
	try {
		response = await requestModels(config, signal ? AbortSignal.any([signal, timeout]) : timeout);
	} catch (error) {
		throw new Error(`GET ${MODELS_PATH} failed: ${error instanceof Error ? error.name : typeof error}`);
	}
	if (!response.ok) throw new Error(`GET ${MODELS_PATH} failed: HTTP ${response.status}`);
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new Error(`GET ${MODELS_PATH} failed: response is not JSON`);
	}
	const models = mapCatalog(body);
	// An empty list would wipe the known models and the snapshot, so it counts as a failed fetch.
	if (models.length === 0) throw new Error(`GET ${MODELS_PATH} returned no usable models`);
	return models;
}

// Redirects are refused so a Cloudflare Access 302 never forwards the secret to another host.
function requestModels(config: Config, signal: AbortSignal): Promise<Response> {
	return fetch(`${config.baseUrl}${MODELS_PATH}`, {
		headers: {
			[HEADER_AUTHORIZATION]: `Bearer ${config.apiKey}`,
			[HEADER_CF_CLIENT_ID]: config.cfClientId,
			[HEADER_CF_CLIENT_SECRET]: config.cfClientSecret,
			[HEADER_ACCEPT]: MIME_JSON,
		},
		redirect: REDIRECT_ERROR,
		signal,
	});
}

export default async function ninerouter(pi: ExtensionAPI) {
	let notice: string | undefined;
	let noticeShown = false;

	pi.on("session_start", (_event, ctx) => {
		if (!notice || noticeShown || !ctx.hasUI) return;
		noticeShown = true;
		ctx.ui.notify(notice, NOTIFY_WARNING);
	});

	const { config, problem } = readConfig();
	if (!config) {
		notice = problem;
		return;
	}

	// Registration needs a model list at load time for --list-models and startup model selection,
	// so the snapshot is used when present and the live fetch is bounded otherwise.
	let current = readSnapshot();
	if (!current) {
		try {
			current = await fetchModels(config);
			writeSnapshot(current);
		} catch (error) {
			notice = `9router disabled: no saved model list and discovery failed: ${errorMessage(error)}`;
			return;
		}
	}
	let known: CatalogModel[] = current;

	pi.registerProvider(PROVIDER_ID, {
		name: PROVIDER_NAME,
		baseUrl: config.baseUrl,
		apiKey: envRef(ENV_API_KEY),
		api: PROVIDER_API,
		headers: {
			[HEADER_CF_CLIENT_ID]: envRef(ENV_CF_CLIENT_ID),
			[HEADER_CF_CLIENT_SECRET]: envRef(ENV_CF_CLIENT_SECRET),
		},
		models: known,
		refreshModels: async (context) => {
			if (!context.allowNetwork) return known;
			try {
				const fetched = await fetchModels(config, context.signal);
				known = fetched;
				writeSnapshot(fetched);
			} catch {
				// Keep the last known list when 9router or Cloudflare Access is unreachable.
			}
			return known;
		},
	});
}
