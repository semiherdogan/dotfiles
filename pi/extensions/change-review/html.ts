import { type DiffLine, LINE_KIND, type LineKind } from "./diff.ts";
import { type ChangedFile, FILE_STATUS, type FileStatus, normalizeRepoPath, type Snapshot } from "./git.ts";
import { SEVERITIES, type Severity, type Submission, TESTS_LABEL, type ValidatedFinding, type Validation, vscodeLink } from "./report.ts";

const MAX_DIFF_LINES = 1500;
const STORAGE_KEY_PREFIX = "change-review:";
const NOTHING_FLAGGED = "Nothing flagged.";
const FILE_TOO_LARGE = "File too large to show.";
const OUTSIDE_CHANGE = "outside changed lines";
const NUMBER_COL_PX = 52;
const MARKER_COL_PX = 20;
const GUTTER_PX = NUMBER_COL_PX * 2 + MARKER_COL_PX;
const TAB_SIZE = 4;
const ISO_MINUTES_LENGTH = 16;
const STATUS_LABEL: Record<FileStatus, string> = {
	[FILE_STATUS.added]: "added",
	[FILE_STATUS.modified]: "modified",
	[FILE_STATUS.deleted]: "deleted",
	[FILE_STATUS.renamed]: "renamed",
	[FILE_STATUS.copied]: "copied",
	[FILE_STATUS.typeChanged]: "type changed",
	[FILE_STATUS.untracked]: "new file",
};

const TONE = { add: "add", change: "change", del: "del", move: "move" } as const;
type Tone = (typeof TONE)[keyof typeof TONE];
const STATUS_BADGE: Record<FileStatus, { letter: string; tone: Tone }> = {
	[FILE_STATUS.added]: { letter: "A", tone: TONE.add },
	[FILE_STATUS.modified]: { letter: "M", tone: TONE.change },
	[FILE_STATUS.deleted]: { letter: "D", tone: TONE.del },
	[FILE_STATUS.renamed]: { letter: "R", tone: TONE.move },
	[FILE_STATUS.copied]: { letter: "C", tone: TONE.move },
	[FILE_STATUS.typeChanged]: { letter: "T", tone: TONE.move },
	[FILE_STATUS.untracked]: { letter: "U", tone: TONE.add },
};

const MINUS = "\u2212";
const LINE_MARKER: Record<LineKind, string> = {
	[LINE_KIND.added]: "+",
	[LINE_KIND.removed]: MINUS,
	[LINE_KIND.context]: "",
};

const svg = (body: string) =>
	`<svg class="icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICON = {
	check: svg(`<path d="M3.5 8.5l3 3 6-7"/>`),
	checkCircle: svg(`<circle cx="8" cy="8" r="6"/><path d="M5.5 8.2l1.7 1.7 3.3-3.6"/>`),
	file: svg(`<path d="M4 1.75h5l3 3v9.5H4z"/><path d="M9 1.75v3h3"/>`),
	files: svg(`<path d="M5.5 1.75h4l2.5 2.5v6.5h-6.5z"/><path d="M3.5 4.5v9.75h6.5"/>`),
	branch: svg(`<circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="5.5" r="1.5"/><path d="M4.5 5v6M11.5 7c0 2.5-3 2.5-7 4"/>`),
	external: svg(`<path d="M9.5 2.5h4v4M13.5 2.5l-6 6M12 9v3.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H7"/>`),
	flask: svg(`<path d="M6 2h4M6.5 2v4.5L3 13a1 1 0 0 0 .9 1.5h8.2A1 1 0 0 0 13 13L9.5 6.5V2"/><path d="M4.8 10h6.4"/>`),
	unfold: svg(`<path d="M4 6l4-3 4 3M4 10l4 3 4-3"/>`),
	logo: svg(`<path d="M8 3.5v5M5.5 6h5M5.5 12h5"/>`),
} as const;

const SEVERITY_ICON_SVG: Record<Severity, string> = {
	critical: svg(`<path d="M5.2 1.8h5.6l3.4 3.4v5.6l-3.4 3.4H5.2l-3.4-3.4V5.2z"/><path d="M8 5v3.5M8 10.8v.01"/>`),
	high: svg(`<path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3M8 11.8v.01"/>`),
	medium: svg(`<path d="M8 1.8l6.2 6.2L8 14.2 1.8 8z"/><path d="M8 5.5v3M8 10.6v.01"/>`),
	low: svg(`<circle cx="8" cy="8" r="6"/><path d="M8 7.5v3.5M8 5.2v.01"/>`),
};

const EMPTY_CIRCLE = `<span class="circle"></span>`;

