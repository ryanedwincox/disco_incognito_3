#!/usr/bin/env python3
"""
Git worktree creation script with automatic port assignment.

Creates a new git worktree and configures unique ports for backend and frontend
by scanning existing worktrees to avoid port conflicts.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    BLUE = '\033[0;34m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'  # No Color


def print_colored(message: str, color: str = Colors.NC):
    """Print colored message."""
    print(f'{color}{message}{Colors.NC}')


def get_git_root() -> Path:
    """Get the root directory of the main git repository."""
    result = subprocess.run(['git', 'rev-parse', '--git-common-dir'], capture_output=True, text=True, check=True)
    git_common_dir = Path(result.stdout.strip()).resolve()
    # git-common-dir returns .git or path/to/.git, we want the parent
    if git_common_dir.name == '.git':
        return git_common_dir.parent
    return git_common_dir.parent


def get_worktrees() -> list[Path]:
    """Get list of all worktree paths."""
    result = subprocess.run(['git', 'worktree', 'list', '--porcelain'], capture_output=True, text=True, check=True)

    worktrees = []
    for line in result.stdout.strip().split('\n'):
        if line.startswith('worktree '):
            worktrees.append(Path(line.split(' ', 1)[1]))

    return worktrees


def extract_port_from_url(url: str) -> int | None:
    """Extract port number from a URL."""
    match = re.search(r':(\d+)', url)
    if match:
        return int(match.group(1))
    return None


def get_used_ports(worktrees: list[Path]) -> dict[str, set[int]]:
    """Scan all worktrees for used ports in .env files."""
    used_ports = {
        'backend': set(),
        'frontend': set(),
    }

    for worktree in worktrees:
        # Check backend/.env
        backend_env = worktree / 'backend' / '.env'
        if backend_env.exists():
            content = backend_env.read_text()
            for line in content.split('\n'):
                if line.startswith('BACKEND_URL='):
                    port = extract_port_from_url(line)
                    if port:
                        used_ports['backend'].add(port)
                elif line.startswith('FRONTEND_URL='):
                    port = extract_port_from_url(line)
                    if port:
                        used_ports['frontend'].add(port)

        # Check frontend/.env
        frontend_env = worktree / 'frontend' / '.env'
        if frontend_env.exists():
            content = frontend_env.read_text()
            for line in content.split('\n'):
                if line.startswith('VITE_PORT='):
                    try:
                        port = int(line.split('=', 1)[1].strip())
                        used_ports['frontend'].add(port)
                    except ValueError:
                        pass

    return used_ports


def find_next_available_port(used_ports: set[int], start_port: int) -> int:
    """Find the next available port starting from start_port."""
    port = start_port
    while port in used_ports:
        port += 1
    return port


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
    def replace_port(line: str, var_name: str, new_port: int) -> str:
        if line.startswith(f'{var_name}='):
            # Replace port in URL
            return re.sub(r':(\d+)', f':{new_port}', line)
        return line

    lines = content.split('\n')
    updated_lines = []
    for line in lines:
        if line.startswith('BACKEND_URL=') or line.startswith('SPOTIFY_REDIRECT_URI='):
            line = replace_port(line, line.split('=')[0], backend_port)
        elif line.startswith('FRONTEND_URL=') or line.startswith('ALLOWED_ORIGINS='):
            line = replace_port(line, line.split('=')[0], frontend_port)
        updated_lines.append(line)

    backend_env.write_text('\n'.join(updated_lines))
    print_colored(f'  Updated {backend_env}', Colors.GREEN)


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
    print_colored(f'  Updated {frontend_env}', Colors.GREEN)


def create_worktree(branch_name: str, base_path: Path | None = None):
    """Create a new git worktree with auto-assigned ports."""

    # Get git root and existing worktrees
    git_root = get_git_root()
    worktrees = get_worktrees()

    print_colored(f'Git root: {git_root}', Colors.BLUE)
    print_colored(f'Found {len(worktrees)} existing worktree(s)', Colors.BLUE)

    # Determine worktree path
    if base_path:
        worktree_path = base_path / branch_name
    else:
        # Place worktree as sibling to main repo
        worktree_path = git_root.parent / f'{git_root.name}_{branch_name}'

    print_colored(f'New worktree path: {worktree_path}', Colors.BLUE)

    # Get used ports
    used_ports = get_used_ports(worktrees)
    print_colored(f'Used backend ports: {sorted(used_ports["backend"])}', Colors.BLUE)
    print_colored(f'Used frontend ports: {sorted(used_ports["frontend"])}', Colors.BLUE)

    # Find available ports
    backend_port = find_next_available_port(used_ports['backend'], 7700)
    frontend_port = find_next_available_port(used_ports['frontend'], 7800)

    print_colored('\nAssigning ports:', Colors.YELLOW)
    print_colored(f'  Backend:  {backend_port}', Colors.GREEN)
    print_colored(f'  Frontend: {frontend_port}', Colors.GREEN)

    # Create the worktree
    print_colored(f'\nCreating worktree for branch "{branch_name}"...', Colors.BLUE)

    try:
        # Check if branch exists
        result = subprocess.run(['git', 'rev-parse', '--verify', branch_name], capture_output=True, text=True)

        if result.returncode == 0:
            # Branch exists, just create worktree
            subprocess.run(['git', 'worktree', 'add', str(worktree_path), branch_name], check=True)
        else:
            # Create new branch from current HEAD
            subprocess.run(['git', 'worktree', 'add', '-b', branch_name, str(worktree_path)], check=True)

        print_colored(f'Worktree created at {worktree_path}', Colors.GREEN)

    except subprocess.CalledProcessError as e:
        print_colored(f'Error creating worktree: {e}', Colors.RED)
        sys.exit(1)

    # Update .env files
    print_colored('\nUpdating .env files...', Colors.BLUE)
    update_backend_env(worktree_path, backend_port, frontend_port)
    update_frontend_env(worktree_path, backend_port, frontend_port)

    # Print summary
    print_colored('\n' + '=' * 50, Colors.GREEN)
    print_colored('Worktree created successfully!', Colors.GREEN)
    print_colored('=' * 50, Colors.GREEN)
    print_colored(f'\nPath: {worktree_path}', Colors.NC)
    print_colored(f'Branch: {branch_name}', Colors.NC)
    print_colored('\nTo start development:', Colors.YELLOW)
    print_colored(f'  cd {worktree_path}', Colors.NC)
    print_colored(f'  # Backend: python -m uvicorn app.main:app --reload --port {backend_port}', Colors.NC)
    print_colored('  # Frontend: cd frontend && npm run dev', Colors.NC)
    print_colored('\nURLs:', Colors.YELLOW)
    print_colored(f'  Backend:  http://localhost:{backend_port}', Colors.NC)
    print_colored(f'  Frontend: http://localhost:{frontend_port}', Colors.NC)


def main():
    parser = argparse.ArgumentParser(
        description='Create a git worktree with auto-assigned ports',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_worktree.py feature-login
  python create_worktree.py bugfix-123 --path /tmp/worktrees

Port allocation:
  Backend ports start at 7700
  Frontend ports start at 7800
  The script scans all existing worktrees to avoid conflicts.
""",
    )

    parser.add_argument('branch', help='Branch name for the new worktree')

    parser.add_argument('--path', type=Path, help='Base path for the worktree (default: sibling to main repo)')

    args = parser.parse_args()

    create_worktree(args.branch, args.path)


if __name__ == '__main__':
    main()
