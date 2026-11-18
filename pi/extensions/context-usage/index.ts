import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CONTEXT_WARNING_THRESHOLD = 70;
const STATUS_KEY = "context-usage";

function updateContextStatus(ctx: ExtensionContext): number | null {
	const percent = ctx.getContextUsage()?.percent;
	if (percent === null || percent === undefined) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return null;
	}

	const rounded = Math.round(percent);
	const suffix = percent >= CONTEXT_WARNING_THRESHOLD ? " ⚠" : "";
	ctx.ui.setStatus(STATUS_KEY, `ctx ${rounded}%${suffix}`);
	return percent;
}

export default function contextUsage(pi: ExtensionAPI) {
	let warningShown = false;

	pi.on("session_start", (_event, ctx) => {
		warningShown = false;
		updateContextStatus(ctx);
	});

	pi.on("turn_end", (_event, ctx) => {
		const percent = updateContextStatus(ctx);
		if (percent === null) {
			return;
		}

		if (percent < CONTEXT_WARNING_THRESHOLD) {
			warningShown = false;
			return;
		}

		if (!warningShown) {
			ctx.ui.notify(`⚠ Context ${Math.round(percent)}%. Auto-compaction is disabled.`, "warning");
			warningShown = true;
		}
	});

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}
