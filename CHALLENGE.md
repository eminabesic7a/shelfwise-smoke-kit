# Playwright challenge: Shelfwise Library

Shelfwise is a small library app. Librarians use it to keep a catalogue of books, register members, and lend books out. Your job is to build an automated test suite for it with **Playwright**.

## Getting the app running

```bash
npm install
npm run build
npm start          # http://localhost:3001
```

Or run against the deployed URL your interviewer gave you. The [README](README.md) documents every page, the API and the business rules. Treat it as the specification: if the app disagrees with it, that's a finding worth reporting.

## What to build

Add a Playwright project to this repository (TypeScript preferred, JavaScript is fine) that covers:

1. **End-to-end UI tests** for the main user journeys across the pages.
2. **API tests** using Playwright's `request` fixture for the endpoints, including validation and business-rule errors.
3. A way to run everything with a **single command**, against either a local server or a URL set by an environment variable.
4. **CI**: wire the suite into `.github/workflows/ci.yml` (there's a placeholder) so it runs on pull requests and publishes the HTML report as an artifact.
5. A short **TESTING.md**: how to run the tests, how they're organised, what you chose not to cover and why, and any bugs or spec mismatches you found.

## What we look at

- **Test design.** Which scenarios you picked, and why. Coverage of happy paths, edge cases and negative cases, weighted by risk rather than by count.
- **Reliability.** Tests are independent, can run in parallel and in any order, and don't rely on fixed waits. Hint: the app has a way to put data into a known state, and a way to slow the API down.
- **Maintainability.** Sensible structure (fixtures, page objects or another pattern you can justify), readable names, no copy-paste.
- **Locator strategy.** Robust, user-facing locators where it makes sense; consider when test ids are the better choice.
- **Assertions.** Assert on what matters to the user and to the API contract, using Playwright's web-first assertions.
- **Engineering hygiene.** Configuration, reporting, traces/screenshots on failure, and a clean commit history.

## Time box

Aim for about **4 hours**. We'd rather see a smaller suite that is well designed than a large one that is brittle. Note anything you'd do with more time in TESTING.md.

## Ground rules

- Don't change application code. If something is hard to test, say so in TESTING.md and explain what you'd change.
- Any public npm package is fine.
- Ask questions if anything is unclear. How you clarify requirements is part of the exercise.
