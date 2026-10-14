// Turns a smoke-test run into GitHub issue activity, with de-duplication:
//   * failures and no open incident  -> create ONE incident issue (labels: smoke-failure [+ agent:fix])
//   * failures and an open incident  -> add a "still failing" comment to it (no new issue, no new agent run)
//   * all green and an open incident -> comment and close it
//
// One incident per outage, not one issue per failing test: a single broken API usually fails
// several smoke tests, and we want exactly one issue, one agent run and one pull request.
//
// Env: GH_TOKEN (the senior engineer's PAT), GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SERVER_URL,
//      REPORT_URL, TARGET_URL, AGENT_AUTOFIX ("false" disables the agent label), DRY_RUN=1 to only print.
import { loadResults, fingerprintOf } from './lib/results.mjs';

const LABEL = 'smoke-failure';
const AGENT_LABEL = 'agent:fix';
const MARKER = '<!-- smoke-incident -->';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
const dryRun = process.env.DRY_RUN === '1';
const runUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const reportUrl = process.env.REPORT_URL || runUrl;
const target = process.env.TARGET_URL || 'a locally built copy of the default branch';
const today = new Date().toISOString().slice(0, 10);

async function gh(method, path, body) {
  if (dryRun) {
    console.log(`[dry-run] ${method} ${path}`);
    if (body) console.log(JSON.stringify(body, null, 2));
    return method === 'GET' ? [] : {};
  }
  const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const hint = res.status === 401
      ? ' The QA_BOT_TOKEN secret is missing, wrong or expired. Ask the token owner to rotate it.'
      : res.status === 403 || res.status === 404
        ? ' The token probably lacks "Issues: Read and write" access to this repository.'
        : '';
    throw new Error(`GitHub API ${method} ${path} failed with ${res.status}.${hint}\n${text}`);
  }
  return res.status === 204 ? null : res.json();
}

function failureTable(failures) {
  return [
    '| # | Test | Location |',
    '|---|---|---|',
    ...failures.map((f, i) => `| ${i + 1} | ${f.title} | \`${f.file}:${f.line}\` |`),
  ].join('\n');
}

function issueBody(r) {
  const details = r.failures
    .map((f, i) => [`### ${i + 1}. ${f.title}`, `File: \`${f.file}:${f.line}\``, '', '```text', f.error, '```'].join('\n'))
    .join('\n\n');
  return [
    MARKER,
    `<!-- fingerprint: ${fingerprintOf(r.failures)} -->`,
    '## Summary',
    `The scheduled smoke run on ${today} found **${r.failures.length} failing test(s)** against ${target}.`,
    '',
    r.failures.length ? failureTable(r.failures) : '',
    r.runError ? ['', '### Run error', '```text', r.runError, '```'].join('\n') : '',
    '',
    '## Failure details',
    details || '_No per-test details: the run failed before tests could execute._',
    '',
    '## Reproduce locally',
    '```bash',
    'npm ci && npx playwright install chromium',
    'npx playwright test --grep @smoke',
    '```',
    '',
    '## Links',
    `- Workflow run: ${runUrl}`,
    `- HTML report (screenshots, traces): ${reportUrl}`,
    '',
    '## Notes for whoever fixes this',
    '- The failing tests describe the expected behaviour. Fix the application, not the tests.',
    '- This issue stays open until a smoke run passes or the fixing PR is merged. Further failures are added as comments.',
  ].join('\n');
}

async function main() {
  const r = loadResults();
  const failing = !r.ok;
  console.log(`Smoke result: ${failing ? 'FAILED' : 'passed'} (${r.failures.length} failing test(s))`);

  const open = (await gh('GET', `/repos/${repo}/issues?state=open&labels=${LABEL}&per_page=100`))
    .filter((i) => !i.pull_request && (i.body || '').includes(MARKER));
  const incident = open[0];

  if (!failing) {
    if (incident) {
      await gh('POST', `/repos/${repo}/issues/${incident.number}/comments`, {
        body: `All smoke tests passed in [run ${process.env.GITHUB_RUN_ID}](${runUrl}). Closing this incident.`,
      });
      await gh('PATCH', `/repos/${repo}/issues/${incident.number}`, { state: 'closed', state_reason: 'completed' });
      console.log(`Closed incident #${incident.number}`);
    }
    return;
  }

  if (incident) {
    const previous = (incident.body.match(/<!-- fingerprint: (.*?) -->/) || [])[1] || '';
    const changed = previous !== fingerprintOf(r.failures);
    await gh('POST', `/repos/${repo}/issues/${incident.number}/comments`, {
      body: [
        `Still failing in [run ${process.env.GITHUB_RUN_ID}](${runUrl}) on ${today}. [HTML report](${reportUrl})`,
        changed ? '\n**The set of failing tests has changed since this issue was opened:**\n' : '',
        changed ? failureTable(r.failures) : '',
      ].join('\n'),
    });
    console.log(`Incident #${incident.number} already open: added a comment instead of a new issue`);
    return;
  }

  const labels = [LABEL];
  if (process.env.AGENT_AUTOFIX !== 'false') labels.push(AGENT_LABEL);
  const created = await gh('POST', `/repos/${repo}/issues`, {
    title: `Smoke tests failing: ${r.failures.length || 'run'} failure(s) since ${today}`,
    body: issueBody(r),
    labels,
  });
  console.log(`Created incident #${created.number ?? '(dry run)'}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
