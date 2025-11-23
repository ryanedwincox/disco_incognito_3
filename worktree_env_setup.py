#!/usr/bin/env python3
"""
Shared worktree environment setup.

Configures .env files for backend and frontend with assigned ports.
Used by both create_worktree.py (manual) and repo-maintainer (automated).
"""

import re
import subprocess
from pathlib import Path


def update_backend_env(worktree_path: Path, backend_port: int, frontend_port: int):
    """Create/update backend .env file with new ports."""
    backend_env = worktree_path / 'backend' / '.env'

    # Copy from example if .env doesn't exist
    backend_env_example = worktree_path / 'backend' / '.env.example'
    if backend_env_example.exists() and not backend_env.exists():
        content = backend_env_example.read_text()
    elif backend_env.exists():
        content = backend_env.read_text()
    else:
        # Create minimal .env
        content = """# Spotify API Configuration
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/callback

# Application URLs
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Storage Adapter
SESSION_STORAGE=json_file
SESSION_STORAGE_FILE=./data/disco_incognito.json

# Security
JWT_SECRET_KEY=set-a-strong-secret
SESSION_SECRET=set-a-session-secret

# Development
DEBUG=true
LOG_LEVEL=INFO

# Music Service Configuration
MUSIC_SERVICE=spotify
SPOTIFY_MODE=test

# Misc
ALLOWED_ORIGINS=http://localhost:3000
"""

    # Update ports in content
    def replace_port(line: str, new_port: int) -> str:
        return re.sub(r':(\d+)', f':{new_port}', line)

    lines = content.split('\n')
    updated_lines = []
    for line in lines:
        if line.startswith('BACKEND_URL=') or line.startswith('SPOTIFY_REDIRECT_URI='):
            line = replace_port(line, backend_port)
        elif line.startswith('FRONTEND_URL=') or line.startswith('ALLOWED_ORIGINS='):
            line = replace_port(line, frontend_port)
        updated_lines.append(line)

    backend_env.write_text('\n'.join(updated_lines))


def update_frontend_env(worktree_path: Path, backend_port: int, frontend_port: int):
    """Create/update frontend .env file with new ports."""
    frontend_env = worktree_path / 'frontend' / '.env'

    # Copy from existing or create new
    if frontend_env.exists():
        content = frontend_env.read_text()
    else:
        content = """# Frontend Configuration
VITE_API_URL=http://localhost:8000
VITE_PORT=3000
VITE_UI_MODE=minimal

# Test Mode - Set to true for development with mock data
VITE_TEST_MODE=true
"""

    # Update ports
    lines = content.split('\n')
    updated_lines = []
    has_vite_port = False

    for line in lines:
        if line.startswith('VITE_API_URL='):
            line = re.sub(r':(\d+)', f':{backend_port}', line)
        elif line.startswith('VITE_PORT='):
            line = f'VITE_PORT={frontend_port}'
            has_vite_port = True
        updated_lines.append(line)

    # Add VITE_PORT if not present
    if not has_vite_port:
        # Insert after VITE_API_URL or at the beginning
        for i, line in enumerate(updated_lines):
            if line.startswith('VITE_API_URL='):
                updated_lines.insert(i + 1, f'VITE_PORT={frontend_port}')
                break
        else:
            updated_lines.insert(0, f'VITE_PORT={frontend_port}')

    frontend_env.write_text('\n'.join(updated_lines))


def run_npm_install(worktree_path: Path):
    """Run npm install in the frontend directory."""
    frontend_dir = worktree_path / 'frontend'
    if not frontend_dir.exists():
        return

    package_json = frontend_dir / 'package.json'
    if not package_json.exists():
        return

    subprocess.run(
        ['npm', 'install'],
        cwd=str(frontend_dir),
        check=True,
        capture_output=True,
    )


def setup_worktree_env(worktree_path: Path, backend_port: int, frontend_port: int):
    """
    Configure .env files for a worktree with the given ports.

    Args:
        worktree_path: Path to the worktree root
        backend_port: Port for backend server
        frontend_port: Port for frontend dev server
    """
    if isinstance(worktree_path, str):
        worktree_path = Path(worktree_path)

    update_backend_env(worktree_path, backend_port, frontend_port)
    update_frontend_env(worktree_path, backend_port, frontend_port)
    run_npm_install(worktree_path)
