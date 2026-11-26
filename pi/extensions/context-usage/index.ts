import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CONTEXT_WARNING_THRESHOLD = 70;
const STATUS_KEY = "context-usage";

function updateContextStatus(ctx: ExtensionContext): void {
	const percent = ctx.getContextUsage()?.percent;
	if (percent === null || percent === undefined) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return;
	}

	const text = `ctx ${Math.round(percent)}%`;
	ctx.ui.setStatus(STATUS_KEY, percent >= CONTEXT_WARNING_THRESHOLD ? ctx.ui.theme.fg("warning", text) : text);
}

export default function contextUsage(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => updateContextStatus(ctx));
	pi.on("turn_end", (_event, ctx) => updateContextStatus(ctx));

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}
