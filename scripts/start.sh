#!/usr/bin/env bash
set -euo pipefail
lsof -ti tcp:8000 | xargs -r kill
bash scripts/run_backend.sh > server.log 2>&1 & echo $! > backend.pid
