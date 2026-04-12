#!/usr/bin/env bash
# Pulls the latest source from GitHub, rebuilds the Docker image, and
# restarts the OSINT Hub container. Safe to re-run.
#
#   ./deploy.sh              # pull, rebuild, restart
#   ./deploy.sh --no-pull    # just rebuild + restart (use local changes)
#   ./deploy.sh --logs       # rebuild + restart + tail logs
#
# Assumes docker + docker-compose-plugin are installed and the repo was
# cloned with git (so `git pull` works). Run from the repo root.

set -euo pipefail

cd "$(dirname "$0")"

PULL=1
FOLLOW_LOGS=0
for arg in "$@"; do
    case "$arg" in
        --no-pull) PULL=0 ;;
        --logs)    FOLLOW_LOGS=1 ;;
        -h|--help)
            sed -n '2,11p' "$0"
            exit 0
            ;;
        *) echo "Unknown flag: $arg" >&2; exit 1 ;;
    esac
done

# Pick whichever compose entrypoint this host has.
if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
else
    echo "ERROR: neither 'docker compose' nor 'docker-compose' is available." >&2
    exit 1
fi

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "No .env found — copying .env.example (edit it and re-run for full functionality)."
        cp .env.example .env
    else
        echo "WARNING: no .env or .env.example present. Container will run with defaults."
    fi
fi

if [ "$PULL" -eq 1 ]; then
    if [ ! -d .git ]; then
        echo "ERROR: not a git clone — cannot pull. Re-run with --no-pull or clone via git." >&2
        exit 1
    fi
    echo "==> git pull"
    git pull --ff-only
fi

echo "==> $DC up -d --build"
$DC up -d --build

echo "==> $DC ps"
$DC ps

if [ "$FOLLOW_LOGS" -eq 1 ]; then
    echo "==> tailing logs (Ctrl-C to stop)"
    $DC logs -f
fi
