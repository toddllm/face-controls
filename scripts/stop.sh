#!/usr/bin/env bash
set -euo pipefail
if [ -f backend.pid ]; then kill $(cat backend.pid) && rm -f backend.pid; else lsof -ti tcp:8000 | xargs -r kill; fi