const STYLE = `
:root {
	color-scheme: dark light;
	--bg: #0b0d10; --surface: #111418; --surface-2: #171b21; --surface-3: #1e232b;
	--border: #242a33; --border-strong: #313844;
	--text: #e6e8eb; --text-2: #b4bcc8; --muted: #7d8695;
	--accent: #7c9cff; --accent-soft: rgba(124, 156, 255, .14);
	--add-bg: rgba(46, 160, 67, .13); --add-gutter: rgba(46, 160, 67, .22); --add-fg: #3fb950;
	--del-bg: rgba(248, 81, 73, .12); --del-gutter: rgba(248, 81, 73, .22); --del-fg: #f85149;
	--hunk-bg: rgba(124, 156, 255, .07);
	--sev-critical: #f43f5e; --sev-high: #f97316; --sev-medium: #eab308; --sev-low: #60a5fa;
	--shadow: 0 1px 2px rgba(0, 0, 0, .25);
	--radius-sm: 6px; --radius: 10px; --radius-pill: 999px;
	--ui: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
	--mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
	--t: 120ms;
	--top-h: 56px;
	--file-header-h: 48px;
	--anchor-offset: calc(var(--top-h) + var(--file-header-h) + 16px);
}
@media (prefers-color-scheme: light) {
	:root {
		--bg: #f6f7f9; --surface: #ffffff; --surface-2: #f9fafb; --surface-3: #f1f3f6;
		--border: #e3e6eb; --border-strong: #cfd5dd;
		--text: #1b2230; --text-2: #3d4757; --muted: #6b7585;
		--accent: #3b5bdb; --accent-soft: rgba(59, 91, 219, .10);
		--add-bg: #e9f7ec; --add-gutter: #cdeed4; --add-fg: #1a7f37;
		--del-bg: #fdecec; --del-gutter: #f8d3d1; --del-fg: #cf222e;
		--hunk-bg: #eef2ff;
		--sev-critical: #e11d48; --sev-high: #ea580c; --sev-medium: #ca8a04; --sev-low: #2563eb;
		--shadow: 0 1px 2px rgba(16, 24, 40, .06);
	}
}
* { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 var(--ui); -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-decoration: none; transition: color var(--t); }
a:hover { text-decoration: underline; }
code, .mono { font-family: var(--mono); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.icon { flex: none; vertical-align: middle; }
.muted { color: var(--muted); }
.sev-critical { --sev: var(--sev-critical); }
.sev-high { --sev: var(--sev-high); }
.sev-medium { --sev: var(--sev-medium); }
.sev-low { --sev: var(--sev-low); }

.top { position: sticky; top: 0; z-index: 30; height: var(--top-h); display: flex; align-items: center; gap: 24px; padding: 0 20px; background: color-mix(in srgb, var(--surface) 80%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; white-space: nowrap; }
.logo { display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; border-radius: 7px; background: var(--accent); color: var(--bg); }
.crumb { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.crumb .sep { color: var(--border-strong); }
.stats { display: flex; align-items: center; gap: 14px; color: var(--muted); font-size: 13px; white-space: nowrap; }
.stats .item { display: inline-flex; align-items: center; gap: 6px; }
.add-count { color: var(--add-fg); font-family: var(--mono); }
.del-count { color: var(--del-fg); font-family: var(--mono); }
.progress { margin-left: auto; display: flex; align-items: center; gap: 12px; color: var(--text-2); font-size: 13px; white-space: nowrap; }
#progress-text { display: inline-flex; align-items: center; gap: 6px; }
.bar { width: 120px; height: 6px; border-radius: var(--radius-pill); background: var(--surface-3); overflow: hidden; }
#progress-bar { height: 100%; width: 0; border-radius: var(--radius-pill); background: var(--accent); transition: width var(--t), background-color var(--t); }
.progress.complete #progress-text { color: var(--add-fg); }
.progress.complete #progress-bar { background: var(--add-fg); }

.layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); align-items: start; }
.sidebar { position: sticky; top: var(--top-h); height: calc(100vh - var(--top-h)); overflow-y: auto; padding: 16px 12px 24px; background: var(--surface); border-right: 1px solid var(--border); }
.side-section + .side-section { margin-top: 24px; }
.sidebar h2 { display: flex; align-items: center; justify-content: space-between; margin: 0 0 8px; padding: 0 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.count { min-width: 20px; padding: 0 6px; border-radius: var(--radius-pill); background: var(--surface-3); color: var(--text-2); font-size: 11px; line-height: 18px; text-align: center; letter-spacing: 0; }
.sidebar ul { list-style: none; margin: 0; padding: 0; }
.sidebar li + li { margin-top: 2px; }
.sidebar .empty { margin: 0; padding: 0 10px; }
.sidebar a.finding-link, .sidebar a.file-link { display: block; padding: 8px 10px; border-radius: 8px; color: var(--text); transition: background-color var(--t); }
.sidebar a.finding-link:hover, .sidebar a.file-link:hover { background: var(--surface-3); text-decoration: none; }
.finding-link .loc { display: flex; align-items: center; gap: 8px; min-width: 0; }
.finding-link .where { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); font-size: 12px; color: var(--muted); }
.finding-link .claim { display: -webkit-box; margin-top: 4px; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; color: var(--text-2); font-size: 13px; line-height: 1.4; }
.sidebar a.file-link { display: flex; align-items: center; gap: 8px; padding: 6px 10px; }
.file-link .name { display: flex; align-items: baseline; gap: 6px; flex: 1; min-width: 0; }
.file-link .base { flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.file-link .dir { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 12px; }
.file-link .delta { flex: none; display: inline-flex; gap: 6px; font-family: var(--mono); font-size: 11px; }
.dot { flex: none; display: inline-flex; width: 14px; height: 14px; align-items: center; justify-content: center; }
.dot .icon { width: 14px; height: 14px; color: var(--add-fg); }
.circle { display: block; width: 12px; height: 12px; border: 1.5px solid var(--border-strong); border-radius: 50%; }
.change-title { color: var(--text-2); }
.change-files { margin-top: 2px; font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
.side-list li { padding: 6px 10px; }
.reason { margin-top: 2px; color: var(--muted); font-size: 12px; }
.side-path { font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }

.badge { flex: none; display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; border-radius: 5px; font: 600 11px/1 var(--mono); }
.badge.tone-add { background: var(--add-bg); color: var(--add-fg); }
.badge.tone-change { background: color-mix(in srgb, var(--sev-medium) 16%, transparent); color: var(--sev-medium); }
.badge.tone-del { background: var(--del-bg); color: var(--del-fg); }
.badge.tone-move { background: var(--accent-soft); color: var(--accent); }

.pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: var(--radius-pill); background: var(--surface-3); color: var(--text-2); font-size: 12px; font-weight: 600; line-height: 20px; white-space: nowrap; transition: background-color var(--t); }
.pill .icon { width: 14px; height: 14px; }
.pill[class*="sev-"] { background: color-mix(in srgb, var(--sev) 14%, transparent); color: var(--sev); }
.pill.sm { padding: 0 8px; font-size: 11px; line-height: 18px; gap: 4px; }
.pill.sm .icon { width: 12px; height: 12px; }
.pill.ok { background: var(--add-bg); color: var(--add-fg); }
.pill.neutral { font-weight: 500; }
a.pill:hover { text-decoration: none; background: color-mix(in srgb, var(--sev) 24%, transparent); }

main { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 1280px; min-width: 0; margin: 0 auto; padding: 24px; }
.overview { padding: 20px 24px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
.overview .summary { margin: 0; font-size: 16px; line-height: 1.55; color: var(--text); }
.overview .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }

section.file { scroll-margin-top: var(--anchor-offset); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); overflow: clip; }
section.file:target { outline: 2px solid var(--accent); outline-offset: 2px; }
section.file > header { position: sticky; top: var(--top-h); z-index: 10; display: flex; flex-wrap: nowrap; align-items: center; gap: 12px; height: var(--file-header-h); box-sizing: border-box; padding: 0 14px; background: var(--surface-2); border-bottom: 1px solid var(--border); transition: opacity var(--t); }
section.file > header > * { flex: none; }
section.file > header .path { display: flex; min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 13px/1.4 var(--mono); }
section.file > header .path .dir { min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
section.file > header .path .base { flex: none; font-weight: 600; }
section.file > header .status-label { min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
section.file > header h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; font-weight: 600; }
.status-label { font-size: 12px; color: var(--muted); }
.spacer { flex: 1; }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: transparent; color: var(--text-2); font-size: 12px; font-weight: 500; white-space: nowrap; transition: background-color var(--t), border-color var(--t), color var(--t); }
.btn:hover { background: var(--surface-3); color: var(--text); text-decoration: none; }
.btn .icon { width: 14px; height: 14px; }
.btn.sm { height: 24px; padding: 0 8px; }
.reviewed-toggle { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-pill); color: var(--text-2); font-size: 12px; font-weight: 500; cursor: pointer; user-select: none; transition: background-color var(--t), border-color var(--t), color var(--t); }
.reviewed-toggle:hover { background: var(--surface-3); }
.reviewed-toggle .reviewed-box { position: absolute; width: 1px; height: 1px; margin: 0; opacity: 0; pointer-events: none; }
.reviewed-toggle .icon { display: none; width: 14px; height: 14px; }
.reviewed-toggle:has(.reviewed-box:checked) { border-color: var(--add-fg); color: var(--add-fg); }
.reviewed-toggle:has(.reviewed-box:checked) .icon { display: inline; }
.reviewed-toggle:has(.reviewed-box:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
section.file.reviewed:not(.peek) .diff-body { display: none; }
section.file.reviewed:not(.peek) > header { opacity: .75; border-bottom: 0; }

.diff-body .note { padding: 16px 14px; color: var(--muted); }
.diff-scroll { overflow-x: auto; }
table.diff { width: 100%; table-layout: fixed; border-collapse: collapse; font: 12.5px/20px var(--mono); }
col.c-num { width: ${NUMBER_COL_PX}px; }
col.c-mark { width: ${MARKER_COL_PX}px; }
table.diff td { padding: 0; vertical-align: top; }
td.num { padding: 0 8px; text-align: right; color: var(--muted); font-size: 12px; user-select: none; white-space: nowrap; }
td.num a { color: var(--muted); }
td.num a:hover { color: var(--accent); text-decoration: none; }
td.mark { text-align: center; user-select: none; }
td.code { padding: 0 12px 0 4px; white-space: pre; tab-size: ${TAB_SIZE}; }
tr.added td.num { background: var(--add-gutter); }
tr.added td.mark, tr.added td.code { background: var(--add-bg); }
tr.added td.mark { color: var(--add-fg); }
tr.removed td.num { background: var(--del-gutter); }
tr.removed td.mark, tr.removed td.code { background: var(--del-bg); }
tr.removed td.mark { color: var(--del-fg); }
tr.hunk td { padding: 4px 12px; background: var(--hunk-bg); color: var(--muted); font-size: 12px; line-height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
tr.hunk .icon { width: 14px; height: 14px; margin-right: 8px; }
tr.more td { padding: 8px 12px; color: var(--muted); font-family: var(--ui); }
tr.hl > td:first-child { box-shadow: inset 3px 0 0 var(--sev); }
tr.hl td.num.new, tr.hl td.num.new a { color: var(--sev); font-weight: 600; }

tr.card-row > td { padding: 10px 16px 12px 116px; background: var(--surface); white-space: normal; font-family: var(--ui); }
.card { scroll-margin-top: var(--anchor-offset); padding: 12px 14px; border: 1px solid var(--border); border-left: 3px solid var(--sev); border-radius: var(--radius); background: var(--surface-2); box-shadow: var(--shadow); font: 14px/1.5 var(--ui); white-space: normal; }
tr.card-row .card { position: sticky; left: 16px; width: min(880px, calc(100vw - 500px)); }
.diff-body > .card, #other-files > .card { margin: 12px; }
.card:target { outline: 2px solid var(--accent); outline-offset: 2px; animation: flash 1.2s ease-out; }
@keyframes flash { from { background: var(--accent-soft); } }
.card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.card-head .loc { min-width: 0; font: 12.5px/1.4 var(--mono); overflow-wrap: anywhere; }
.card .claim { margin: 8px 0; color: var(--text); font-size: 14px; }
.verify { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 8px; background: var(--surface-3); color: var(--text-2); }
.verify .icon { margin-top: 2px; color: var(--muted); }
.verify-label { display: block; color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.verify-text { display: block; }
#other-files > .card:last-child { margin-bottom: 12px; }

footer { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; padding: 24px 16px 32px; color: var(--muted); font-size: 12px; text-align: center; }
footer code { font-size: 12px; }
kbd { display: inline-block; min-width: 20px; padding: 1px 6px; border: 1px solid var(--border-strong); border-bottom-width: 2px; border-radius: 5px; background: var(--surface); color: var(--text-2); font: 11px/16px var(--mono); text-align: center; }

@media (max-width: 1100px) {
	.layout { grid-template-columns: minmax(0, 1fr); }
	.sidebar { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--border); }
	tr.card-row > td { padding-left: 16px; }
	tr.card-row .card { width: calc(100vw - 100px); }
	.stats, .crumb { display: none; }
}
@media (prefers-reduced-motion: reduce) {
	*, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}
`;

