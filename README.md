# Shelfwise Library

A small full-stack app for running a community library: a catalogue of books, a list of members, and the loans between them. It was built as a **testing playground for a Playwright interview challenge**, so it has realistic flows (search, filters, pagination, forms with validation, confirm dialogs, toasts, business-rule errors) but no tests of its own.

| | |
|---|---|
| Backend | Node.js 20 + Express 4, in-memory data store with seed data |
| Frontend | React 18 + React Router 6, built with Vite |
| Shape | One repository, one deployable: Express serves the API under `/api` and the built React app for every other route |
| Auth | None |

## Quick start

```bash
nvm use            # Node 20 (22 also works)
npm install        # installs server + client (npm workspaces)
npm run dev        # API on :3001, UI on http://localhost:5173 (proxies /api)
```

Production mode, exactly as it runs on the hosting platform:

```bash
npm run build      # builds client/dist
npm start          # http://localhost:3001 serves UI + API
```

| Script | What it does |
|---|---|
| `npm run dev` | API with auto-restart + Vite dev server with hot reload |
| `npm run build` | Production build of the React app into `client/dist` |
| `npm start` | Starts Express; serves `client/dist` when it exists |

## Project structure

```
shelfwise/
├── server/src/
│   ├── index.js            entry point (reads PORT)
│   ├── app.js              Express app, static hosting, error handler
│   ├── routes/             books.js, members.js, loans.js
│   ├── validation.js       request validation
│   ├── store.js            in-memory store + DTO helpers
│   ├── seed.js             deterministic seed data
│   └── constants.js        genres, loan limits, etc.
├── client/src/
│   ├── pages/              one file per page
│   ├── components/         layout, toasts, dialog, pagination, badges
│   └── lib/                API client, hooks, constants
├── .github/workflows/      ci.yml, deploy.yml
├── Procfile                Heroku
├── render.yaml             Render Blueprint
└── Dockerfile              any container platform
```

## Pages

| Route | Page | Things worth testing |
|---|---|---|
| `/` | Dashboard | Bookshelf of every title (spine colour = genre, hatched = all copies out), counts, overdue list, recent loans, quick actions |
| `/books` | Book catalogue | Debounced search, genre/availability filters, sorting, pagination, delete with confirmation; all state is in the URL |
| `/books/new` and `/books/:id/edit` | Add / edit book | Client-side validation, server-side errors mapped to fields, character counter, cancel |
| `/books/:id` | Book details | Details, lend form (disabled when no copies), loan history, mark returned, delete, 404 state |
| `/members` | Members | Search, register-member form (`?new=1`), duplicate-email error, link to a member's loans |
| `/loans` | Loans | Status tabs (`?status=`), member filter (`?memberId=`), lend form (`?new=1`), mark returned |
| anything else | Not found | |

Every interactive element has a `data-testid`, and the markup uses proper labels, roles and `aria-*` attributes, so candidates can choose between role-based locators and test ids.

## API

Base path `/api`. JSON in, JSON out. Errors always look like:

```json
{ "error": "ValidationError", "message": "Validation failed", "details": { "isbn": "ISBN must contain exactly 13 digits" } }
```

`error` is one of `ValidationError` (400), `BadRequest` (400, malformed JSON), `NotFound` (404), `Conflict` (409), `InternalServerError` (500). `details` maps field names to messages and is present on validation and some conflict errors.

### Business endpoints (10)

