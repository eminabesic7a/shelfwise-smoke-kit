// Writes a human-readable summary of a Playwright run to the GitHub job summary
// (or stdout locally) and saves reports/summary.json for the dashboard.
// Usage: node scripts/summarize-results.mjs "Smoke tests"
import fs from 'node:fs';
import { loadResults } from './lib/results.mjs';

const name = process.argv[2] || 'Playwright tests';
const r = loadResults();
const { passed, failed, flaky, skipped, durationMs } = r.stats;
const status = r.ok ? 'passed' : 'failed';
const reportUrl = process.env.REPORT_URL || '';

const lines = [
  `## ${name}: ${r.ok ? 'PASSED' : 'FAILED'}`,
  '',
  '| Passed | Failed | Flaky | Skipped | Duration |',
  '|---:|---:|---:|---:|---:|',
  `| ${passed} | ${failed} | ${flaky} | ${skipped} | ${(durationMs / 1000).toFixed(1)} s |`,
  '',
];
if (r.runError) lines.push('### Run error', '```', r.runError, '```', '');
if (r.failures.length) {
  lines.push('### Failed tests', '');
  for (const f of r.failures) {
    lines.push(`<details><summary><b>${f.title}</b> (${f.file}:${f.line})</summary>`, '', '```', f.error, '```', '</details>', '');
  }
}
if (flaky) lines.push(`> ${flaky} test(s) passed only on retry. They are not reported as failures but should be investigated.`, '');
if (reportUrl) lines.push(`[Open the HTML report](${reportUrl})`, '');
lines.push('The full HTML report, traces and screenshots are also attached to this run as the `playwright-report` artifact.');

const md = lines.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
else console.log(md);

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/summary.json', JSON.stringify({ name, status, ...r.stats, failures: r.failures.map((f) => f.title) }, null, 2));
