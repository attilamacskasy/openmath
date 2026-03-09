#!/usr/bin/env python3
"""OpenMath DevOps Console — thin entry point.

Usage:
    python dev.py              # Interactive menu
    python dev.py help         # Show all modes
    python dev.py dev-quick    # Quick start dev stack
    python dev.py db-start     # Start database
    python dev.py --auto-approve dev-quick   # No prompts
"""

import sys
from pathlib import Path

# Ensure the repo root is on sys.path so `devops` package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from devops.__main_impl import main

if __name__ == "__main__":
    main()
