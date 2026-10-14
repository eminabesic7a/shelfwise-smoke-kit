// Adds this run's Playwright HTML report to the dashboard site (gh-pages working copy)
// and regenerates the dashboard index page.
// Usage: node scripts/publish-dashboard.mjs <siteDir> "<Workflow label>" [keepPerWorkflow]
import fs from 'node:fs';
import path from 'node:path';

const [siteDir, label = 'Tests', keepArg = '30'] = process.argv.slice(2);
const keep = Number(keepArg);
const runKey = `${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}`;
const runsDir = path.join(siteDir, 'runs');
const dest = path.join(runsDir, runKey);

fs.mkdirSync(runsDir, { recursive: true });
if (fs.existsSync('playwright-report')) fs.cpSync('playwright-report', dest, { recursive: true });
else fs.mkdirSync(dest, { recursive: true });

const summary = fs.existsSync('reports/summary.json') ? JSON.parse(fs.readFileSync('reports/summary.json', 'utf8')) : { status: 'failed' };
const meta = {
  runKey,
  workflow: label,
  status: summary.status,
  passed: summary.passed ?? 0,
  failed: summary.failed ?? 0,
  flaky: summary.flaky ?? 0,
  skipped: summary.skipped ?? 0,
  durationMs: summary.durationMs ?? 0,
  failures: summary.failures ?? [],
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local',
  sha: (process.env.GITHUB_SHA || '').slice(0, 7),
  event: process.env.GITHUB_EVENT_NAME || 'local',
  runUrl: process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : '',
  finishedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(dest, 'meta.json'), JSON.stringify(meta, null, 2));

// Collect all runs, prune the oldest per workflow, rebuild the index.
let runs = fs
  .readdirSync(runsDir)
  .map((d) => path.join(runsDir, d, 'meta.json'))
  .filter((f) => fs.existsSync(f))
  .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
  .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

const seen = {};
runs = runs.filter((r) => {
  seen[r.workflow] = (seen[r.workflow] || 0) + 1;
  if (seen[r.workflow] > keep) {
    fs.rmSync(path.join(runsDir, r.runKey), { recursive: true, force: true });
    return false;
  }
  return true;
});

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const when = (iso) => iso.replace('T', ' ').slice(0, 16) + ' UTC';
const workflows = [...new Set(runs.map((r) => r.workflow))].sort();

const latestCards = workflows
  .map((w) => {
    const list = runs.filter((r) => r.workflow === w);
    const last = list[0];
    const passRate = Math.round((100 * list.filter((r) => r.status === 'passed').length) / list.length);
    const strip = list.slice(0, 20).reverse()
      .map((r) => `<a class="tick ${r.status}" href="runs/${r.runKey}/index.html" title="${esc(when(r.finishedAt))}: ${r.status}"></a>`)
      .join('');
    return `<section class="card ${last.status}">
  <h2>${esc(w)}</h2>
  <p class="state">${last.status === 'passed' ? 'Passing' : 'Failing'}</p>
  <p class="meta">Last run ${esc(when(last.finishedAt))} on <code>${esc(last.branch)}</code>. ${last.passed} passed, ${last.failed} failed, ${last.flaky} flaky.</p>
  <p class="meta">${passRate}% of the last ${list.length} runs passed.</p>
  <div class="strip" aria-label="Recent runs, oldest first">${strip}</div>
  <p><a href="runs/${last.runKey}/index.html">Open latest report</a></p>
</section>`;
  })
  .join('\n');

const rows = runs
  .map((r) => `<tr class="${r.status}">
  <td>${esc(when(r.finishedAt))}</td><td>${esc(r.workflow)}</td>
  <td><span class="badge ${r.status}">${r.status}</span></td>
  <td>${r.passed}</td><td>${r.failed}</td><td>${r.flaky}</td><td>${(r.durationMs / 1000).toFixed(0)} s</td>
  <td><code>${esc(r.branch)}</code> <code>${esc(r.sha)}</code></td>
  <td>${r.failures.length ? esc(r.failures.slice(0, 3).join('; ')) + (r.failures.length > 3 ? '…' : '') : ''}</td>
  <td><a href="runs/${r.runKey}/index.html">Report</a>${r.runUrl ? ` <a href="${esc(r.runUrl)}">Run</a>` : ''}</td>
</tr>`)
  .join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shelfwise test dashboard</title>
<style>
:root{--ink:#1c2a25;--muted:#5b6863;--line:#d6dcd4;--ok:#2f7a52;--bad:#a3302a;--bg:#f3f5f1}
body{margin:0;font:15px/1.5 system-ui,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:1200px;margin:0 auto;padding:28px 20px}
h1{font:600 1.8rem Georgia,serif;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 24px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:28px}
.card{background:#fff;border:1px solid var(--line);border-top:5px solid var(--ok);border-radius:6px;padding:16px 18px}
.card.failed{border-top-color:var(--bad)}.card h2{margin:0;font-size:1.1rem}
.state{font:600 1.5rem Georgia,serif;margin:4px 0}.card.failed .state{color:var(--bad)}.card.passed .state{color:var(--ok)}
.meta{color:var(--muted);margin:2px 0}.strip{display:flex;gap:3px;margin:10px 0}
.tick{width:12px;height:22px;border-radius:2px;background:var(--ok)}.tick.failed{background:var(--bad)}
.wrap{overflow-x:auto;background:#fff;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%}th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:.85rem;color:var(--muted)}.badge{padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:600}
.badge.passed{background:#e5f0ea;color:var(--ok)}.badge.failed{background:#f8e9e7;color:var(--bad)}
code{font-size:.85em}a{color:#1f4a3c}
</style></head>
<body><main>
<h1>Shelfwise test dashboard</h1>
<p class="sub">Updated ${esc(when(new Date().toISOString()))}. Keeps the last ${keep} runs of each workflow.</p>
<div class="cards">${latestCards}</div>
<h2>Run history</h2>
<div class="wrap"><table>
<thead><tr><th>Finished</th><th>Workflow</th><th>Status</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Time</th><th>Branch / commit</th><th>Failing tests</th><th></th></tr></thead>
<tbody>${rows}</tbody></table></div>
</main></body></html>`;

fs.writeFileSync(path.join(siteDir, 'index.html'), html);
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');
console.log(`Dashboard updated: ${runs.length} run(s), this run at runs/${runKey}/`);