const SCRIPT = `
(function () {
	var CHECK = ${JSON.stringify(ICON.check)};
	var EMPTY = ${JSON.stringify(EMPTY_CIRCLE)};
	var key = "${STORAGE_KEY_PREFIX}" + document.body.getAttribute("data-report-id");
	var reviewed = {};
	try {
		var stored = JSON.parse(localStorage.getItem(key) || "[]");
		stored.forEach(function (path) { reviewed[path] = true; });
	} catch (e) {}
	var boxes = Array.prototype.slice.call(document.querySelectorAll("input.reviewed-box"));
	var dots = {};
	Array.prototype.forEach.call(document.querySelectorAll(".file-link"), function (link) {
		dots[link.getAttribute("data-path")] = link.querySelector(".dot");
	});
	var block = document.getElementById("progress");
	var text = document.getElementById("progress-text");
	var bar = document.getElementById("progress-bar");
	function save() {
		try { localStorage.setItem(key, JSON.stringify(Object.keys(reviewed))); } catch (e) {}
	}
	function refresh() {
		var done = 0;
		boxes.forEach(function (box) {
			var path = box.getAttribute("data-path");
			var on = reviewed[path] === true;
			if (on) done++;
			box.checked = on;
			box.closest("section").classList.toggle("reviewed", on);
			if (dots[path]) dots[path].innerHTML = on ? CHECK : EMPTY;
		});
		var total = boxes.length;
		var complete = total > 0 && done === total;
		block.classList.toggle("complete", complete);
		if (complete) text.innerHTML = CHECK + "All files reviewed";
		else text.textContent = done + " of " + total + " files reviewed";
		bar.style.width = (total > 0 ? (done * 100) / total : 0) + "%";
	}
	boxes.forEach(function (box) {
		box.addEventListener("change", function () {
			var path = box.getAttribute("data-path");
			var section = box.closest("section");
			var header = section.querySelector("header");
			var before = header.getBoundingClientRect().top;
			if (box.checked) reviewed[path] = true; else delete reviewed[path];
			if (box.checked) section.classList.remove("peek");
			save();
			refresh();
			var after = header.getBoundingClientRect().top;
			if (after !== before) {
				try { window.scrollBy({ top: after - before, behavior: "instant" }); }
				catch (e) { window.scrollBy(0, after - before); }
			}
		});
	});
	function applyPeek(id) {
		Array.prototype.forEach.call(document.querySelectorAll("section.file"), function (section) {
			section.classList.remove("peek");
		});
		var element = id ? document.getElementById(id) : null;
		if (!element) return null;
		if (!element.matches("section.file")) {
			var owner = element.closest("section.file.reviewed");
			if (owner) owner.classList.add("peek");
		}
		return element;
	}
	function hashId() {
		if (!location.hash) return "";
		try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ""; }
	}
	function reveal(element) {
		if (element) element.scrollIntoView({ block: "start" });
	}
	document.addEventListener("click", function (event) {
		var link = event.target && event.target.closest ? event.target.closest("a") : null;
		var href = link && link.getAttribute("href");
		if (!href || href.charAt(0) !== "#") return;
		var id;
		try { id = decodeURIComponent(href.slice(1)); } catch (e) { return; }
		var element = applyPeek(id);
		if (location.hash === "#" + id) reveal(element);
	}, true);
	window.addEventListener("hashchange", function () {
		reveal(applyPeek(hashId()));
	});
	refresh();
	reveal(applyPeek(hashId()));
	document.addEventListener("keydown", function (event) {
		if (event.key !== "j" && event.key !== "k") return;
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		var target = event.target;
		if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
		var total = document.querySelectorAll(".sidebar a.finding-link").length;
		if (total === 0) return;
		var match = /^#finding-(\\d+)$/.exec(location.hash);
		var current = match ? Number(match[1]) : -1;
		var next = event.key === "j" ? (current + 1) % total : current <= 0 ? total - 1 : current - 1;
		var nextId = "finding-" + next;
		var element = applyPeek(nextId);
		if (location.hash === "#" + nextId) reveal(element);
		else location.hash = nextId;
	});
})();
`;

