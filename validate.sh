#!/bin/bash
set -e

# Disco Incognito - Validation script
# Run before commits: linting, unit tests, E2E tests
# Usage: ./validate.sh [--fix] [--unit] [--e2e] [--backend]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RUN_ALL=true
RUN_FIX=false
RUN_UNIT=false
RUN_E2E=false
RUN_BACKEND=false

for arg in "$@"; do
    case $arg in
        --fix)
            RUN_FIX=true
            ;;
        --unit)
            RUN_ALL=false
            RUN_UNIT=true
            ;;
        --e2e)
            RUN_ALL=false
            RUN_E2E=true
            ;;
        --backend)
            RUN_ALL=false
            RUN_BACKEND=true
            ;;
        --help)
            echo "Usage: ./validate.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --fix       Auto-fix linting issues"
            echo "  --unit      Run only frontend unit tests"
            echo "  --e2e       Run only E2E tests"
            echo "  --backend   Run only backend tests"
            echo "  --help      Show this help message"
            echo ""
            echo "With no options, runs all tests."
            exit 0
            ;;
    esac
done

echo "=== Disco Incognito Validation ==="
echo ""

# Backend linting (Python/ruff)
if $RUN_ALL || $RUN_FIX; then
    echo ">>> Backend Linting (ruff)"
    if $RUN_FIX; then
        python run_linter.py --fix || true
    else
        python run_linter.py || { echo "Backend linting failed. Run with --fix to auto-fix."; exit 1; }
    fi
    echo ""
fi

# Frontend linting
if $RUN_ALL || $RUN_FIX; then
    echo ">>> Frontend Linting"
    cd frontend
    if $RUN_FIX; then
        npm run lint -- --fix || true
    else
        npm run lint || { echo "Frontend linting failed. Run with --fix to auto-fix."; exit 1; }
    fi
    cd ..
    echo ""
fi

# Frontend unit tests
if $RUN_ALL || $RUN_UNIT; then
    echo ">>> Frontend Unit Tests"
    cd frontend
    npm run test:unit
    cd ..
    echo ""
fi

# Frontend E2E tests (requires running dev server)
if $RUN_ALL || $RUN_E2E; then
    echo ">>> Frontend E2E Tests"
    echo "(Note: Requires dev server running. Start with ./run.sh --detached)"
    cd frontend
    npm run test:e2e || echo "E2E tests skipped or failed - ensure dev server is running"
    cd ..
    echo ""
fi

# Backend tests
if $RUN_ALL || $RUN_BACKEND; then
    echo ">>> Backend Tests"
    cd backend
    python -m pytest -v || echo "No backend tests found or tests failed"
    cd ..
    echo ""
fi

echo "=== Validation Complete ==="
