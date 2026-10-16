// Proposes a fix for failing smoke tests using a small open model served by Ollama
// inside the GitHub Actions job. Free: no account, no API key, the code never leaves the runner.
//
// A model on its own cannot browse the repo or run commands, so this script does that part:
//   1. runs the smoke tests to get the current failures
//   2. asks the model which application files most likely contain the bug
//   3. sends those files with the failures and asks for a find/replace edit
//   4. applies the edit and re-runs the smoke tests; if they still fail, reverts and tries again
//
// The model never sees the issue text, only test output and source code, so instructions
// written into an issue cannot steer it.
//
// Env: OLLAMA_URL (default http://localhost:11434), FIX_MODEL (default qwen2.5-coder:3b),
//      FIX_ATTEMPTS (default 2), FIX_CONTEXT (context window in tokens, default 8192).
// Exit code 0 = smoke tests pass after the edit, 1 = no verified fix.
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { loadResults } from './lib/results.mjs';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const MODEL = process.env.FIX_MODEL || 'qwen2.5-coder:3b';
const MAX_ATTEMPTS = Number(process.env.FIX_ATTEMPTS || 2);
const CONTEXT = Number(process.env.FIX_CONTEXT || 8192);
const ALLOWED = /^(server|client)\//;
const MAX_FILE_CHARS = 8000; // keeps prompts well inside the context window
const RULES = fs.readFileSync('.github/agent/fix-prompt.md', 'utf8');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issue = fs.existsSync('agent-issue.json') ? JSON.parse(fs.readFileSync('agent-issue.json', 'utf8')) : {};

function parseJson(text) {
  const cleaned = text.replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The model did not reply with JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Streams the reply so that slow generation on a CPU never hits an HTTP timeout.
async function ask(userContent, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try {
      res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          format: 'json',
          options: { temperature: 0, num_ctx: CONTEXT, num_predict: 1024 },
          messages: [
            { role: 'system', content: RULES },
            { role: 'user', content: userContent },
          ],
        }),
      });
    } catch (err) {
      const reason = err.cause?.message || err.message;
      if (attempt < 3) {
        console.log(`Cannot reach Ollama (${reason}), retrying...`);
        await sleep(3000);
        continue;
      }
      throw new Error(`Could not reach Ollama at ${OLLAMA_URL}: ${reason}. Check the "Start Ollama" step log.`);
    }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 400);
      const hint = res.status === 404 ? ` Model "${MODEL}" is not available: check the FIX_MODEL variable and the "Start Ollama" step.` : '';
      throw new Error(`Ollama returned HTTP ${res.status} (${label}).${hint}\n${body}`);
    }

    let text = '';
    let buffer = '';
    const decoder = new TextDecoder();
    const started = Date.now();
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const part = JSON.parse(line);
        if (part.error) throw new Error(`Ollama error (${label}): ${part.error}`);
        text += part.message?.content || '';
      }
    }
    if (buffer.trim()) text += JSON.parse(buffer).message?.content || '';
    console.log(`\n----- model reply: ${label} (${Math.round((Date.now() - started) / 1000)} s) -----\n${text}\n-----\n`);
    return parseJson(text);
  }
  throw new Error('Ollama did not answer.');
}

function runSmoke() {
  // playwright.config.ts already writes reports/results.json
  spawnSync('npx', ['playwright', 'test', '--grep', '@smoke'], { stdio: 'inherit' });
  return loadResults();
}

const failureText = (r) =>
  r.failures.map((f) => `- ${f.title} (${f.file}:${f.line})\n${f.error.slice(0, 600)}`).join('\n\n') || r.runError || '';

function testSources(r) {
  const files = [...new Set(r.failures.map((f) => f.file))];
  return files.map((f) => `=== ${f} ===\n${fs.readFileSync(f, 'utf8').slice(0, 3000)}`).join('\n\n');
}

function sourceFiles() {
  return execSync('git ls-files server client', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(js|jsx|mjs|cjs|ts|tsx|css|html)$/.test(f) && !f.includes('/dist/'));
}

// Finds `find` in `content`: exactly first, then line by line ignoring indentation
// (small models often get whitespace wrong). Returns the range to replace.
function locate(content, find) {
  const exact = content.split(find).length - 1;
  if (exact === 1) {
    const start = content.indexOf(find);
    return { start, end: start + find.length, indent: null };
  }
  if (exact > 1) throw new Error(`matched ${exact} times; include more of the surrounding code so it is unique`);

  const want = find.split('\n').map((l) => l.trim()).filter(Boolean);
  if (want.length === 0) throw new Error('was empty');
  const lines = content.split('\n');
  const hits = [];
  for (let i = 0; i + want.length <= lines.length; i++) {
    if (want.every((w, n) => lines[i + n].trim() === w)) hits.push(i);
  }
  if (hits.length !== 1) {
    throw new Error(`matched ${hits.length} times; copy one to a few lines exactly from the file`);
  }
  const first = hits[0];
  const last = first + want.length - 1;
  const start = lines.slice(0, first).reduce((n, l) => n + l.length + 1, 0);
  const end = start + lines.slice(first, last + 1).join('\n').length;
  return { start, end, indent: lines[first].match(/^\s*/)[0] };
}

function reindent(text, indent) {
  const lines = text.split('\n');
  const widths = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
  const min = widths.length ? Math.min(...widths) : 0;
  return lines.map((l) => (l.trim() ? indent + l.slice(min) : '')).join('\n');
}