| # | Method | Path | Description | Success |
|---|---|---|---|---|
| 1 | GET | `/books` | List books. Query: `search` (title, author or ISBN), `genre`, `available` (`true`/`false`), `sort` (`title`, `author`, `publishedYear`, `createdAt`), `order` (`asc`/`desc`), `page` (≥1), `pageSize` (1–100, default 10). Returns `{ items, total, page, pageSize, totalPages }` | 200 |
| 2 | GET | `/books/:id` | One book plus its `loans` history | 200 |
| 3 | POST | `/books` | Create a book | 201 |
| 4 | PUT | `/books/:id` | Replace a book | 200 |
| 5 | DELETE | `/books/:id` | Delete a book (and its returned loans) | 204 |
| 6 | GET | `/members` | List members, sorted by name. Query: `search` (name or email) | 200 |
| 7 | POST | `/members` | Register a member | 201 |
| 8 | GET | `/loans` | List loans, newest first. Query: `status` (`active`, `overdue`, `returned`), `memberId`, `bookId` | 200 |
| 9 | POST | `/loans` | Lend a book: `{ bookId, memberId, days? }` | 201 |
| 10 | PATCH | `/loans/:id/return` | Mark a loan returned | 200 |

### Utility endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ status, version, uptimeSeconds }`, used by health checks |
| POST | `/test/reset` | Restores the seed data. Removed when `ENABLE_TEST_API=false` |

### Payloads and validation

**Book** (`POST`/`PUT /books`)

| Field | Rule |
|---|---|
| `title` | required, ≤ 200 chars (trimmed) |
| `author` | required, ≤ 100 chars |
| `isbn` | required, exactly 13 digits; hyphens and spaces are stripped; unique (409) |
| `genre` | one of `Fiction`, `Science Fiction`, `Fantasy`, `Mystery`, `Non-Fiction`, `History`, `Science`, `Biography` |
| `publishedYear` | integer from 1000 to the current year |
| `copies` | integer 1–50; on `PUT` it cannot go below the number currently on loan (409) |
| `description` | optional, ≤ 1000 chars |

Responses add `id`, `createdAt` and the computed `availableCopies`.

**Member** (`POST /members`): `name` (2–100 chars), `email` (valid, stored lower-case, unique → 409), `membershipType` (`Standard` or `Premium`). Responses add `id`, `joinedAt`, `activeLoans`, `overdueLoans`, `loanLimit`.

**Loan** (`POST /loans`): `bookId`, `memberId` (positive integers, must exist → 404), `days` (1–30, default 14). Responses add `loanDate`, `dueDate`, `returnedAt`, `status`, `bookTitle`, `memberName`.

### Business rules

When lending, these are checked **in this order** and each fails with `409 Conflict`:

1. The member has an overdue loan.
2. The member is at their limit: **Standard 3**, **Premium 5** open loans.
3. The member already has an open loan for this book.
4. The book has no copies on the shelf.

Also: a book with open loans cannot be deleted (409); a returned loan cannot be returned again (409). Loan `status` is computed: `returned` if `returnedAt` is set, otherwise `overdue` once `dueDate` has passed, otherwise `active`.

### Seed data

Data is held in memory and resets on restart or `POST /api/test/reset`. Dates are relative to "now", so the scenarios below are always true right after a reset:

- 24 books (3 pages at the default page size), 8 members, 8 loans.
- *The Hobbit* (id 3) and *A Wizard of Earthsea* (id 22) have no copies on the shelf.
- Two overdue loans: *The Hobbit* with Bob Smith, *Dune* with David Lee. Bob and David therefore cannot borrow.
- Alice Johnson (Premium) has 2 open loans; Emma Brown, Grace Kim and Henry Novak have none.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Set automatically by hosting platforms |
| `API_DELAY_MS` | `0` | Adds latency to every `/api` request; useful for testing loading states and auto-waiting |
| `ENABLE_TEST_API` | `true` | `false` removes `POST /api/test/reset` |
| `VITE_API_BASE_URL` | empty | Build-time only. Point the UI at an API on another origin if you split the deployment |

## Deployment

The app is one Node process, so any Node host works. Because data is in memory, every deploy or restart (and every free-tier sleep) resets it to the seed state, which is convenient for a test environment.

| Platform | Cost (check current pricing) | What's in the repo |
|---|---|---|
| **Render** (recommended) | Free web service; sleeps after 15 min idle, first request then takes ~30–60 s | `render.yaml` |
| **Heroku** | No free tier; the cheapest option is an Eco dyno | `Procfile`, `engines` in `package.json` |
| **Railway** | Trial credit, then usage-based | Detected automatically as a Node app, or uses the `Dockerfile` |
| Fly.io, Koyeb, Cloud Run, Azure Container Apps… | Varies | `Dockerfile` |