export function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function findingLocation(finding: ValidatedFinding): string {
	const end = finding.endLine !== undefined && finding.endLine !== finding.line ? `-${finding.endLine}` : "";
	return `${finding.path}:${finding.line}${end}`;
}

function severityPill(severity: Severity, small = false): string {
	return `<span class="pill${small ? " sm" : ""} sev-${severity}">${SEVERITY_ICON_SVG[severity]}<span>${severity}</span></span>`;
}

function splitPath(path: string): { dir: string; base: string } {
	const at = path.lastIndexOf("/");
	return at === -1 ? { dir: "", base: path } : { dir: path.slice(0, at + 1), base: path.slice(at + 1) };
}

function statusBadge(status: FileStatus): string {
	const { letter, tone } = STATUS_BADGE[status];
	return `<span class="badge tone-${tone}" title="${STATUS_LABEL[status]}">${letter}</span>`;
}

function counts(additions: number, deletions: number): string {
	return `<span class="add-count">+${additions}</span><span class="del-count">${MINUS}${deletions}</span>`;
}

function renderCard(finding: ValidatedFinding, index: number, root: string): string {
	const link = escapeHtml(vscodeLink(root, finding.path, finding.line));
	const outside = finding.outsideChange ? `<span class="pill neutral">${OUTSIDE_CHANGE}</span>` : "";
	const openLabel = escapeHtml(`Open ${findingLocation(finding)} in VS Code`);
	return [
		`<div class="card sev-${finding.severity}" id="finding-${index}">`,
		`<div class="card-head">${severityPill(finding.severity)}<a class="loc" href="${link}">${escapeHtml(findingLocation(finding))}</a>${outside}<span class="spacer"></span><a class="btn sm" href="${link}" aria-label="${openLabel}">Open</a></div>`,
		`<div class="claim">${escapeHtml(finding.claim)}</div>`,
		`<div class="verify">${ICON.checkCircle}<div><span class="verify-label">How to verify</span><span class="verify-text">${escapeHtml(finding.check)}</span></div></div>`,
		`</div>`,
	].join("\n");
}

