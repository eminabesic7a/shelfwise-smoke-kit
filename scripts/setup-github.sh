#!/usr/bin/env bash
# One-time repository setup. Run locally with the GitHub CLI, logged in as a repo admin:
#   QA_BOT_LOGIN=senior-dev FIX_REVIEWER=lead-dev ./scripts/setup-github.sh
set -euo pipefail
: "${QA_BOT_LOGIN:?Set QA_BOT_LOGIN to the GitHub username that owns the token}"
: "${FIX_REVIEWER:?Set FIX_REVIEWER to the GitHub username who reviews agent PRs}"

if [ "${QA_BOT_LOGIN,,}" = "${FIX_REVIEWER,,}" ]; then
  echo "QA_BOT_LOGIN and FIX_REVIEWER must be different people: GitHub does not let a PR author review their own PR." >&2
  exit 1
fi

gh label create smoke-failure   --color B60205 --description "Scheduled smoke tests are failing" --force
gh label create agent:fix       --color 5319E7 --description "Fix agent should attempt a fix" --force
gh label create agent:pr-open   --color 0E8A16 --description "Fix agent opened a pull request" --force
gh label create agent:failed    --color D93F0B --description "Fix agent could not produce a verified fix" --force
gh label create agent-generated --color C5DEF5 --description "Pull request written by the fix agent" --force
gh label create token-expiry    --color FBCA04 --description "QA bot token needs rotating" --force

gh variable set QA_BOT_LOGIN --body "$QA_BOT_LOGIN"
gh variable set FIX_REVIEWER --body "$FIX_REVIEWER"
gh variable set AGENT_AUTOFIX --body "true"

echo
echo "Labels and variables are set. Now the token owner adds the secret (prompted for the value):"
echo "  gh secret set QA_BOT_TOKEN"
echo "The fix agent runs a free model with Ollama inside the workflow, so no AI API key is needed."
echo "Optional variables: SMOKE_BASE_URL (deployed app URL), DASHBOARD_URL (GitHub Pages URL),"
echo "  FIX_MODEL (Ollama model name, default qwen2.5-coder:3b)"
