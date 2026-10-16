# Fix agent with Ollama (free, runs inside GitHub Actions)

Copy these files over the kit, keeping the same paths. Nothing else in the kit changes.

| File | Change |
|---|---|
| `scripts/model-fix.mjs` | **New.** Asks a small open model (served by Ollama on the runner) for a find/replace fix, applies it, re-runs the smoke tests, retries once, writes `agent-summary.md` |
| `.github/workflows/agent-fix.yml` | Claude Code replaced by: install Ollama, cache and load the model, run `scripts/model-fix.mjs`. No AI API key |
| `.github/agent/fix-prompt.md` | Short rules for the model (its system prompt) |
| `scripts/setup-github.sh` | Final hints no longer mention an AI API key |
| `demo-bug.patch` | The demo bug: the line that loads the books is commented out, so GET /api/books returns an empty list |

## Setup changes

- Delete the `ANTHROPIC_API_KEY` secret (and `MODELS_TOKEN`, if you added it). They are not used.
- Optional variable `FIX_MODEL`: any model name from ollama.com/library. Default `qwen2.5-coder:3b`
  (about 2 GB). `qwen2.5-coder:7b` is stronger but slower; `qwen2.5-coder:1.5b` is faster but weaker.
- Everything else stays: `QA_BOT_TOKEN`, `QA_BOT_LOGIN`, `FIX_REVIEWER`, `AGENT_AUTOFIX`.

## How the fixer behaves

| Situation | Result |
|---|---|
| Correct edit | Applied, smoke tests pass, PR opened |
| "find" text with wrong indentation | Matched line by line; the file's own indentation is kept |
| "find" text not in the file | Model asked again with the reason (counts as an attempt) |
| Edit applied but tests still fail | Change reverted, model asked again with the new errors |
| Model names a file that does not exist | Falls back to files named in the failures, e.g. `books.js` |
| 2 attempts fail | Code untouched; issue gets `agent:failed` and is assigned to the reviewer |
| Model not downloaded / wrong name | Run stops with a hint about `FIX_MODEL` |

The model never sees the issue text, only test output and source files, and nothing leaves the runner.

## What was tested

Against the real Shelfwise app with a simulated Ollama server that streams replies like Ollama does:
exact edit, edit with wrong indentation and other small-model quirks, bad edit then good edit,
wrong edit (reverted and handed over), missing model (HTTP 404) and the file-choice fallback.
The workflow passes `actionlint` 1.7.12. Ollama models could not be downloaded in the test
environment, so the model's real answer is first seen in your repository during the demo.
