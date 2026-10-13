import { readdirSync, readlinkSync } from "node:fs";
import { basename, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROFILE_EXTENSION = ".json";
const PROFILES_DIR = "pi/profiles";
const ACTIVE_PROFILE_FILE = "active.json";
const SETUP_TIMEOUT_MS = 60_000;
const ERROR_LINES = 3;

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

export default function (pi: ExtensionAPI) {
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

			ctx.ui.notify(`Profile ${name} installed, reloading`, "info");
			await ctx.reload();
		},
	});
}
