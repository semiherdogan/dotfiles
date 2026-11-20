import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

export type CatalogModel = Extract<ProviderModelConfig, { reasoning: boolean }>;
type ThinkingLevelMap = NonNullable<CatalogModel["thinkingLevelMap"]>;
type PiLevel = keyof ThinkingLevelMap;

const INPUT_TEXT = "text";
const INPUT_IMAGE = "image";

// 9router level name -> pi level name. Names without an entry (e.g. "ultra") have no pi equivalent.
const PI_LEVEL_BY_ROUTER_LEVEL: Readonly<Record<string, PiLevel>> = {
	none: "off",
	minimal: "minimal",
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max",
};

const PI_LEVELS: readonly PiLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveNumber(...candidates: unknown[]): number | undefined {
	return candidates.find((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
}

// Pi levels the model does not list map to null (unsupported); listed ones carry the 9router name.
function mapThinkingLevels(levels: unknown): ThinkingLevelMap | undefined {
	if (!Array.isArray(levels)) return undefined;
	const supported = new Map<PiLevel, string>();
	for (const level of levels) {
		if (typeof level !== "string") continue;
		const piLevel = Object.hasOwn(PI_LEVEL_BY_ROUTER_LEVEL, level) ? PI_LEVEL_BY_ROUTER_LEVEL[level] : undefined;
		if (piLevel) supported.set(piLevel, level);
	}
	// An all-null map would mark every level unsupported, so no mappable level means no map.
	if (supported.size === 0) return undefined;
	const map: ThinkingLevelMap = {};
	for (const piLevel of PI_LEVELS) map[piLevel] = supported.get(piLevel) ?? null;
	return map;
}

export function mapModel(entry: unknown): CatalogModel | undefined {
	if (!isRecord(entry)) return undefined;
	const id = entry.id;
	if (typeof id !== "string" || !id) return undefined;

	const capabilities = isRecord(entry.capabilities) ? entry.capabilities : {};
	if (capabilities.tools === false) return undefined;

	const contextWindow = positiveNumber(capabilities.contextWindow, entry.context_length);
	const maxTokens = positiveNumber(capabilities.maxOutput, entry.max_completion_tokens);
	if (contextWindow === undefined || maxTokens === undefined) return undefined;

	const reasoning = capabilities.reasoning === true;
	const thinkingLevelMap = reasoning ? mapThinkingLevels(entry.thinking_levels) : undefined;

	return {
		id,
		name: id,
		input: capabilities.vision === true ? [INPUT_TEXT, INPUT_IMAGE] : [INPUT_TEXT],
		reasoning,
		contextWindow,
		maxTokens,
		cost: { ...ZERO_COST },
		...(thinkingLevelMap ? { thinkingLevelMap } : {}),
	};
}

function isThinkingLevelMap(value: unknown): boolean {
	return (
		isRecord(value) &&
		Object.entries(value).every(
			([key, level]) => PI_LEVELS.includes(key as PiLevel) && (level === null || typeof level === "string"),
		)
	);
}

function isCost(value: unknown): boolean {
	if (!isRecord(value)) return false;
	return Object.keys(ZERO_COST).every((field) => typeof value[field] === "number" && Number.isFinite(value[field]));
}

function isPositiveFinite(value: unknown): boolean {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isCatalogModel(value: unknown): value is CatalogModel {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		Array.isArray(value.input) &&
		value.input.every((kind) => kind === INPUT_TEXT || kind === INPUT_IMAGE) &&
		typeof value.reasoning === "boolean" &&
		isPositiveFinite(value.contextWindow) &&
		isPositiveFinite(value.maxTokens) &&
		isCost(value.cost) &&
		(value.thinkingLevelMap === undefined || isThinkingLevelMap(value.thinkingLevelMap))
	);
}

// A saved list is trusted only when every entry passes; anything else counts as no snapshot.
export function parseSnapshot(value: unknown): CatalogModel[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	return value.every(isCatalogModel) ? value : undefined;
}

export function mapCatalog(body: unknown): CatalogModel[] {
	if (!isRecord(body) || !Array.isArray(body.data)) {
		throw new Error("9router /models response is not a model list");
	}
	const models: CatalogModel[] = [];
	for (const entry of body.data) {
		const model = mapModel(entry);
		if (model) models.push(model);
	}
	return models;
}
