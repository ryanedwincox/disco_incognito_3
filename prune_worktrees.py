#!/usr/bin/env python3
"""
Git worktree pruning script.

Lists all worktrees, shows which will be removed, and removes them after confirmation.
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
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color


def print_colored(message: str, color: str = Colors.NC):
    """Print colored message."""
    print(f'{color}{message}{Colors.NC}')


def get_git_root() -> Path:
    """Get the root directory of the main git repository."""
    result = subprocess.run(
        ['git', 'rev-parse', '--git-common-dir'],
        capture_output=True, text=True, check=True
    )
    git_common_dir = Path(result.stdout.strip()).resolve()
    if git_common_dir.name == '.git':
        return git_common_dir.parent
    return git_common_dir.parent


def get_worktrees() -> list[dict]:
    """Get list of all worktrees with their details."""
    result = subprocess.run(
        ['git', 'worktree', 'list', '--porcelain'],
        capture_output=True, text=True, check=True
    )

    worktrees = []
    current = {}

    for line in result.stdout.strip().split('\n'):
        if line.startswith('worktree '):
            if current:
                worktrees.append(current)
            current = {'path': Path(line.split(' ', 1)[1])}
        elif line.startswith('HEAD '):
            current['head'] = line.split(' ', 1)[1]
        elif line.startswith('branch '):
            current['branch'] = line.split(' ', 1)[1].replace('refs/heads/', '')
        elif line == 'bare':
            current['bare'] = True
        elif line == 'detached':
            current['detached'] = True

    if current:
        worktrees.append(current)

    return worktrees


def get_merged_branches(main_branch: str = 'main') -> set[str]:
    """Get branches that have been merged into main."""
    try:
        result = subprocess.run(
            ['git', 'branch', '--merged', main_branch],
            capture_output=True, text=True, check=True
        )
        branches = set()
        for line in result.stdout.strip().split('\n'):
            # Strip whitespace and remove leading markers (*, +)
            branch = line.strip().lstrip('*+ ')
            if branch and branch != main_branch:
                branches.add(branch)
        return branches
    except subprocess.CalledProcessError:
        return set()


def remove_worktree(worktree: dict, delete_branch: bool = True):
    """Remove a worktree and optionally its branch."""
    path = worktree['path']
    branch = worktree.get('branch')

    # Stop any docker containers using ports from this worktree
    ports_file = path / '.test_ports'
    if ports_file.exists():
        try:
            content = ports_file.read_text()
            for line in content.split('\n'):
                if line.startswith('DEV_SERVER_PORT='):
                    port = line.split('=')[1].strip()
                    subprocess.run(
                        f'docker stop ops-backend-dev-{port} 2>/dev/null || true',
                        shell=True, capture_output=True
                    )
                    subprocess.run(
                        f'docker rm ops-backend-dev-{port} 2>/dev/null || true',
                        shell=True, capture_output=True
                    )
        except Exception:
            pass

    # Remove the worktree
    try:
        subprocess.run(
            ['git', 'worktree', 'remove', str(path), '--force'],
            check=True, capture_output=True
        )
        print_colored(f'  Removed worktree: {path}', Colors.GREEN)
    except subprocess.CalledProcessError:
        # Try pruning first
        subprocess.run(['git', 'worktree', 'prune'], capture_output=True)
        try:
            subprocess.run(
                ['git', 'worktree', 'remove', str(path), '--force'],
                check=True, capture_output=True
            )
            print_colored(f'  Removed worktree: {path}', Colors.GREEN)
        except subprocess.CalledProcessError as e:
            print_colored(f'  Failed to remove worktree: {path} - {e}', Colors.RED)
            return

    # Delete local branch
    if delete_branch and branch:
        try:
            subprocess.run(
                ['git', 'branch', '-D', branch],
                check=True, capture_output=True
            )
            print_colored(f'  Deleted local branch: {branch}', Colors.GREEN)
        except subprocess.CalledProcessError:
            print_colored(f'  Local branch already deleted: {branch}', Colors.YELLOW)

        # Delete remote branch
        try:
            subprocess.run(
                ['git', 'push', 'origin', '--delete', branch],
                check=True, capture_output=True
            )
            print_colored(f'  Deleted remote branch: {branch}', Colors.GREEN)
        except subprocess.CalledProcessError:
            print_colored(f'  Remote branch not found: {branch}', Colors.YELLOW)


def main():
    parser = argparse.ArgumentParser(
        description='Prune git worktrees with confirmation',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python prune_worktrees.py              # Interactive mode - select worktrees to remove
  python prune_worktrees.py --merged     # Remove worktrees for branches merged into main
  python prune_worktrees.py --all        # Remove all worktrees except main
  python prune_worktrees.py --pattern "auto-*"  # Remove worktrees matching pattern
""",
    )

    parser.add_argument(
        '--merged', action='store_true',
        help='Remove worktrees for branches that have been merged into main'
    )
    parser.add_argument(
        '--all', action='store_true',
        help='Remove all worktrees except the main one'
    )
    parser.add_argument(
        '--pattern', type=str,
        help='Remove worktrees with branches matching this pattern (e.g., "auto-*")'
    )
    parser.add_argument(
        '--keep-branches', action='store_true',
        help='Keep git branches when removing worktrees'
    )
    parser.add_argument(
        '-y', '--yes', action='store_true',
        help='Skip confirmation prompt'
    )

    args = parser.parse_args()

    git_root = get_git_root()
    worktrees = get_worktrees()

    print_colored(f'Git root: {git_root}', Colors.BLUE)
    print_colored(f'Found {len(worktrees)} worktree(s)\n', Colors.BLUE)

    # Identify main worktree (the one at git root)
    main_worktree = None
    other_worktrees = []

    for wt in worktrees:
        if wt['path'].resolve() == git_root.resolve():
            main_worktree = wt
        else:
            other_worktrees.append(wt)

    if not other_worktrees:
        print_colored('No worktrees to prune (only main worktree exists).', Colors.YELLOW)
        return

    # Determine which worktrees to remove
    to_remove = []
    merged_branches = get_merged_branches() if args.merged else set()

    for wt in other_worktrees:
        branch = wt.get('branch', '')
        should_remove = False
        reason = ''

        if args.all:
            should_remove = True
            reason = 'all mode'
        elif args.merged and branch in merged_branches:
            should_remove = True
            reason = 'merged into main'
        elif args.pattern:
            import fnmatch
            if fnmatch.fnmatch(branch, args.pattern):
                should_remove = True
                reason = f'matches pattern "{args.pattern}"'

        if should_remove:
            wt['reason'] = reason
            to_remove.append(wt)

    # Interactive mode if no filter specified
    if not args.all and not args.merged and not args.pattern:
        print_colored('Available worktrees:', Colors.CYAN)
        for i, wt in enumerate(other_worktrees, 1):
            branch = wt.get('branch', 'detached')
            path = wt['path']
            print(f'  {i}. {branch}')
            print(f'     Path: {path}')

        print()
        print_colored('Enter numbers to remove (comma-separated), "all", or "q" to quit:', Colors.YELLOW)
        choice = input('> ').strip().lower()

        if choice == 'q' or choice == '':
            print_colored('Aborted.', Colors.YELLOW)
            return
        elif choice == 'all':
            to_remove = other_worktrees
            for wt in to_remove:
                wt['reason'] = 'selected all'
        else:
            try:
                indices = [int(x.strip()) - 1 for x in choice.split(',')]
                for i in indices:
                    if 0 <= i < len(other_worktrees):
                        wt = other_worktrees[i]
                        wt['reason'] = 'selected'
                        to_remove.append(wt)
            except ValueError:
                print_colored('Invalid input. Aborted.', Colors.RED)
                return

    if not to_remove:
        print_colored('No worktrees selected for removal.', Colors.YELLOW)
        return

    # Dry run - show what will be removed
    print_colored('\n' + '=' * 60, Colors.YELLOW)
    print_colored('DRY RUN - The following worktrees will be removed:', Colors.YELLOW)
    print_colored('=' * 60, Colors.YELLOW)

    for wt in to_remove:
        branch = wt.get('branch', 'detached')
        path = wt['path']
        reason = wt.get('reason', '')
        print()
        print_colored(f'  Branch: {branch}', Colors.RED)
        print(f'  Path:   {path}')
        print(f'  Reason: {reason}')
        if not args.keep_branches and branch:
            print(f'  Will delete: local branch, remote branch')

    print()
    print_colored(f'Total: {len(to_remove)} worktree(s) to remove', Colors.YELLOW)

    # Confirmation
    if not args.yes:
        print()
        print_colored('Proceed with removal? [y/N]: ', Colors.YELLOW)
        confirm = input().strip().lower()
        if confirm != 'y':
            print_colored('Aborted.', Colors.YELLOW)
            return

    # Remove worktrees
    print_colored('\nRemoving worktrees...', Colors.BLUE)

    for wt in to_remove:
        branch = wt.get('branch', 'unknown')
        print_colored(f'\nProcessing: {branch}', Colors.CYAN)
        remove_worktree(wt, delete_branch=not args.keep_branches)

    # Final prune
    subprocess.run(['git', 'worktree', 'prune'], capture_output=True)

    print_colored('\n' + '=' * 60, Colors.GREEN)
    print_colored(f'Successfully removed {len(to_remove)} worktree(s)', Colors.GREEN)
    print_colored('=' * 60, Colors.GREEN)


if __name__ == '__main__':
    main()