function statusLabel(file: ChangedFile): string {
	const label = STATUS_LABEL[file.status];
	const from = file.oldPath !== undefined && (file.status === FILE_STATUS.renamed || file.status === FILE_STATUS.copied);
	return from ? `${label} from ${file.oldPath}` : label;
}

type Row = { header: string } | { line: DiffLine };
type Placed = { finding: ValidatedFinding; index: number };

function rowKind(row: Row | undefined): string | undefined {
	return row === undefined || "header" in row ? undefined : row.line.kind;
}

function renderRow(row: Row, root: string, path: string, highlight: Severity | undefined): string {
	if ("header" in row) return `<tr class="hunk"><td colspan="4">${ICON.unfold}${escapeHtml(row.header)}</td></tr>`;
	const { line } = row;
	const hl = highlight === undefined ? "" : ` hl sev-${highlight}`;
	const oldNum = line.oldLine === undefined ? "" : String(line.oldLine);
	const newNum =
		line.newLine === undefined ? "" : `<a href="${escapeHtml(vscodeLink(root, path, line.newLine))}">${line.newLine}</a>`;
	return `<tr class="line ${line.kind}${hl}"><td class="num old">${oldNum}</td><td class="num new">${newNum}</td><td class="mark">${LINE_MARKER[line.kind]}</td><td class="code">${escapeHtml(line.text)}</td></tr>`;
}

