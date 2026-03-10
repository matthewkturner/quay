#!/bin/bash
# Quay terminal multiplexer — Claude Code hook relay
# Posts hook events to Quay's local HTTP server for real-time status detection
QUAY_DIR="$HOME/.quay"

# Resolve hook port: env var (legacy) or file
PORT="${QUAY_HOOK_PORT:-}"
if [ -z "$PORT" ] && [ -f "$QUAY_DIR/hook-port" ]; then
  PORT=$(cat "$QUAY_DIR/hook-port")
fi
[ -z "$PORT" ] && exit 0

# Resolve pane ID: env var (legacy), cached result, or walk PID tree
PANE_ID="${QUAY_PANE_ID:-}"
CACHE_FILE="$QUAY_DIR/cache-$$"
if [ -z "$PANE_ID" ] && [ -f "$CACHE_FILE" ]; then
  PANE_ID=$(cat "$CACHE_FILE")
fi
if [ -z "$PANE_ID" ] && [ -d "$QUAY_DIR/panes" ]; then
  PID=$$
  while [ "$PID" != "1" ] && [ -n "$PID" ] && [ "$PID" != "0" ]; do
    if [ -f "$QUAY_DIR/panes/$PID" ]; then
      PANE_ID=$(cat "$QUAY_DIR/panes/$PID")
      echo -n "$PANE_ID" > "$CACHE_FILE" 2>/dev/null
      break
    fi
    if [ -f "/proc/$PID/status" ]; then
      PID=$(awk '/^PPid:/{print $2}' "/proc/$PID/status" 2>/dev/null)
    elif command -v ps >/dev/null 2>&1; then
      PID=$(ps -p "$PID" -o ppid= 2>/dev/null | tr -d ' ')
    else
      break
    fi
  done
fi
[ -z "$PANE_ID" ] && exit 0

INPUT=$(cat)
curl -s -m 3 -X POST "http://127.0.0.1:${PORT}/hook" \
  -H "Content-Type: application/json" \
  -d "{\"pane_id\":\"${PANE_ID}\",\"event\":${INPUT}}" \
  > /dev/null 2>&1 || true
