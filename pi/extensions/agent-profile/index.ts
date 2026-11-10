import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	MODEL_ROUTES_FILE,
	parseModelRoutes,
	resolveRoute,
	SUBAGENT_TOOL,
	subagentModelViolation,
	THINKING_LEVELS,
	VIRTUAL_MODEL_PROVIDER,
	type ModelRoutes,
} from "./routes.ts";

const PROFILE_EXTENSION = ".json";
const PROFILES_DIR = "pi/profiles";
const ACTIVE_PROFILE_FILE = "active.json";
const SETUP_TIMEOUT_MS = 60_000;
const ERROR_LINES = 3;
const RELOAD_REASON = "reload";
const CUSTOM_ENTRY_TYPE = "custom";
// Session entry written by pi-open-agents with the active primary agent.
const OPEN_AGENTS_STATE_ENTRY = "open-agents-state";
const MODEL_REF_SEPARATOR = "/";
// Survives ctx.reload(), which reloads this module and drops its state.
const PENDING_SWITCH_KEY = Symbol.for("dotfiles.agent-profile.pendingSwitch");
const STATUS_KEY = "agent-profile";

type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0];
type ProfileAgent = { model?: string; thinking?: ThinkingLevel };
type PendingSwitchHolder = { [PENDING_SWITCH_KEY]?: string };

const pendingSwitch = globalThis as PendingSwitchHolder;
let switching = false;

function listProfiles(root: string): string[] {
	try {
		return readdirSync(join(root, PROFILES_DIR))
			.filter((file) => file.endsWith(PROFILE_EXTENSION) && file !== ACTIVE_PROFILE_FILE)
			.map((file) => basename(file, PROFILE_EXTENSION))
			.sort();
	} catch {
		return [];
	}
}

function activeProfile(root: string): string | undefined {
	try {
		return basename(readlinkSync(join(root, PROFILES_DIR, ACTIVE_PROFILE_FILE)), PROFILE_EXTENSION);
	} catch {
		return undefined;
	}
}

function readActiveProfile(root: string): Record<string, ProfileAgent> | undefined {
	try {
		return JSON.parse(readFileSync(join(root, PROFILES_DIR, ACTIVE_PROFILE_FILE), "utf8"));
	} catch {
		return undefined;
	}
}

function activePrimaryAgent(ctx: ExtensionContext): string | undefined {
	const entry = ctx.sessionManager
		.getEntries()
		.filter(
			(e: { type: string; customType?: string }) =>
				e.type === CUSTOM_ENTRY_TYPE && e.customType === OPEN_AGENTS_STATE_ENTRY,
		)
		.pop() as { data?: { name?: string | null } } | undefined;
	return entry?.data?.name ?? undefined;
}

// pi-open-agents restores the primary agent on reload without its model, so the session keeps the old profile's model.
async function applyPrimaryAgentModel(pi: ExtensionAPI, ctx: ExtensionContext, profile: string): Promise<void> {
	const root = process.env.DOTFILES_BASE;
	const agent = activePrimaryAgent(ctx);
	if (!root || !agent) return;

	const settings = readActiveProfile(root)?.[agent];
	if (!settings?.model) return;

	const separator = settings.model.indexOf(MODEL_REF_SEPARATOR);
	const model =
		separator > 0
			? ctx.modelRegistry.find(settings.model.slice(0, separator), settings.model.slice(separator + 1))
			: undefined;
	if (!model || !(await pi.setModel(model))) {
		ctx.ui.notify(`Profile ${profile}: cannot switch ${agent} to ${settings.model}`, "warning");
		return;
	}
	if (settings.thinking) pi.setThinkingLevel(settings.thinking);
	ctx.ui.notify(`Profile ${profile} active: ${agent} on ${settings.model}`, "info");
}