### Render

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, select the repo. `render.yaml` creates the `shelfwise` web service.
3. In the service settings, copy the **Deploy Hook** URL.
4. In GitHub: **Settings → Secrets and variables → Actions**
   - Secret `RENDER_DEPLOY_HOOK_URL` = the hook URL
   - Variable `DEPLOY_TARGET` = `render`
   - Variable `APP_URL` = `https://<your-service>.onrender.com` (optional, enables the post-deploy check)

Prefer Render deploying on its own? Set `autoDeployTrigger: commit` (or `checksPass`) in `render.yaml` and skip the hook.

### Heroku

```bash
heroku create my-shelfwise
heroku authorizations:create --description "GitHub Actions"   # copy the token
```

GitHub secret `HEROKU_API_KEY` = the token; variables `HEROKU_APP_NAME` = `my-shelfwise`, `DEPLOY_TARGET` = `heroku`. Heroku's Node buildpack installs the workspaces, runs `npm run build`, then `Procfile` starts the server.

### Railway

Create a project with an empty service, generate a **project token**, then set GitHub secret `RAILWAY_TOKEN`, variable `RAILWAY_SERVICE` (service name) and `DEPLOY_TARGET` = `railway`.

### GitHub Actions

- **`ci.yml`** runs on pull requests and non-main branches: `npm ci`, build, then starts the production server and smoke-tests `/api/health`, `/api/books` and a client route. There's a commented placeholder where the Playwright step goes.
- **`deploy.yml`** runs on every push to `main`: calls `ci.yml`, then deploys to `DEPLOY_TARGET`. It can also be run manually from the Actions tab with a target picker. The deploy job uses a GitHub environment named `production`, so you can add required reviewers there if you want a manual approval gate.

### Docker

```bash
docker build -t shelfwise .
docker run -p 3000:3000 shelfwise
```

## Test-friendliness at a glance

- `POST /api/test/reset` gives every test a known starting state.
- Stable `data-testid`s on rows, inputs, buttons, toasts (`toast-success` / `toast-error`), dialog (`confirm-dialog`, `confirm-ok`, `confirm-cancel`) and field errors (`error-<field id>`).
- Rows carry `data-book-id`, `data-member-id`, `data-loan-id`.
- Dates in the UI are `YYYY-MM-DD`.
- Filters, sorting, pagination, tabs and open forms are reflected in the URL, so tests can deep-link.
- No external network requests from the UI (system fonts, no CDNs).

See **[CHALLENGE.md](CHALLENGE.md)** for the candidate brief.

## Smoke monitoring and the fix agent

This repository also contains a scheduled smoke suite that opens a GitHub issue when the app breaks, an AI agent that proposes a fix as a pull request, and a test dashboard on GitHub Pages. The implementation guide (PDF) explains every part. In short:

| File | Purpose |
|---|---|
| `playwright.config.ts`, `tests/smoke/`, `tests/e2e/` | Playwright tests; smoke tests are tagged `@smoke` and read-only |
| `.github/workflows/smoke.yml` | Daily 13:00 (Europe/Sarajevo) smoke run, also after each deploy |
| `.github/workflows/agent-fix.yml` | Claude Code fixes the incident, verifies it, opens the PR |
| `.github/workflows/token-check.yml` | Weekly check that `QA_BOT_TOKEN` is valid and not about to expire |
| `scripts/smoke-issues.mjs` | Creates, de-duplicates and closes the incident issue |
| `scripts/publish-dashboard.*` | Publishes HTML reports and the dashboard to `gh-pages` |
| `scripts/setup-github.sh` | One-time labels and variables setup |

```bash
npm run test:smoke     # smoke tests against a local build
npm test               # everything
npm run test:report    # open the last HTML report
```
