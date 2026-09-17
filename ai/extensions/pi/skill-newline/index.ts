import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// pi core splits "/skill:name args" on the first literal space only (agent-session.ts,
// _expandSkillCommand), so a newline right after the skill name makes the lookup miss and the raw
// "/skill:..." text reaches the model. Upstream declined to change it (earendil-works/pi#8413).
// The input hook runs before that expansion, so we normalize the separator to a single space here.
const SKILL_COMMAND = /^\/skill:(\S+)(\s+)([\s\S]*)$/;

export function normalizeSkillCommand(text: string): string | undefined {
	const match = text.match(SKILL_COMMAND);
	if (!match) return undefined;

	const [, name, separator, rest] = match;
	if (separator === " ") return undefined;

	const args = rest.trim();
	return args ? `/skill:${name} ${args}` : `/skill:${name}`;
}

export default function skillNewline(pi: ExtensionAPI) {
	pi.on("input", (event) => {
		const text = normalizeSkillCommand(event.text);
		if (text === undefined) return { action: "continue" };
		return { action: "transform", text, images: event.images };
	});
}
