#!/bin/bash
set -e

# Disco Incognito - Development server script
# Usage: ./run.sh [--detached] [--stop]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
    echo "Usage: ./run.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --detached    Run containers in background"
    echo "  --stop        Stop running containers"
    echo "  --help        Show this help message"
    echo ""
    echo "Port Assignment:"
    echo "  Main branch:    Backend 8000+, Frontend 3000+"
    echo "  Feature branch: Backend 9000+, Frontend 9100+"
    echo ""
    echo "Ports are assigned by dev_env.sh and saved in .env files."
}

get_current_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

start_containers() {
    local detached=$1

    # Ensure dev environment is set up (creates .env files if needed)
    # shellcheck source=dev_env.sh
    source "$SCRIPT_DIR/dev_env.sh"

    # Read ports from .env files
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/backend/.env"
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/frontend/.env"

    local backend_port=${PORT:-8000}
    local frontend_port=${VITE_PORT:-3000}

    export PORT=$backend_port
    export VITE_PORT=$frontend_port
    export VITE_API_URL="http://localhost:$backend_port"

    local branch
    branch=$(get_current_branch)

    echo "Starting Disco Incognito..."
    echo "  Branch:   $branch"
    echo "  Backend:  http://localhost:$backend_port"
    echo "  Frontend: http://localhost:$frontend_port"
    echo ""

    if [ "$detached" = true ]; then
        docker-compose -f docker-compose.dev.yml up -d --build
        echo ""
        echo "Running in background."
        echo "Run './run.sh --stop' to stop."
    else
        docker-compose -f docker-compose.dev.yml up --build
    fi
}

stop_containers() {
    echo "Stopping Disco Incognito..."
    docker-compose -f docker-compose.dev.yml down
    echo "Stopped."
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --stop)
            stop_containers
            exit 0
            ;;
        --detached)
            start_containers true
            exit 0
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Default: run attached
start_containers false