function renderFileBody(file: ChangedFile, snapshot: Snapshot, placed: Placed[]): string {
	const { root } = snapshot;
	const diff = snapshot.diffs.get(file.path);
	const topCards: string[] = [];
	let content = "";
	if (file.binary) {
		content = `<div class="note">Binary file, not shown.</div>`;
	} else if (diff === undefined || diff.hunks.length === 0) {
		const tooLarge = file.status === FILE_STATUS.untracked && file.lineCount === undefined;
		content = `<div class="note">${tooLarge ? FILE_TOO_LARGE : "No content changes (rename or mode change)."}</div>`;
	}
	let table = "";
	if (content === "" && diff !== undefined) {
		const rows: Row[] = [];
		let shown = 0;
		let total = 0;
		let widest = 0;
		for (const hunk of diff.hunks) total += hunk.lines.length;
		for (const hunk of diff.hunks) {
			if (shown >= MAX_DIFF_LINES) break;
			rows.push({ header: hunk.header });
			for (const line of hunk.lines) {
				if (shown >= MAX_DIFF_LINES) break;
				rows.push({ line });
				widest = Math.max(widest, line.text.replace(/\t/g, " ".repeat(TAB_SIZE)).length);
				shown++;
			}
		}
		const highlight = new Map<number, Severity>();
		const cardsAfter = new Map<number, string[]>();
		for (const { finding, index } of placed) {
			const end = finding.endLine ?? finding.line;
			let matched: number[] = [];
			rows.forEach((row, at) => {
				if ("header" in row) return;
				const { newLine } = row.line;
				if (newLine === undefined || newLine < finding.line || newLine > end) return;
				matched.push(at);
			});
			// A pure deletion is anchored on the context line before it; mark the removed rows instead.
			const touchesChange = matched.some((at) => rowKind(rows[at]) !== LINE_KIND.context);
			if (!touchesChange) {
				const anchor = matched.find((at) => (rows[at] as { line: DiffLine }).line.newLine === finding.line);
				if (anchor !== undefined) {
					const removed: number[] = [];
					for (let at = anchor + 1; rowKind(rows[at]) === LINE_KIND.removed; at++) removed.push(at);
					if (removed.length > 0) matched = removed;
				}
			}
			const last = matched.length > 0 ? matched[matched.length - 1] : -1;
			for (const at of matched) if (!highlight.has(at)) highlight.set(at, finding.severity);
			const card = renderCard(finding, index, root);
			if (last === -1) {
				topCards.push(card);
				continue;
			}
			const list = cardsAfter.get(last) ?? [];
			list.push(card);
			cardsAfter.set(last, list);
		}
		const out: string[] = [];
		rows.forEach((row, at) => {
			out.push(renderRow(row, root, file.path, highlight.get(at)));
			for (const card of cardsAfter.get(at) ?? []) out.push(`<tr class="card-row"><td colspan="4">\n${card}\n</td></tr>`);
		});
		const hidden = total - shown;
		if (hidden > 0) {
			const link = escapeHtml(vscodeLink(root, file.path));
			out.push(`<tr class="more"><td colspan="4">${hidden} more lines not shown. <a href="${link}">Open in VS Code</a>.</td></tr>`);
		}
		// Fixed layout never grows past its container, so the widest line sets a minimum width for the scroller.
		const minWidth = `calc(${GUTTER_PX}px + ${widest}ch + 16px)`;
		const cols = `<colgroup><col class="c-num"><col class="c-num"><col class="c-mark"><col></colgroup>`;
		table = `<div class="diff-scroll">\n<table class="diff" style="min-width:${minWidth}">\n${cols}\n${out.join("\n")}\n</table>\n</div>`;
	} else {
		for (const { finding, index } of placed) topCards.push(renderCard(finding, index, root));
	}
	return `<div class="diff-body">\n${topCards.join("\n")}\n${content}${table}\n</div>`;
}

