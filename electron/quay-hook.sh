#!/bin/bash
# Quay terminal multiplexer — Claude Code hook relay
# Posts hook events to Quay's local HTTP server for real-time status detection
if [ -z "$QUAY_HOOK_PORT" ] || [ -z "$QUAY_PANE_ID" ]; then
  exit 0
fi
INPUT=$(cat)
curl -s -X POST "http://127.0.0.1:${QUAY_HOOK_PORT}/hook" \
  -H "Content-Type: application/json" \
  -d "{\"pane_id\":\"${QUAY_PANE_ID}\",\"event\":${INPUT}}" \
  > /dev/null 2>&1 || true
