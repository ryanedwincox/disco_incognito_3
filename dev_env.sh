#!/bin/bash
# Development environment setup - idempotent and safe to source repeatedly
# Usage: source dev_env.sh

# Detect if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Error: This script must be sourced, not executed directly."
    echo "Usage: source dev_env.sh"
    echo "   or: . dev_env.sh"
    exit 1
fi

# CACHE_FILES: List of files whose content should trigger reinstall when changed
# Add files here that define dependencies (one per line)
CACHE_FILES=(
    TODO UPDATE other build files as needed
    ruff.toml
    package.json
    package-lock.json
    frontend/package.json
    frontend/package-lock.json
)

# Get the expected venv path
EXPECTED_VENV="$(pwd)/.venv"

# Check if we're in the correct venv
if [ -n "$VIRTUAL_ENV" ] && [ "$VIRTUAL_ENV" != "$EXPECTED_VENV" ]; then
    type deactivate &>/dev/null && deactivate || unset VIRTUAL_ENV
fi

# Activate or create venv if not already activated
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    else
        # Create fresh venv if it doesn't exist
        python3.12 -m venv .venv
        source .venv/bin/activate
        # Upgrade pip on first creation
        pip install -q --upgrade pip
    fi
fi

# Install packages in editable mode with dev dependencies
# Uses content-based hashing to detect when reinstall is needed

# Define packages to install
INSTALL_ARGS=()

# Install oliscython first (dependency of olis)
if [ -f "oliscython_src/pyproject.toml" ]; then
    INSTALL_ARGS+=("-e" "oliscython_src[dev]")
fi

# Install main olis package
if [ -f "olis_src/pyproject.toml" ]; then
    INSTALL_ARGS+=("-e" "olis_src[dev]")
fi

# Install test requirements
if [ -f "pytest/requirements.txt" ]; then
    INSTALL_ARGS+=("-r" "pytest/requirements.txt")
fi

# Install standalone log viewer requirements (optional)
if [ -f "standalone_log_viewer/requirements.txt" ]; then
    INSTALL_ARGS+=("-r" "standalone_log_viewer/requirements.txt")
fi

if [ ${#INSTALL_ARGS[@]} -gt 0 ]; then
    MARKER=".venv/.deps_hash"
    NEEDS_INSTALL=false

    # Build hash from concatenated content of CACHE_FILES
    HASH_INPUT=""
    for pattern in "${CACHE_FILES[@]}"; do
        # Expand glob patterns
        for file in $pattern; do
            if [ -f "$file" ]; then
                HASH_INPUT+=$(cat "$file")
            fi
        done
    done

    # Compute hash of concatenated content
    if [ -n "$HASH_INPUT" ]; then
        CURRENT_HASH=$(echo -n "$HASH_INPUT" | md5sum | cut -d' ' -f1)

        # Check if hash changed
        if [ ! -f "$MARKER" ] || [ "$(cat "$MARKER" 2>/dev/null)" != "$CURRENT_HASH" ]; then
            NEEDS_INSTALL=true
        fi
    else
        # No cache files configured, always install
        NEEDS_INSTALL=true
    fi

    # Only run pip install if dependencies changed
    if [ "$NEEDS_INSTALL" = true ]; then
        pip install -q "${INSTALL_ARGS[@]}" && echo -n "$CURRENT_HASH" > "$MARKER"
    fi
fi

# Install npm packages if package.json exists
if [ -f "package.json" ]; then
    NPM_MARKER="node_modules/.deps_hash"
    NPM_NEEDS_INSTALL=false

    # Build hash from package.json and package-lock.json
    NPM_HASH_INPUT=""
    for file in package.json package-lock.json; do
        if [ -f "$file" ]; then
            NPM_HASH_INPUT+=$(cat "$file")
        fi
    done

    if [ -n "$NPM_HASH_INPUT" ]; then
        NPM_CURRENT_HASH=$(echo -n "$NPM_HASH_INPUT" | md5sum | cut -d' ' -f1)

        if [ ! -f "$NPM_MARKER" ] || [ "$(cat "$NPM_MARKER" 2>/dev/null)" != "$NPM_CURRENT_HASH" ]; then
            NPM_NEEDS_INSTALL=true
        fi
    else
        NPM_NEEDS_INSTALL=true
    fi

    if [ "$NPM_NEEDS_INSTALL" = true ]; then
        npm install --silent && echo -n "$NPM_CURRENT_HASH" > "$NPM_MARKER"
    fi
fi

# Install frontend npm packages if frontend/package.json exists
if [ -f "frontend/package.json" ]; then
    FRONTEND_NPM_MARKER="frontend/node_modules/.deps_hash"
    FRONTEND_NPM_NEEDS_INSTALL=false

    # Build hash from frontend package.json and package-lock.json
    FRONTEND_NPM_HASH_INPUT=""
    for file in frontend/package.json frontend/package-lock.json; do
        if [ -f "$file" ]; then
            FRONTEND_NPM_HASH_INPUT+=$(cat "$file")
        fi
    done

    if [ -n "$FRONTEND_NPM_HASH_INPUT" ]; then
        FRONTEND_NPM_CURRENT_HASH=$(echo -n "$FRONTEND_NPM_HASH_INPUT" | md5sum | cut -d' ' -f1)

        if [ ! -f "$FRONTEND_NPM_MARKER" ] || [ "$(cat "$FRONTEND_NPM_MARKER" 2>/dev/null)" != "$FRONTEND_NPM_CURRENT_HASH" ]; then
            FRONTEND_NPM_NEEDS_INSTALL=true
        fi
    else
        FRONTEND_NPM_NEEDS_INSTALL=true
    fi

    if [ "$FRONTEND_NPM_NEEDS_INSTALL" = true ]; then
        (cd frontend && npm install --silent) && echo -n "$FRONTEND_NPM_CURRENT_HASH" > "$FRONTEND_NPM_MARKER"
    fi
fi

# Set up local olis_storage for this worktree
OLIS_STORAGE_DIR="$(pwd)/olis_storage"
if [ ! -d "$OLIS_STORAGE_DIR" ]; then
    mkdir -p "$OLIS_STORAGE_DIR"
fi
export OLIS_STORAGE_PATH="$OLIS_STORAGE_DIR"
export OLIS_MACHINE_ID_PATH="$OLIS_STORAGE_DIR/machine-id"

# Set up separate test storage (used by local-dev-start.sh --test)
OLIS_STORAGE_TEST_DIR="$(pwd)/olis_storage_test"
if [ ! -d "$OLIS_STORAGE_TEST_DIR" ]; then
    mkdir -p "$OLIS_STORAGE_TEST_DIR"
fi
export OLIS_STORAGE_TEST="$OLIS_STORAGE_TEST_DIR"