function applyEdits(edits) {
  if (edits && !Array.isArray(edits)) edits = [edits];
  if (!edits || edits.length === 0) throw new Error('The reply contained no edits.');
  const changed = new Set();
  for (const e of edits) {
    const file = (e.file || '').replace(/^\.\//, '');
    if (!ALLOWED.test(file)) throw new Error(`Edit to "${file}" refused: only server/ and client/ may change.`);
    if (!fs.existsSync(file)) throw new Error(`Edit refused: "${file}" does not exist.`);
    const content = fs.readFileSync(file, 'utf8');
    let range;
    try {
      range = locate(content, e.find || '');
    } catch (err) {
      throw new Error(`The "find" text for ${file} ${err.message}.`);
    }
    const replacement = range.indent === null ? e.replace ?? '' : reindent(e.replace ?? '', range.indent);
    fs.writeFileSync(file, content.slice(0, range.start) + replacement + content.slice(range.end));
    changed.add(file);
  }
  return [...changed];
}

function writeSummary(lines) {
  fs.writeFileSync('agent-summary.md', lines.filter((l) => l !== null).join('\n') + '\n');
}

async function main() {
  console.log(`Using ${MODEL} on Ollama at ${OLLAMA_URL}`);
  const before = runSmoke();
  if (before.ok) {
    writeSummary(['**No fix needed:** all smoke tests already pass on this branch, so the incident may be resolved or environment-specific.']);
    console.log('Smoke tests already pass; nothing to fix.');
    process.exit(1);
  }

  const files = sourceFiles();
  const failures = failureText(before);

  // Step 1: which files to look at.
  const pick = await ask(
    [
      'These smoke tests fail:',
      failures,
      '',
      'Test code:',
      testSources(before),
      '',
      'Application source files:',
      files.join('\n'),
      '',
      'Reply with JSON only: {"files": ["up to 2 paths from the list above, most likely to contain the bug"]}',
    ].join('\n'),
    'choose files',
  );
  let chosen = [].concat(pick.files || []).filter((f) => files.includes(f)).slice(0, 2);
  if (chosen.length === 0) {
    // Fallback: files whose name appears in the failures, e.g. "books" -> server/src/routes/books.js
    const text = failures.toLowerCase();
    const stem = (f) => path.basename(f).replace(/\.\w+$/, '').toLowerCase();
    chosen = files
      .filter((f) => stem(f).length > 3 && text.includes(stem(f)))
      .sort((a, b) => stem(b).length - stem(a).length) // prefer specific names like "books" over "api"
      .slice(0, 2);
  }
  if (chosen.length === 0) throw new Error('No application file could be chosen to fix.');
  console.log(`Looking at: ${chosen.join(', ')}`);

  // Step 2: ask for an edit, verify it, retry with feedback.
  let feedback = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const fileBlocks = chosen.map((f) => `=== ${f} ===\n${fs.readFileSync(f, 'utf8').slice(0, MAX_FILE_CHARS)}`).join('\n\n');
    // Errors talking to Ollama stop the run; only bad edits are retried.
    const fix = await ask(
      [
        'These smoke tests fail:',
        failures,
        '',
        'Relevant application files:',
        fileBlocks,
        '',
        feedback ? `Your previous attempt did not work:\n${feedback}\n` : '',
        'Reply with JSON only:',
        '{"root_cause": "file, line and a one-sentence explanation",',
        ' "edits": [{"file": "path", "find": "exact text copied from the file", "replace": "new text"}],',
        ' "summary": "what you changed and why, in 1-3 sentences"}',
      ].join('\n'),
      `fix, attempt ${attempt}`,
    );
    try {
      const changed = applyEdits(fix.edits);
      console.log(`Applied edit to: ${changed.join(', ')}. Re-running smoke tests...`);
    } catch (err) {
      console.log(`Attempt ${attempt} could not be applied: ${err.message}`);
      feedback = err.message;
      execSync('git checkout -- server client');
      continue;
    }

    const after = runSmoke();
    if (after.ok) {
      const diff = execSync('git diff -- server client', { encoding: 'utf8' });
      writeSummary([
        `**Root cause:** ${fix.root_cause || 'not given'}`,
        '',
        `**Fix:** ${fix.summary || 'see diff'}`,
        '',
        '```diff',
        diff.trim(),
        '```',
        '',
        `**Verification:** all smoke tests pass after the change (attempt ${attempt} of ${MAX_ATTEMPTS}).`,
        '',
        `**Model:** \`${MODEL}\` running on Ollama inside the workflow. ${issue.url ? `Incident: ${issue.url}` : ''}`,
        '',
        '**For the reviewer:** this change was written by a small AI model. Check that it restores intended behaviour and does not just hide the symptom.',
      ]);
      console.log('Smoke tests pass. Fix found.');
      return;
    }
    feedback = `Smoke tests still fail after your edit:\n${failureText(after)}`;
    console.log(`Attempt ${attempt} did not fix the tests; reverting.`);
    execSync('git checkout -- server client');
  }

  writeSummary([
    `**No verified fix after ${MAX_ATTEMPTS} attempt(s)** with \`${MODEL}\`. A person needs to take over.`,
    '',
    '**Last problem:**',
    '```text',
    feedback.slice(0, 2000),
    '```',
  ]);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  writeSummary([`**The fixer stopped with an error:** ${err.message}`]);
  process.exit(1);
});
