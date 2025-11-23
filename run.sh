#!/bin/bash
set -e

# Disco Incognito - Development server script
# Usage: ./run.sh [--detached] [--stop]

show_help() {
    echo "Usage: ./run.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --detached    Run containers in background"
    echo "  --stop        Stop running containers"
    echo "  --help        Show this help message"
    echo ""
    echo "Ports:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:8000"
}

case "$1" in
    --stop)
        echo "Stopping Disco Incognito..."
        docker-compose -f docker-compose.dev.yml down
        echo "Stopped."
        ;;
    --detached)
        echo "Starting Disco Incognito (detached)..."
        docker-compose -f docker-compose.dev.yml up -d --build
        echo ""
        echo "Running in background."
        echo "  Frontend: http://localhost:3000"
        echo "  Backend:  http://localhost:8000"
        echo ""
        echo "Run './run.sh --stop' to stop."
        ;;
    --help)
        show_help
        ;;
    "")
        echo "Starting Disco Incognito..."
        echo "  Frontend: http://localhost:3000"
        echo "  Backend:  http://localhost:8000"
        echo ""
        docker-compose -f docker-compose.dev.yml up --build
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
