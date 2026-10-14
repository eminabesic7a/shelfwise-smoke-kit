#!/usr/bin/env bash
# Rejects agent changes outside application code. The agent must fix the app, never the
# tests, workflows, scripts or dependencies that judge it.
set -euo pipefail
ALLOWED='^(server|client)/'

CHANGED=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u )
if [ -z "$CHANGED" ]; then
  echo "::error::The agent made no changes."
  exit 1
fi

echo "Files changed by the agent:"; echo "$CHANGED" | sed 's/^/  /'
BAD=$(echo "$CHANGED" | grep -Ev "$ALLOWED" || true)
if [ -n "$BAD" ]; then
  echo "::error::The agent changed files outside server/ and client/:"
  echo "$BAD" | sed 's/^/  /'
  exit 1
fi
echo "Guard passed: only application code changed."
