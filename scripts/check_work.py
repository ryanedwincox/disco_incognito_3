#!/usr/bin/env python3
"""Prompt Codex to validate work and persist simple stats."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

LOG_PATH = Path(__file__).with_name("codex_stats.log")


def codex(message: str, iteration: int) -> None:
    """Emit the provided message and record the iteration to the log."""
    print(message)
    append_stat(iteration, message)


def append_stat(iteration: int, message: str) -> None:
    """Append a timestamped stat line to the log file."""
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    line = f"{timestamp}\titeration={iteration}\tmessage={message.strip()}\n"
    with LOG_PATH.open("a", encoding="utf-8") as log_file:
        log_file.write(line)


def main() -> None:
    """Run the Codex reminder workflow ten times."""
    for iteration in range(1, 11):
        codex("check your work and continue ", iteration)


if __name__ == "__main__":
    main()
