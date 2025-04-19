#!/usr/bin/env bash
set -euo pipefail
# Preflight checks
if [ ! -d venv ]; then
  echo "[ERROR] Python venv missing. Run: python3 -m venv venv" >&2
  exit 1
fi
if [ ! -f .env ]; then
  echo "[ERROR] .env missing. Copy from .env.example and edit as needed." >&2
  exit 1
fi
if [ ! -f server.py ]; then
  echo "[ERROR] server.py missing. Are you in the project root?" >&2
  exit 1
fi
lsof -ti tcp:8000 | xargs -r kill
if ! bash scripts/run_backend.sh > server.log 2>&1 & echo $! > backend.pid; then
  echo "[ERROR] Backend failed to start. Check server.log for details." >&2
  exit 1
fi
