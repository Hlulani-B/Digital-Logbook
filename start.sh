#!/usr/bin/env bash
set -euo pipefail

# Start Codacaine locally with npm (no Docker required).
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.local-run"
PID_FILE="$RUN_DIR/pids"
LOG_DIR="$RUN_DIR/logs"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or is not on PATH." >&2
  exit 1
fi

if [[ -s "$PID_FILE" ]]; then
  echo "Existing process records found: $PID_FILE"
  echo "Run ./stop.sh before starting again."
  exit 1
fi

mkdir -p "$LOG_DIR"
: > "$PID_FILE"

start_service() {
  local name="$1" relative_dir="$2" script="$3"
  local dir="$ROOT_DIR/$relative_dir"

  if [[ ! -f "$dir/package.json" ]]; then
    echo "Error: Missing $relative_dir/package.json" >&2
    return 1
  fi
  if [[ ! -d "$dir/node_modules" ]]; then
    echo "Error: Dependencies not installed in $relative_dir. Run 'npm install' there first." >&2
    return 1
  fi

  (cd "$dir" && exec npm run "$script") > "$LOG_DIR/$name.log" 2>&1 &
  local pid=$!
  printf '%s\t%s\n' "$name" "$pid" >> "$PID_FILE"
  echo "Started $name (PID $pid); log: .local-run/logs/$name.log"
}

# Stop anything started on this run if a startup prerequisite is missing.
rollback() {
  echo "Startup interrupted. Stopping processes launched in this run." >&2
  "$ROOT_DIR/stop.sh" || true
}
trap rollback ERR INT TERM

start_service auth-service services/auth-service start
start_service dashboard-service services/dashboard-service start
start_service project-service services/project-service start
start_service profile-service services/profile-service start
start_service api-gateway api-gateway start
start_service frontend frontend dev

trap - ERR INT TERM
printf '\nAll npm processes launched. This does not guarantee each server is healthy.\n'
printf 'Frontend: http://localhost:3000 (if configured to use port 3000)\n'
printf 'API gateway: http://localhost:4000\n'
printf 'Logs: %s\nStop: ./stop.sh\n' "$LOG_DIR"
