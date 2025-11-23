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

from worktree_env_setup import setup_worktree_env


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


def create_worktree(branch_name: str, base_path: Path | None = None):
    """Create a new git worktree with auto-assigned ports."""

    # Get git root and existing worktrees
    git_root = get_git_root()
    worktrees = get_worktrees()

    print_colored(f'Git root: {git_root}', Colors.BLUE)
    print_colored(f'Found {len(worktrees)} existing worktree(s)', Colors.BLUE)

    # Determine worktree path (replace / with _ in branch names for folder)
    folder_name = branch_name.replace('/', '_')
    if base_path:
        worktree_path = base_path / folder_name
    else:
        # Place worktree as sibling to main repo
        worktree_path = git_root.parent / f'{git_root.name}_{folder_name}'

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
    setup_worktree_env(worktree_path, backend_port, frontend_port)
    print_colored(f'  Updated backend/.env and frontend/.env', Colors.GREEN)

    # Write .test_ports file (for consistency with repo-maintainer)
    ports_config = (
        "# Port assignments for this worktree\n"
        f"DEV_SERVER_PORT={backend_port}\n"
        f"TEST_SERVER_PORT={frontend_port}\n"
    )
    (worktree_path / ".test_ports").write_text(ports_config)
    print_colored(f'  Created .test_ports', Colors.GREEN)

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

    # Open VS Code in the new worktree
    print_colored('\nOpening VS Code...', Colors.BLUE)
    subprocess.run(['code', str(worktree_path)])


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
