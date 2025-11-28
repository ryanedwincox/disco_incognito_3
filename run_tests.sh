#!/bin/bash
set -e

# Disco Incognito - Test runner script

# Run before commits: linting, E2E tests, backend tests
# Usage: ./run_tests.sh [--fix] [--e2e] [--backend]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Source dev environment to ensure dependencies are installed
source dev_env.sh

RUN_ALL=true
RUN_FIX=false
RUN_E2E=false
RUN_BACKEND=false

for arg in "$@"; do
    case $arg in
        --fix)
            RUN_FIX=true
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
            echo "Usage: ./run_tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --fix       Auto-fix linting issues"
            echo "  --e2e       Run only E2E tests (Playwright)"
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
        python run_linter.py
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
        npm run lint
    fi
    cd ..
    echo ""
fi

# Frontend E2E tests (Playwright - tests start their own servers)
if $RUN_ALL || $RUN_E2E; then
    echo ">>> Frontend E2E Tests (Playwright)"
    cd frontend
    npx playwright test
    cd ..
    echo ""
fi

# Backend tests
if $RUN_ALL || $RUN_BACKEND; then
    echo ">>> Backend Tests"
    cd backend
    python -m pytest -v
    cd ..
    echo ""
fi

echo "=== Validation Complete ==="
echo ""
echo "==========================================="
echo "  ALL TESTS PASSED"
echo "==========================================="
