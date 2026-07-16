#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TAIL_BYTES = 512 * 1024;

function safeSessionId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function resolveWindow(session) {
  for (const name of [`claude_ctxwin_${session}`, 'claude_ctxwin_global']) {
    try {
      const size = Number.parseInt(readFileSync(join(tmpdir(), name), 'utf8').trim(), 10);
      if (size > 0) return size;
    } catch {
      // Try the next state file.
    }
  }

  return Number.parseInt(process.env.CLAUDE_CONTEXT_WINDOW || '1000000', 10);
}

function readTranscriptTail(path) {
  const size = statSync(path).size;
  if (size <= TAIL_BYTES) return readFileSync(path, 'utf8');

  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(TAIL_BYTES);
    readSync(fd, buffer, 0, TAIL_BYTES, size - TAIL_BYTES);
    const text = buffer.toString('utf8');
    const firstNewline = text.indexOf('\n');
    return firstNewline === -1 ? '' : text.slice(firstNewline + 1);
  } finally {
    closeSync(fd);
  }
}

function lastContextTokens(path) {
  const lines = readTranscriptTail(path).split('\n');

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index]) continue;

    let entry;
    try {
      entry = JSON.parse(lines[index]);
    } catch {
      continue;
    }

    if (entry.type !== 'assistant' || entry.isSidechain) continue;
    const usage = entry.message?.usage || {};
    if (!Object.hasOwn(usage, 'input_tokens')) continue;

    return (
      (usage.input_tokens || 0) +
      (usage.cache_read_input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0) +
      (usage.output_tokens || 0)
    );
  }

  return null;
}

function main() {
  const bands = (process.env.CLAUDE_ROLLOVER_WARN_BANDS || '75,85,92')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (bands.length === 0) return;

  const data = JSON.parse(readFileSync(0, 'utf8'));
  const transcriptPath = data.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) return;

  const tokens = lastContextTokens(transcriptPath);
  if (tokens === null) return;

  const session = safeSessionId(data.session_id);
  const window = resolveWindow(session);
  if (!Number.isFinite(window) || window <= 0) return;

  const percentage = Math.floor((tokens * 100) / window);
  const matched = bands.filter((band) => percentage >= band);
  if (matched.length === 0) return;

  const band = Math.max(...matched);
  const statePath = join(tmpdir(), `claude_rollover_${session}`);
  let warned = 0;
  try {
    warned = Number.parseInt(readFileSync(statePath, 'utf8').trim(), 10) || 0;
  } catch {
    warned = 0;
  }
  if (band <= warned) return;
  writeFileSync(statePath, String(band));

  const format = (value) => value.toLocaleString('en-US');
  const message =
    `Context at ~${percentage}% (${format(tokens)}/${format(window)} tokens). ` +
    'Rollover recommended: run /handoff, then /clear.';
  const context =
    `[context-rollover] Context usage is at ~${percentage}% of the window. ` +
    'Finish the current atomic step without leaving the working tree broken, then tell ' +
    'the user it is time to roll over and offer to run /handoff. Do not suggest /compact.';

  process.stdout.write(
    JSON.stringify({
      systemMessage: `Warning: ${message}`,
      hookSpecificOutput: {
        hookEventName: data.hook_event_name || 'UserPromptSubmit',
        additionalContext: context,
      },
    }),
  );
}

try {
  main();
} catch {
  // A monitoring hook must never block the session.
}
