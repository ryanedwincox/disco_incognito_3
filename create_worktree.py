#!/usr/bin/env python3
"""
Git worktree creation script.

Creates a new git worktree. Port assignment is handled at runtime by run.sh.
"""

import argparse
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


def create_worktree(branch_name: str, base_path: Path | None = None):
    """Create a new git worktree."""

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

    # Print summary
    print_colored('\n' + '=' * 50, Colors.GREEN)
    print_colored('Worktree created successfully!', Colors.GREEN)
    print_colored('=' * 50, Colors.GREEN)
    print_colored(f'\nPath: {worktree_path}', Colors.NC)
    print_colored(f'Branch: {branch_name}', Colors.NC)
    print_colored('\nTo start development:', Colors.YELLOW)
    print_colored(f'  cd {worktree_path}', Colors.NC)
    print_colored('  ./run.sh', Colors.NC)
    print_colored('\nPorts are assigned automatically by run.sh based on branch:', Colors.YELLOW)
    print_colored('  main/master: Backend 8000+, Frontend 3000+', Colors.NC)
    print_colored('  feature branches: Backend 9000+, Frontend 9100+', Colors.NC)

    # Open VS Code in the new worktree
    print_colored('\nOpening VS Code...', Colors.BLUE)
    subprocess.run(['code', str(worktree_path)])


def main():
    parser = argparse.ArgumentParser(
        description='Create a git worktree',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_worktree.py feature-login
  python create_worktree.py bugfix-123 --path /tmp/worktrees

Port allocation is handled by run.sh at runtime.
""",
    )

    parser.add_argument('branch', help='Branch name for the new worktree')

    parser.add_argument('--path', type=Path, help='Base path for the worktree (default: sibling to main repo)')

    args = parser.parse_args()

    create_worktree(args.branch, args.path)


if __name__ == '__main__':
    main()
