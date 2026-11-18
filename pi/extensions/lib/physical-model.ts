import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

// pi marks virtual catalog entries with this api id but does not export the constant from its package entry.
const VIRTUAL_MODEL_API = "pi-virtual";

type ModelFinder = (provider: string, modelId: string) => Model<any> | undefined;

function isVirtualSelection(model: Model<any>): boolean {
	return model.api === VIRTUAL_MODEL_API;
}

// A failed routing attempt is still recorded as a response naming the virtual model, so skip those too.
export function resolvePhysicalModel(
	selected: Model<any> | undefined,
	branch: readonly SessionEntry[],
	find: ModelFinder,
): Model<any> | undefined {
	if (!selected) return undefined;
	if (!isVirtualSelection(selected)) return selected;

	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const model = find(entry.message.provider, entry.message.model);
		if (!model || isVirtualSelection(model)) continue;
		return model;
	}
	return undefined;
}

export function physicalModel(ctx: ExtensionContext, selected = ctx.model): Model<any> | undefined {
	return resolvePhysicalModel(selected, ctx.sessionManager.getBranch(), (provider, modelId) =>
		ctx.modelRegistry.find(provider, modelId),
	);
}