function renderFile(file: ChangedFile, position: number, snapshot: Snapshot, placed: Placed[]): string {
	const path = escapeHtml(file.path);
	const { dir, base } = splitPath(file.path);
	const open =
		file.status === FILE_STATUS.deleted
			? ""
			: `<a class="btn" href="${escapeHtml(vscodeLink(snapshot.root, file.path))}">${ICON.external}<span>Open in VS Code</span></a>`;
	return [
		`<section class="file" id="file-${position}" data-path="${path}">`,
		`<header>${statusBadge(file.status)}<span class="path" title="${path}"><span class="dir">${escapeHtml(dir)}</span><span class="base">${escapeHtml(base)}</span></span><span class="status-label">${escapeHtml(statusLabel(file))}</span>${counts(file.additions, file.deletions)}<span class="spacer"></span>${open}<label class="reviewed-toggle"><input type="checkbox" class="reviewed-box" data-path="${path}">${ICON.check}<span>Reviewed</span></label></header>`,
		renderFileBody(file, snapshot, placed),
		`</section>`,
	].join("\n");
}

function sideSection(title: string, count: number, body: string): string {
	return `<section class="side-section">\n<h2>${title}<span class="count">${count}</span></h2>\n${body}\n</section>`;
}

function renderSidebar(input: RenderInput, fileIndex: Map<string, number>): string {
	const { submission, validation, snapshot } = input;
	const parts: string[] = [];
	if (validation.findings.length === 0) {
		parts.push(sideSection("Findings", 0, `<p class="empty muted">${NOTHING_FLAGGED}</p>`));
	} else {
		const items = validation.findings.map(
			(finding, index) =>
				`<li><a class="finding-link" href="#finding-${index}"><span class="loc">${severityPill(finding.severity, true)}<span class="where">${escapeHtml(findingLocation(finding))}</span></span><span class="claim">${escapeHtml(finding.claim)}</span></a></li>`,
		);
		parts.push(sideSection("Findings", items.length, `<ul>\n${items.join("\n")}\n</ul>`));
	}
	if (snapshot.files.length > 0) {
		const items = snapshot.files.map((file, position) => {
			const path = escapeHtml(file.path);
			const { dir, base } = splitPath(file.path);
			const dirText = dir === "" ? "" : `<span class="dir">${escapeHtml(dir)}</span>`;
			return `<li><a class="file-link" href="#file-${position}" data-path="${path}" title="${path}">${statusBadge(file.status)}<span class="name"><span class="base">${escapeHtml(base)}</span>${dirText}</span><span class="delta">${counts(file.additions, file.deletions)}</span><span class="dot">${EMPTY_CIRCLE}</span></a></li>`;
		});
		parts.push(sideSection("Files", items.length, `<ul>\n${items.join("\n")}\n</ul>`));
	}
	if (submission.changes.length > 0) {
		const items = submission.changes.map((change) => {
			const names = change.files.map((name) => {
				const position = fileIndex.get(normalizeRepoPath(name) ?? name);
				return position === undefined ? escapeHtml(name) : `<a href="#file-${position}">${escapeHtml(name)}</a>`;
			});
			return `<li><div class="change-title">${escapeHtml(change.title)}</div><div class="change-files">${names.join(", ")}</div></li>`;
		});
		parts.push(sideSection("What changed", items.length, `<ul class="side-list">\n${items.join("\n")}\n</ul>`));
	}
	if (validation.affected.length > 0) {
		const items = validation.affected.map(
			(entry) =>
				`<li><a class="side-path" href="${escapeHtml(vscodeLink(snapshot.root, entry.path))}">${escapeHtml(entry.path)}</a><div class="reason">${escapeHtml(entry.reason)}</div></li>`,
		);
		parts.push(sideSection("Untouched but affected", items.length, `<ul class="side-list">\n${items.join("\n")}\n</ul>`));
	}
	return parts.join("\n");
}

