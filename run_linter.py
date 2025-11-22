#!/usr/bin/env python3
"""
Modern ruff linter runner - platform independent Python version.

This replaces the shell script with a cross-platform Python solution
that handles venv setup, package installation, and linting.
"""

import argparse
import os
import subprocess
import sys
import shutil
from pathlib import Path
from typing import List, Optional


class Colors:
    """ANSI color codes for cross-platform colored output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    BLUE = "\033[0;34m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"  # No Color


class LinterRunner:
    """Modern ruff linter runner with automatic venv management."""

    def __init__(self):
        self.project_root = Path(__file__).parent
        self.venv_path = self.project_root / ".venv_linter"

    def print_colored(self, message: str, color: str = Colors.NC):
        """Print colored message."""
        print(f"{color}{message}{Colors.NC}")

    def run_command(
        self, cmd: List[str], cwd: Optional[Path] = None, check: bool = True
    ) -> subprocess.CompletedProcess:
        """Run a command and return the result."""
        if cwd is None:
            cwd = self.project_root

        self.print_colored(f"Running: {' '.join(cmd)}", Colors.YELLOW)
        return subprocess.run(cmd, cwd=cwd, check=check, capture_output=False)

    def get_python_executable(self) -> str:
        """Get the appropriate Python executable."""
        if sys.platform == "win32":
            return str(self.venv_path / "Scripts" / "python.exe")
        else:
            return str(self.venv_path / "bin" / "python")

    def get_pip_executable(self) -> str:
        """Get the appropriate pip executable."""
        if sys.platform == "win32":
            return str(self.venv_path / "Scripts" / "pip.exe")
        else:
            return str(self.venv_path / "bin" / "pip")

    def create_venv(self):
        """Create virtual environment if it doesn't exist."""
        if not self.venv_path.exists():
            self.print_colored("Creating linter virtual environment...", Colors.BLUE)
            subprocess.run(
                [sys.executable, "-m", "venv", str(self.venv_path)], check=True
            )

            self.print_colored("Upgrading pip...", Colors.BLUE)
            self.run_command(
                [
                    self.get_python_executable(),
                    "-m",
                    "pip",
                    "install",
                    "--upgrade",
                    "pip",
                ]
            )

            self.install_dependencies()

            self.print_colored(
                "Linter virtual environment setup complete!", Colors.GREEN
            )
        else:
            self.print_colored(
                "Using existing linter virtual environment...", Colors.BLUE
            )

    def install_dependencies(self):
        """Install linting dependencies (ruff only - static analysis doesn't need package installation)."""
        self.print_colored("Installing ruff for static analysis...", Colors.BLUE)
        self.run_command([self.get_pip_executable(), "install", "ruff"])

    def run_ruff(self, command: str, extra_args: List[str]):
        """Run ruff using local venv."""
        self.create_venv()

        # Build the ruff command
        python_executable = self.get_python_executable()
        ruff_cmd = [python_executable, "-m", "ruff", command] + extra_args

        self.print_colored(
            f"Running ruff {command} with virtual environment...", Colors.BLUE
        )
        self.print_colored(f"Command: {' '.join(ruff_cmd)}", Colors.YELLOW)

        # Run ruff
        try:
            result = subprocess.run(ruff_cmd, cwd=self.project_root)
            if result.returncode == 0:
                self.print_colored("✅ Linting completed successfully!", Colors.GREEN)
            else:
                self.print_colored("❌ Linting found issues!", Colors.RED)
                if command == "check" and "--fix" not in extra_args:
                    self.print_colored(
                        "💡 Tip: Use --fix to automatically fix some issues",
                        Colors.YELLOW,
                    )
            return result.returncode
        except KeyboardInterrupt:
            self.print_colored("Linting interrupted by user", Colors.YELLOW)
            return 1


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="""
Modern Ruff Linter Runner - Cross-Platform Code Linting

This is a modern ruff-based linting suite for static code analysis.
Fast and lightweight - no package installation required.

Key Features:
• Automatic virtual environment creation and management
• Cross-platform support (Windows, Linux, macOS)  
• Pure static analysis - no package compilation needed
• Supports both checking and formatting code
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
BASIC USAGE:
  python run_linter.py                          # Check backend/ (default)
  python run_linter.py --fix                    # Check and fix issues
  python run_linter.py --format                 # Format code
  python run_linter.py --format --check         # Check code formatting without fixing

ADVANCED OPTIONS:
  python run_linter.py --select F,E             # Only check F and E rules
  python run_linter.py --fix --select F541      # Fix only F541 issues
  python run_linter.py --fix --unsafe-fixes     # Fix issues with unsafe fixes enabled
  python run_linter.py --exclude tests/         # Exclude tests directory
  python run_linter.py --force-rebuild          # Rebuild venv

SETUP:
  No manual setup required! The script automatically:
  • Creates .venv_linter/ directory with Python virtual environment
  • Installs ruff for code linting and formatting
        """,
    )

    # Main actions (follows ruff's standard API)
    parser.add_argument(
        "--fix", action="store_true", help="Automatically fix linting issues"
    )
    parser.add_argument(
        "--format", action="store_true", help="Run ruff format (code formatting)"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="When used with --format, check formatting without fixing",
    )

    # Ruff options
    parser.add_argument("--select", help="Select specific rules (e.g., F,E,W)")
    parser.add_argument("--ignore", help="Ignore specific rules (e.g., F401,E501)")
    parser.add_argument(
        "--exclude", help="Exclude files/directories (e.g., tests/,third_party/)"
    )
    parser.add_argument(
        "--config", help="Path to ruff config file (default: ruff.toml)"
    )

    # Runner options
    parser.add_argument(
        "--force-rebuild", action="store_true", help="Force rebuild of venv"
    )
    parser.add_argument("--verbose", action="store_true", help="Verbose output")

    # Pass-through ruff options
    parser.add_argument(
        "--unsafe-fixes",
        action="store_true",
        help="Enable unsafe fixes (passed to ruff)",
    )
    parser.add_argument(
        "--diff", action="store_true", help="Show diff of changes (passed to ruff)"
    )

    # Target paths
    parser.add_argument(
        "paths",
        nargs="*",
        default=["backend/"],
        help="Paths to lint (default: backend/)",
    )

    args = parser.parse_args()

    runner = LinterRunner()

    # Handle force rebuild
    if args.force_rebuild:
        if runner.venv_path.exists():
            runner.print_colored(
                "Removing existing linter virtual environment...", Colors.YELLOW
            )
            shutil.rmtree(runner.venv_path)

    # Determine command (follows ruff's standard API)
    if args.format:
        command = "format"
    else:
        command = "check"  # Default: lint checking

    # Build ruff arguments
    ruff_args = []

    # Add paths
    ruff_args.extend(args.paths)

    # Add ruff-specific options (standard ruff API)
    if args.fix and command == "check":
        ruff_args.append("--fix")

    if args.check and command == "format":
        ruff_args.extend(["--diff", "--check"])

    if args.select:
        ruff_args.extend(["--select", args.select])

    if args.ignore:
        ruff_args.extend(["--ignore", args.ignore])

    if args.exclude:
        ruff_args.extend(["--exclude", args.exclude])

    if args.config:
        ruff_args.extend(["--config", args.config])
    elif (runner.project_root / "ruff.toml").exists():
        ruff_args.extend(["--config", "ruff.toml"])

    if args.verbose:
        ruff_args.append("--verbose")

    # Pass-through ruff options
    if args.unsafe_fixes:
        ruff_args.append("--unsafe-fixes")

    if args.diff:
        ruff_args.append("--diff")

    # Run linting
    return runner.run_ruff(command, ruff_args)


if __name__ == "__main__":
    sys.exit(main())
