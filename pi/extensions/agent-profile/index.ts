import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	parseProfileRoutes,
	parseProjectProfile,
	PROFILE_ROUTES_DIR,
	PROJECT_PROFILE_FILE,
	resolveProjectRoutes,
	type PrimaryRoute,
	type PrimaryRoutes,
	type ProfileRoutes,
} from "./project.ts";
import {
	MODEL_ROUTES_FILE,
	parseModelRoutes,
	resolveRoute,
	splitModelRef,
	SUBAGENT_TOOL,
	subagentModelViolation,
	THINKING_LEVELS,
	toModelRoutes,
	VIRTUAL_MODEL_PROVIDER,
	type ModelRoutes,
} from "./routes.ts";

const PROFILE_EXTENSION = ".json";
const PROFILES_DIR = "pi/profiles";
const ACTIVE_PROFILE_FILE = "active.json";
const AGENTS_DIR = "agents";
const AGENT_EXTENSION = ".md";
const SETUP_TIMEOUT_MS = 60_000;
const ERROR_LINES = 3;
const RELOAD_REASON = "reload";
// Only a new session takes the project's primary model: a restored or reloaded one keeps the model it has.
const FRESH_REASONS: readonly string[] = ["startup", "new"];
const CUSTOM_ENTRY_TYPE = "custom";
// Session entries written by pi-open-agents with the active primary agent: the first when an agent is applied, the second on the next turn.
const AGENT_STATE_ENTRIES: readonly string[] = ["active_agent", "open-agents-state"];
const MODEL_REF_SEPARATOR = "/";
// Survives ctx.reload(), which reloads this module and drops its state.
const PENDING_SWITCH_KEY = Symbol.for("dotfiles.agent-profile.pendingSwitch");
// Effective project routes as JSON. Subagent processes inherit it, so they match the parent whatever their cwd is.
const PROJECT_ROUTES_ENV = "PI_AGENT_PROFILE_PROJECT_ROUTES";
// Set by pi-open-agents; a positive depth marks a subagent process.
const SUBAGENT_DEPTH_ENV = "PI_OPEN_AGENTS_DEPTH";
const PROJECT_FILE_LABEL = `${CONFIG_DIR_NAME}/${PROJECT_PROFILE_FILE}`;
const PROJECT_STATUS_SUFFIX = "project";
const STATUS_SEPARATOR = " · ";
const STATUS_KEY = "agent-profile";

type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0];
type ProfileAgent = { model?: string; thinking?: ThinkingLevel };
type PendingSwitchHolder = { [PENDING_SWITCH_KEY]?: string };
type ProjectState = { name?: string; routes: ModelRoutes; primary: PrimaryRoutes };

const pendingSwitch = globalThis as PendingSwitchHolder;
let switching = false;
let project: ProjectState | undefined;
let primaryPending = false;

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
				e.type === CUSTOM_ENTRY_TYPE && e.customType !== undefined && AGENT_STATE_ENTRIES.includes(e.customType),
		)
		.pop() as { data?: { name?: string | null } } | undefined;
	return entry?.data?.name ?? undefined;
}

function projectPrimary(agent: string): PrimaryRoute | undefined {
	return project && Object.hasOwn(project.primary, agent) ? project.primary[agent] : undefined;
}

