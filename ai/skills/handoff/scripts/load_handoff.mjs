#!/usr/bin/env node

import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MAX_BYTES = 64 * 1024;

function findProjectRoot(start) {
  let current = resolve(start);

  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

function readBounded(path) {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(MAX_BYTES);
    const bytesRead = readSync(fd, buffer, 0, MAX_BYTES, 0);
    return buffer.toString('utf8', 0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

function main() {
  const data = JSON.parse(readFileSync(0, 'utf8'));
  const start = process.env.CLAUDE_PROJECT_DIR || data.cwd || process.cwd();
  const root = findProjectRoot(start);
  const path = join(root, 'HANDOFF.md');
  if (!existsSync(path)) return;

  const stats = statSync(path);
  const ageHours = (Date.now() - stats.mtimeMs) / 3_600_000;
  const truncated = stats.size > MAX_BYTES ? ` Only the first ${MAX_BYTES} bytes are included.` : '';
  const body = readBounded(path);
  const context =
    '[context-rollover] HANDOFF.md exists at the project root ' +
    `(last modified ${ageHours.toFixed(1)}h ago). It contains the previous session handoff.` +
    `${truncated} Read "Next Concrete Step" and continue from there. Briefly confirm ` +
    'that you resumed from HANDOFF.md and state the next step. If the first user request ' +
    'is unrelated or the handoff looks stale, say so and ask whether to delete HANDOFF.md.\n\n' +
    '----- HANDOFF.md -----\n' +
    body;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: data.hook_event_name || 'SessionStart',
        additionalContext: context,
      },
    }),
  );
}

try {
  main();
} catch {
  // A session-start hook must never block the session.
}
