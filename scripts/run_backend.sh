#!/usr/bin/env bash
# Run the FastAPI backend server
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
cd "$PROJECT_ROOT"
# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
# Activate virtual environment if present
if [ -d venv ]; then
  source venv/bin/activate
fi
# Ensure dependencies are installed
echo "Installing Python dependencies..."
pip install --upgrade -r requirements.txt
# Start the server with defaults if not set
HOST="${BACKEND_HOST:-0.0.0.0}"
PORT="${BACKEND_PORT:-8000}"
echo "Starting FastAPI backend at ${HOST}:${PORT}" >&2
exec uvicorn server:app --host "$HOST" --port "$PORT"