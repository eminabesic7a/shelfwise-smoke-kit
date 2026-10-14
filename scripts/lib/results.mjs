// Reads Playwright's JSON report (reports/results.json) into a flat, easy-to-use shape.
import fs from 'node:fs';

const ANSI = /\u001b\[[0-9;]*m/g;
const clean = (s = '') => String(s).replace(ANSI, '').trim();

export function loadResults(file = 'reports/results.json') {
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      runError: `No test results found at ${file}. The test run probably crashed before any test ran (for example the app failed to build or start).`,
      stats: { passed: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0 },
      failures: [],
      passedIds: [],
      flakyIds: [],
    };
  }

  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const failures = [];
  const passedIds = [];
  const flakyIds = [];

  const walk = (suite, path) => {
    const here = suite.title && !suite.title.endsWith('.ts') && !suite.title.endsWith('.js') ? [...path, suite.title] : path;
    for (const spec of suite.specs || []) {
      const fullTitle = [...here, spec.title].join(' › ');
      const id = `${spec.file}::${fullTitle}`;
      for (const t of spec.tests || []) {
        if (t.status === 'unexpected') {
          const last = t.results[t.results.length - 1] || {};
          const err = last.error || (last.errors || [])[0] || {};
          failures.push({
            id,
            title: fullTitle,
            file: `tests/${spec.file}`, // spec.file is relative to testDir ('./tests')
            line: spec.line,
            error: clean(err.message || 'No error message').slice(0, 2500),
            attempts: t.results.length,
          });
        } else if (t.status === 'flaky') {
          flakyIds.push(id);
          passedIds.push(id);
        } else if (t.status === 'expected') {
          passedIds.push(id);
        }
      }
    }
    for (const child of suite.suites || []) walk(child, here);
  };
  for (const s of report.suites || []) walk(s, []);

  const s = report.stats || {};
  const globalErrors = (report.errors || []).map((e) => clean(e.message)).filter(Boolean);

  return {
    ok: failures.length === 0 && globalErrors.length === 0,
    runError: globalErrors.length ? globalErrors.join('\n\n').slice(0, 2500) : null,
    stats: {
      passed: s.expected || 0,
      failed: s.unexpected || 0,
      flaky: s.flaky || 0,
      skipped: s.skipped || 0,
      durationMs: Math.round(s.duration || 0),
    },
    failures,
    passedIds,
    flakyIds,
  };
}

export const fingerprintOf = (failures) => failures.map((f) => f.id).sort().join('|');
