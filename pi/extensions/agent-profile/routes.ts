import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const VIRTUAL_MODEL_PROVIDER = "profile";
export const MODEL_ROUTES_FILE = "agent-profile.json";
export const SUBAGENT_TOOL = "subagent";

const MODEL_REF_SEPARATOR = "/";

export type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0];
export type ModelRoute = { model: string; thinking?: ThinkingLevel };
export type ModelRoutes = Record<string, ModelRoute>;

// Record keys make the compiler flag a level missing here when pi adds one.
const THINKING_LEVEL_SET: Record<ThinkingLevel, true> = {
	off: true,
	minimal: true,
	low: true,
	medium: true,
	high: true,
	xhigh: true,
	max: true,
};
export const THINKING_LEVELS = Object.keys(THINKING_LEVEL_SET) as ThinkingLevel[];

function isThinkingLevel(value: unknown): value is ThinkingLevel {
	return typeof value === "string" && Object.hasOwn(THINKING_LEVEL_SET, value);
}

export function splitModelRef(ref: string): { provider: string; id: string } | undefined {
	const separator = ref.indexOf(MODEL_REF_SEPARATOR);
	if (separator <= 0 || separator === ref.length - 1) return undefined;
	return { provider: ref.slice(0, separator), id: ref.slice(separator + 1) };
}

export function parseModelRoutes(json: string): ModelRoutes {
	const data: unknown = JSON.parse(json);
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error("model routes must be a JSON object");
	}

	const routes: ModelRoutes = {};
	for (const [key, value] of Object.entries(data)) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			throw new Error(`route ${key} must be an object`);
		}
		const { model, thinking } = value as { model?: unknown; thinking?: unknown };
		if (typeof model !== "string" || !splitModelRef(model)) {
			throw new Error(`route ${key} needs a model in provider/id form`);
		}
		if (thinking !== undefined && !isThinkingLevel(thinking)) {
			throw new Error(`route ${key} has an unknown thinking level: ${String(thinking)}`);
		}
		routes[key] = thinking === undefined ? { model } : { model, thinking };
	}
	return routes;
}

export function resolveRoute<M>(
	key: string,
	route: ModelRoute,
	find: (provider: string, id: string) => M | undefined,
	requestThinking: ThinkingLevel,
): { model: M; thinkingLevel: ThinkingLevel } {
	const ref = splitModelRef(route.model);
	const model = ref ? find(ref.provider, ref.id) : undefined;
	if (!model) {
		throw new Error(
			`Profile model ${route.model} (route ${key}) is not available; run bin/setup-pi to refresh ${MODEL_ROUTES_FILE}`,
		);
	}
	return { model, thinkingLevel: route.thinking ?? requestThinking };
}

export function subagentModelViolation(model: unknown, routes: ModelRoutes): string | undefined {
	if (model === undefined) return undefined;

	const prefix = VIRTUAL_MODEL_PROVIDER + MODEL_REF_SEPARATOR;
	if (typeof model === "string" && model.startsWith(prefix) && Object.hasOwn(routes, model.slice(prefix.length))) {
		return undefined;
	}

	const allowed = Object.keys(routes).map((key) => prefix + key);
	return `subagent model ${JSON.stringify(model)} is not allowed; omit it or use one of: ${allowed.join(", ")}`;
}