// pi-open-agents restores the primary agent on reload without its model, so the session keeps the old profile's model.
async function applyPrimaryAgentModel(pi: ExtensionAPI, ctx: ExtensionContext, profile: string): Promise<void> {
	const root = process.env.DOTFILES_BASE;
	const agent = activePrimaryAgent(ctx);
	// A project model for this agent wins over the freshly installed global profile.
	if (!root || !agent || projectPrimary(agent)?.model) return;

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

// Idempotent: runs at session start and again before the first run, because pi-open-agents may apply the agent's installed model in between.
async function applyProjectPrimary(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
	const agent = activePrimaryAgent(ctx);
	const settings = agent ? projectPrimary(agent) : undefined;
	if (!agent || !settings) return;

	const current = ctx.model ? ctx.model.provider + MODEL_REF_SEPARATOR + ctx.model.id : undefined;
	if (settings.model && settings.model !== current) {
		const ref = splitModelRef(settings.model);
		const model = ref ? ctx.modelRegistry.find(ref.provider, ref.id) : undefined;
		if (!model || !(await pi.setModel(model))) {
			ctx.ui.notify(`${PROJECT_FILE_LABEL}: cannot switch ${agent} to ${settings.model}`, "warning");
			return;
		}
		ctx.ui.notify(`${PROJECT_FILE_LABEL} active: ${agent} on ${settings.model}`, "info");
	}
	if (settings.thinking && settings.thinking !== pi.getThinkingLevel()) pi.setThinkingLevel(settings.thinking);
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

function installedAgents(): string[] {
	try {
		return readdirSync(join(getAgentDir(), AGENTS_DIR))
			.filter((file) => file.endsWith(AGENT_EXTENSION))
			.map((file) => basename(file, AGENT_EXTENSION));
	} catch {
		return [];
	}
}

function readProfileRoutes(name: string): ProfileRoutes {
	let json: string;
	try {
		json = readFileSync(join(getAgentDir(), PROFILE_ROUTES_DIR, name + PROFILE_EXTENSION), "utf8");
	} catch {
		throw new Error(`profile ${name} was not generated by the last bin/setup-pi run (missing or invalid in ${PROFILES_DIR})`);
	}
	return parseProfileRoutes(json);
}

// A missing file means no override. An invalid or untrusted one is reported and the global profile stays active.
function loadProject(ctx: ExtensionContext, global: ModelRoutes): { state?: ProjectState; error?: string } {
	let json: string;
	try {
		json = readFileSync(join(ctx.cwd, CONFIG_DIR_NAME, PROJECT_PROFILE_FILE), "utf8");
	} catch {
		return {};
	}
	if (!ctx.isProjectTrusted()) return { error: "the project is not trusted" };
	try {
		const profile = parseProjectProfile(json);
		const named = profile.profile === undefined ? undefined : readProfileRoutes(profile.profile);
		return { state: { name: profile.profile, ...resolveProjectRoutes(global, profile, named, installedAgents()) } };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

// A subagent takes the parent's resolution from the environment. A missing, empty or invalid value means no override.
function inheritedProject(): ProjectState | undefined {
	try {
		const routes = toModelRoutes(JSON.parse(process.env[PROJECT_ROUTES_ENV] ?? ""));
		return Object.keys(routes).length > 0 ? { routes, primary: {} } : undefined;
	} catch {
		return undefined;
	}
}

export default function (pi: ExtensionAPI) {
	// Read once: /profile reloads this module and every subagent is a fresh process.
	const { routes, error: routesError } = loadModelRoutes();
	// Only a subagent trusts the inherited value: a pi started from a shell inside another pi resolves its own project.
	const subagent = Number(process.env[SUBAGENT_DEPTH_ENV]) > 0;
	project = subagent ? inheritedProject() : undefined;

	if (routes) {
		for (const [key, route] of Object.entries(routes)) {
			pi.registerVirtualModel({
				provider: VIRTUAL_MODEL_PROVIDER,
				id: key,
				name: `Profile ${key}`,
				thinkingLevels: THINKING_LEVELS,
				route(request, ctx) {
					// Looked up per request: the project override is resolved at session start, after registration.
					const projectRoute = project && Object.hasOwn(project.routes, key) ? project.routes[key] : undefined;
					return resolveRoute(
						key,
						projectRoute ?? route,
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
		if (routes && !subagent) {
			const loaded = loadProject(ctx, routes);
			project = loaded.state;
			process.env[PROJECT_ROUTES_ENV] = JSON.stringify(project?.routes ?? {});
			const profileSwitch = event.reason === RELOAD_REASON && pendingSwitch[PENDING_SWITCH_KEY] !== undefined;
			primaryPending = project !== undefined && (FRESH_REASONS.includes(event.reason) || profileSwitch);
			if (loaded.error && ctx.hasUI) {
				ctx.ui.notify(`Ignoring ${PROJECT_FILE_LABEL}: ${loaded.error}`, "warning");
			}
		}
		if (ctx.hasUI) {
			const root = process.env.DOTFILES_BASE;
			const name = project?.name ?? (root ? activeProfile(root) : undefined);
			const label = [name, project ? PROJECT_STATUS_SUFFIX : undefined].filter(Boolean).join(STATUS_SEPARATOR);
			// Brackets keep the name apart from the next status; pi joins footer statuses with a single space.
			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				STATUS_KEY,
				label ? `${theme.fg("dim", "[")}${theme.fg("accent", label)}${theme.fg("dim", "]")}` : undefined,
			);
		}

		const profile = pendingSwitch[PENDING_SWITCH_KEY];
		if (event.reason === RELOAD_REASON && profile !== undefined) {
			delete pendingSwitch[PENDING_SWITCH_KEY];
			await applyPrimaryAgentModel(pi, ctx, profile);
		}
		if (primaryPending) await applyProjectPrimary(pi, ctx);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		if (!primaryPending) return;
		primaryPending = false;
		await applyProjectPrimary(pi, ctx);
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
				if (project) {
					ctx.ui.notify(
						`${PROJECT_FILE_LABEL} stays applied on top of the global profile in this project`,
						"info",
					);
				}

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
