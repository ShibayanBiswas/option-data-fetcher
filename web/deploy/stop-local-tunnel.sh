#!/usr/bin/env bash
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${WEB}/data/tunnel-logs"

stop_pidfile() {
  local f="$1"
  if [[ -f "${f}" ]]; then
    local pid
    pid="$(cat "${f}")"
    if kill -0 "${pid}" 2>/dev/null; then
      echo "Stopping pid ${pid} (${f})"
      kill "${pid}" 2>/dev/null || true
      sleep 1
      kill -9 "${pid}" 2>/dev/null || true
    fi
    rm -f "${f}"
  fi
}

stop_pidfile "${LOG_DIR}/tunnel.pid"
stop_pidfile "${LOG_DIR}/oca.pid"
# Also clear stray listeners on 3000 if ours
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null || true
fi
echo "Stopped local tunnel stack."
