import {
	isThinkingLevel,
	splitModelRef,
	toModelRoutes,
	VIRTUAL_MODEL_PROVIDER,
	type ModelRoutes,
	type ThinkingLevel,
} from "./routes.ts";

export const PROJECT_PROFILE_FILE = "profile.json";
export const PROFILE_ROUTES_DIR = "agent-profiles";

// Matches PI_ESCALATION_ROUTE_SUFFIX in bin/setup-pi.
const ESCALATION_ROUTE_SUFFIX = "-escalation";
const VIRTUAL_MODEL_PREFIX = VIRTUAL_MODEL_PROVIDER + "/";
const PROFILE_NAME = /^[A-Za-z0-9_-]+$/;
const PROJECT_FIELDS = ["profile", "agents"];
const OVERRIDE_FIELDS = ["model", "escalationModel", "thinking"];

export type PrimaryRoute = { model?: string; thinking?: ThinkingLevel };
export type PrimaryRoutes = Record<string, PrimaryRoute>;
export type ProfileRoutes = { routes: ModelRoutes; primary: PrimaryRoutes };
export type AgentOverride = PrimaryRoute & { escalationModel?: string };
export type ProjectProfile = { profile?: string; agents: Record<string, AgentOverride> };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownField(value: Record<string, unknown>, known: string[]): string | undefined {
	return Object.keys(value).find((key) => !known.includes(key));
}

function parsePhysicalModel(agent: string, value: unknown): string {
	if (typeof value !== "string" || !splitModelRef(value) || value.startsWith(VIRTUAL_MODEL_PREFIX)) {
		throw new Error(`agent ${agent} needs physical models in provider/id form`);
	}
	return value;
}

function parseAgentOverride(agent: string, value: unknown): AgentOverride {
	if (!isRecord(value)) throw new Error(`agent ${agent} must be an object`);
	const unknown = unknownField(value, OVERRIDE_FIELDS);
	if (unknown !== undefined) throw new Error(`agent ${agent} has an unknown field: ${unknown}`);

	const { model, escalationModel, thinking } = value;
	const override: AgentOverride = {};
	if (model !== undefined) override.model = parsePhysicalModel(agent, model);
	if (escalationModel !== undefined) override.escalationModel = parsePhysicalModel(agent, escalationModel);
	if (thinking !== undefined) {
		if (!isThinkingLevel(thinking)) {
			throw new Error(`agent ${agent} has an unknown thinking level: ${String(thinking)}`);
		}
		override.thinking = thinking;
	}
	return override;
}

export function parseProjectProfile(json: string): ProjectProfile {
	const data: unknown = JSON.parse(json);
	if (!isRecord(data)) throw new Error("project profile must be a JSON object");
	const unknown = unknownField(data, PROJECT_FIELDS);
	if (unknown !== undefined) throw new Error(`unknown field: ${unknown}`);

	const { profile, agents = {} } = data;
	if (profile !== undefined && (typeof profile !== "string" || !PROFILE_NAME.test(profile))) {
		throw new Error("profile must be a profile name");
	}
	if (!isRecord(agents)) throw new Error("agents must be an object");
	// fromEntries defines own properties, so a "__proto__" key cannot reach the prototype.
	const overrides = Object.fromEntries(
		Object.entries(agents).map(([agent, value]) => [agent, parseAgentOverride(agent, value)]),
	);
	return profile === undefined ? { agents: overrides } : { profile, agents: overrides };
}

export function parseProfileRoutes(json: string): ProfileRoutes {
	const data: unknown = JSON.parse(json);
	if (!isRecord(data)) throw new Error("profile routes must be a JSON object");
	return { routes: toModelRoutes(data.routes), primary: toModelRoutes(data.primary) };
}

// The named profile applies first, then the per-agent overrides field by field. An agent without a route is a primary agent.
export function resolveProjectRoutes(
	global: ModelRoutes,
	project: ProjectProfile,
	named: ProfileRoutes | undefined,
	knownAgents: readonly string[],
): ProfileRoutes {
	const routes: ModelRoutes = { ...global, ...named?.routes };
	const primary: PrimaryRoutes = { ...named?.primary };

	for (const [agent, { escalationModel, ...fields }] of Object.entries(project.agents)) {
		if (!knownAgents.includes(agent)) throw new Error(`unknown agent: ${agent}`);
		if (!Object.hasOwn(routes, agent)) {
			if (escalationModel !== undefined) throw new Error(`agent ${agent} has no escalation route`);
			primary[agent] = { ...(Object.hasOwn(primary, agent) ? primary[agent] : undefined), ...fields };
			continue;
		}
		routes[agent] = { ...routes[agent], ...fields };

		const escalation = agent + ESCALATION_ROUTE_SUFFIX;
		if (!Object.hasOwn(routes, escalation)) continue;
		routes[escalation] = {
			...routes[escalation],
			...(escalationModel === undefined ? undefined : { model: escalationModel }),
			...(fields.thinking === undefined ? undefined : { thinking: fields.thinking }),
		};
	}
	return { routes, primary };
}