type RenderInput = {
	submission: Submission;
	validation: Validation;
	snapshot: Snapshot;
	generatedAt: Date;
	reportId: string;
};

export function renderHtml(input: RenderInput): string {
	const { submission, validation, snapshot, generatedAt, reportId } = input;
	const fileIndex = new Map<string, number>(snapshot.files.map((file, position) => [file.path, position]));
	const byFile = new Map<string, Placed[]>();
	const others: Placed[] = [];
	validation.findings.forEach((finding, index) => {
		if (!fileIndex.has(finding.path)) {
			others.push({ finding, index });
			return;
		}
		const list = byFile.get(finding.path) ?? [];
		list.push({ finding, index });
		byFile.set(finding.path, list);
	});

	const pills = SEVERITIES.flatMap((severity) => {
		const matching = validation.findings.filter((finding) => finding.severity === severity).length;
		if (matching === 0) return [];
		const first = validation.findings.findIndex((finding) => finding.severity === severity);
		return [`<a class="pill sev-${severity}" href="#finding-${first}">${SEVERITY_ICON_SVG[severity]}<span>${matching} ${severity}</span></a>`];
	});
	if (pills.length === 0) pills.push(`<span class="pill ok">${ICON.check}<span>${NOTHING_FLAGGED}</span></span>`);
	pills.push(`<span class="pill neutral">${ICON.flask}<span>Tests: ${TESTS_LABEL[submission.tests]}</span></span>`);

	const sections = snapshot.files.map((file, position) => renderFile(file, position, snapshot, byFile.get(file.path) ?? []));
	if (others.length > 0) {
		const cards = others.map(({ finding, index }) => renderCard(finding, index, snapshot.root));
		sections.push(
			`<section class="file" id="other-files">\n<header><h2>${ICON.file}Other referenced files</h2></header>\n${cards.join("\n")}\n</section>`,
		);
	}

	const total = snapshot.files.length;
	const generated = generatedAt.toISOString();
	const generatedLocal = `${generated.slice(0, ISO_MINUTES_LENGTH).replace("T", " ")} UTC`;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review: ${escapeHtml(snapshot.repoName)} (${escapeHtml(snapshot.branch)})</title>
<style>${STYLE}</style>
</head>
<body data-report-id="${escapeHtml(reportId)}">
<header class="top">
<div class="brand"><span class="logo">${ICON.logo}</span><span>Change Review</span></div>
<div class="crumb"><span>${escapeHtml(snapshot.repoName)}</span><span class="sep">/</span>${ICON.branch}<span>${escapeHtml(snapshot.branch)}</span></div>
<div class="stats"><span class="item">${ICON.files}${total} files</span>${counts(snapshot.additions, snapshot.deletions)}</div>
<div class="progress" id="progress"><span id="progress-text">0 of ${total} files reviewed</span><div class="bar"><div id="progress-bar"></div></div></div>
</header>
<div class="layout">
<nav class="sidebar" aria-label="Review navigation">
${renderSidebar(input, fileIndex)}
</nav>
<main>
<section class="overview">
<p class="summary">${escapeHtml(submission.summary)}</p>
<div class="pills">${pills.join("\n")}</div>
</section>
${sections.join("\n")}
</main>
</div>
<footer>
<span><kbd>j</kbd> next finding <kbd>k</kbd> previous finding</span>
<span>Generated <time datetime="${escapeHtml(generated)}">${escapeHtml(generatedLocal)}</time></span>
<code>${escapeHtml(snapshot.root)}</code>
</footer>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
