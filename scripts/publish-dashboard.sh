#!/usr/bin/env bash
# Publishes this run's report to the gh-pages branch, which GitHub Pages serves as the dashboard.
# The branch is kept as a single commit (no history bloat) and --force-with-lease plus a retry
# loop makes concurrent CI and smoke runs safe.
# Usage: scripts/publish-dashboard.sh "<Workflow label>"   (needs GITHUB_TOKEN with contents: write)
set -euo pipefail
LABEL="${1:-Tests}"
URL="${DASHBOARD_REMOTE:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

for attempt in 1 2 3 4 5; do
  rm -rf site
  if git ls-remote --exit-code --heads "$URL" gh-pages >/dev/null 2>&1; then
    git clone -q --depth 1 --branch gh-pages "$URL" site
    LEASE="gh-pages:$(git -C site rev-parse HEAD)"
  else
    git init -q -b gh-pages site
    git -C site remote add origin "$URL"
    LEASE="gh-pages:"
  fi

  node scripts/publish-dashboard.mjs site "$LABEL" 30

  git -C site checkout -q --orphan publish
  git -C site add -A
  git -C site -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -qm "Dashboard: ${LABEL} run ${GITHUB_RUN_ID:-local}"

  if git -C site push -q --force-with-lease="$LEASE" origin HEAD:gh-pages; then
    echo "Published dashboard (attempt $attempt)"
    exit 0
  fi
  echo "gh-pages changed while publishing, retrying..."
  sleep $((attempt * 3))
done
echo "::warning::Could not publish the dashboard after 5 attempts"
exit 1
