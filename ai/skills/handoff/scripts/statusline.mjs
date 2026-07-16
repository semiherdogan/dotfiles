#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function safeSessionId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function persistWindowSize(data) {
  const size = data.context_window?.context_window_size;
  if (!size) return;

  const names = ['claude_ctxwin_global'];
  const session = safeSessionId(data.session_id);
  if (session) names.push(`claude_ctxwin_${session}`);

  for (const name of names) {
    try {
      writeFileSync(join(tmpdir(), name), String(Math.trunc(size)));
    } catch {
      // Window persistence is best effort.
    }
  }
}

function warningThreshold() {
  const bands = (process.env.CLAUDE_ROLLOVER_WARN_BANDS || '75,85,92')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite);
  return bands.length > 0 ? Math.min(...bands) : 75;
}

function main() {
  const data = JSON.parse(readFileSync(0, 'utf8'));
  persistWindowSize(data);
  const parts = [data.model?.display_name ?? '?'];

  const cwd = data.workspace?.current_dir || data.cwd || '.';
  try {
    const branch = execFileSync('git', ['branch', '--show-current'], {
      cwd,
      timeout: 2_000,
      encoding: 'utf8',
    }).trim();
    if (branch) parts.push(`branch ${branch}`);
  } catch {
    // Skip the branch outside a Git repository.
  }

  const percentage = data.context_window?.used_percentage;
  if (percentage !== undefined && percentage !== null) {
    const rounded = Math.round(percentage);
    const threshold = warningThreshold();
    const color = rounded >= threshold ? '\x1b[31m' : rounded >= 50 ? '\x1b[33m' : '\x1b[32m';
    const cue = rounded >= threshold ? ' -> /handoff' : '';
    parts.push(`${color}ctx ${rounded}%${cue}\x1b[0m`);
  }

  process.stdout.write(`${parts.join(' | ')}\n`);
}

try {
  main();
} catch {
  process.stdout.write('statusline error\n');
}
