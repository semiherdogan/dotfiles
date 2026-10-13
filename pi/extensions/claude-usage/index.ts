import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);

const STATUS_KEY = "claude-usage";
const CLAUDE_PROVIDERS = new Set(["claude-bridge", "anthropic"]);
// pi-claude-bridge routes through the Claude Code CLI, so the subscription token is the CLI's
// keychain item, not anything in ~/.pi/agent/auth.json.
const KEYCHAIN_SERVICE = "Claude Code-credentials";
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;

type UsageWindow = { percent: number; resetsAt: string | null };
type Usage = { fiveHour: UsageWindow; sevenDay: UsageWindow };

let cached: { usage: Usage; at: number } | undefined;
let inFlight: Promise<Usage | undefined> | undefined;

async function readAccessToken(): Promise<string | undefined> {
	if (process.platform !== "darwin") return undefined;
	try {
		const { stdout } = await execFileAsync(
			"security",
			["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
			{ timeout: 5_000, maxBuffer: 4 * 1024 * 1024 },
		);
		const token = (JSON.parse(stdout) as { claudeAiOauth?: { accessToken?: unknown } }).claudeAiOauth
			?.accessToken;
		return typeof token === "string" ? token : undefined;
	} catch {
		return undefined;
	}
}

function toWindow(raw: unknown): UsageWindow {
	const window = (raw ?? {}) as { utilization?: unknown; resets_at?: unknown };
	return {
		percent: typeof window.utilization === "number" ? window.utilization : 0,
		resetsAt: typeof window.resets_at === "string" ? window.resets_at : null,
	};
}

async function fetchUsage(token: string): Promise<Usage | undefined> {
	try {
		const response = await fetch(USAGE_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				"anthropic-beta": "oauth-2025-04-20",
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!response.ok) return undefined;
		const body = (await response.json()) as { five_hour?: unknown; seven_day?: unknown };
		return { fiveHour: toWindow(body.five_hour), sevenDay: toWindow(body.seven_day) };
	} catch {
		return undefined;
	}
}

function currentUsage(force: boolean): Promise<Usage | undefined> {
	if (!force) {
		if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.usage);
		if (inFlight) return inFlight;
	}

	const request = (async () => {
		const token = await readAccessToken();
		if (!token) return undefined;
		const usage = await fetchUsage(token);
		if (usage) cached = { usage, at: Date.now() };
		return usage;
	})().finally(() => {
		if (inFlight === request) inFlight = undefined;
	});

	inFlight = request;
	return request;
}

function severity(percent: number): "error" | "warning" | "muted" {
	if (percent >= 90) return "error";
	if (percent >= 70) return "warning";
	return "muted";
}

function resetIn(resetsAt: string | null): string {
	if (!resetsAt) return "unknown";
	const diffMs = new Date(resetsAt).getTime() - Date.now();
	if (Number.isNaN(diffMs) || diffMs <= 0) return "now";
	const minutes = Math.round(diffMs / 60_000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
	return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function render(ctx: ExtensionContext, usage: Usage): string {
	const theme = ctx.ui.theme;
	const five = theme.fg(severity(usage.fiveHour.percent), `5h ${Math.round(usage.fiveHour.percent)}%`);
	const week = theme.fg(severity(usage.sevenDay.percent), `7d ${Math.round(usage.sevenDay.percent)}%`);
	return `${five} ${theme.fg("dim", "·")} ${week}`;
}

function isClaudeModel(model: { id: string; provider: string } | undefined): boolean {
	if (!model) return false;
	return CLAUDE_PROVIDERS.has(model.provider) || model.id.startsWith("claude");
}

async function updateStatus(ctx: ExtensionContext, force: boolean, model = ctx.model): Promise<void> {
	if (!ctx.hasUI) return;
	if (!isClaudeModel(model)) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return;
	}
	const usage = await currentUsage(force);
	ctx.ui.setStatus(STATUS_KEY, usage ? render(ctx, usage) : ctx.ui.theme.fg("dim", "usage n/a"));
}

export default function claudeUsage(pi: ExtensionAPI) {
	pi.registerCommand("usage", {
		description: "Show Claude subscription usage (5-hour and weekly windows)",
		handler: async (_args, ctx) => {
			if (!isClaudeModel(ctx.model)) {
				ctx.ui.notify("Claude usage applies only to Claude models or the anthropic/claude-bridge providers.", "info");
				return;
			}
			const usage = await currentUsage(true);
			if (!usage) {
				ctx.ui.notify(
					"Claude usage unavailable: no Claude Code credentials in the keychain, or the token is expired. Run `claude` once to refresh it.",
					"warning",
				);
				return;
			}
			await updateStatus(ctx, false);
			ctx.ui.notify(
				[
					`5-hour: ${Math.round(usage.fiveHour.percent)}% used, resets in ${resetIn(usage.fiveHour.resetsAt)}`,
					`Weekly: ${Math.round(usage.sevenDay.percent)}% used, resets in ${resetIn(usage.sevenDay.resetsAt)}`,
				].join("\n"),
				"info",
			);
		},
	});

	pi.on("session_start", (_event, ctx) => {
		void updateStatus(ctx, false);
	});

	pi.on("turn_end", (_event, ctx) => {
		void updateStatus(ctx, false);
	});

	pi.on("model_select", (event, ctx) => {
		void updateStatus(ctx, false, event.model);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}