// Missing file means setup-pi has not written routes: stay out of the way. An invalid file is reported once.
function loadModelRoutes(): { routes?: ModelRoutes; error?: string } {
	let json: string;
	try {
		json = readFileSync(join(getAgentDir(), MODEL_ROUTES_FILE), "utf8");
	} catch {
		return {};
	}
	try {
		return { routes: parseModelRoutes(json) };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

export default function (pi: ExtensionAPI) {
	// Read once: /profile reloads this module and every subagent is a fresh process.
	const { routes, error: routesError } = loadModelRoutes();

	if (routes) {
		for (const [key, route] of Object.entries(routes)) {
			pi.registerVirtualModel({
				provider: VIRTUAL_MODEL_PROVIDER,
				id: key,
				name: `Profile ${key}`,
				thinkingLevels: THINKING_LEVELS,
				route(request, ctx) {
					return resolveRoute(
						key,
						route,
						(provider, id) => ctx.modelRegistry.find(provider, id),
						request.thinkingLevel,
					);
				},
			});
		}

		pi.on("tool_call", async (event) => {
			if (event.toolName !== SUBAGENT_TOOL) return;
			const reason = subagentModelViolation((event.input as { model?: unknown }).model, routes);
			if (reason) return { block: true, reason };
		});
	}

	pi.on("session_start", async (event, ctx) => {
		if (routesError && ctx.hasUI) {
			ctx.ui.notify(`Invalid ${MODEL_ROUTES_FILE}, profile models disabled: ${routesError}`, "warning");
		}
		if (ctx.hasUI) {
			const root = process.env.DOTFILES_BASE;
			const active = root ? activeProfile(root) : undefined;
			// Brackets keep the name apart from the next status; pi joins footer statuses with a single space.
			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				STATUS_KEY,
				active ? `${theme.fg("dim", "[")}${theme.fg("accent", active)}${theme.fg("dim", "]")}` : undefined,
			);
		}

		const profile = pendingSwitch[PENDING_SWITCH_KEY];
		if (event.reason !== RELOAD_REASON || profile === undefined) return;
		delete pendingSwitch[PENDING_SWITCH_KEY];
		await applyPrimaryAgentModel(pi, ctx, profile);
	});

	pi.registerCommand("profile", {
		description: "Switch the Pi agent profile (pi/profiles) and reload",
		getArgumentCompletions: (prefix) => {
			const root = process.env.DOTFILES_BASE;
			if (!root) return null;
			return listProfiles(root)
				.filter((name) => name.startsWith(prefix))
				.map((name) => ({ value: name, label: name }));
		},
		handler: async (args, ctx) => {
			const root = process.env.DOTFILES_BASE;
			if (!root) {
				ctx.ui.notify("DOTFILES_BASE is not set; cannot locate pi/profiles.", "error");
				return;
			}

			const names = listProfiles(root);
			let name: string | undefined = args.trim();
			if (!name) {
				name = await ctx.ui.select(`Pi agent profile (active: ${activeProfile(root) ?? "none"})`, names);
				if (name === undefined) return;
			}
			if (!names.includes(name)) {
				ctx.ui.notify(`Unknown profile: ${name}. Available: ${names.join(", ")}`, "error");
				return;
			}
			if (switching) {
				ctx.ui.notify("A profile switch is already in progress", "warning");
				return;
			}
			switching = true;

			try {
				// Pi refuses to reload while the agent runs, so switching mid-run would leave the old runtime loaded.
				if (!ctx.isIdle()) {
					ctx.ui.notify(`Profile ${name} will be applied when the current run finishes`, "info");
					await ctx.waitForIdle();
				}

				const result = await pi.exec(join(root, "bin/setup-pi"), ["--profile", name], {
					cwd: root,
					timeout: SETUP_TIMEOUT_MS,
				});
				if (result.code !== 0) {
					const output = result.stderr.trim() ? result.stderr : result.stdout;
					const lines = output
						.split("\n")
						.filter((line) => line.trim())
						.slice(-ERROR_LINES);
					ctx.ui.notify(`setup-pi failed: ${lines.join("\n")}`, "error");
					return;
				}

				// A run can start while setup-pi works; reload would then be refused.
				if (!ctx.isIdle()) await ctx.waitForIdle();

				ctx.ui.notify(`Profile ${name} installed, reloading`, "info");
				pendingSwitch[PENDING_SWITCH_KEY] = name;
				try {
					await ctx.reload();
				} finally {
					// Consumed by the reloaded instance; clear it if pi refused or failed the reload so a later /reload does not switch models.
					delete pendingSwitch[PENDING_SWITCH_KEY];
				}
				return;
			} finally {
				switching = false;
			}
		},
	});
}
