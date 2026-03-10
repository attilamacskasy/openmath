"""Dark-mode colour palette and InquirerPy theme for the DevOps Console."""

from __future__ import annotations

from InquirerPy.utils import InquirerPyStyle

# ── InquirerPy custom style ─────────────────────────────────
# Keys follow the InquirerPy style schema (prompt_toolkit token names).
THEME = InquirerPyStyle({
    "questionmark": "#00d7ff",       # cyan  — the ? prefix
    "question": "#ffffff",           # white — question text
    "pointer": "#00ff87 bold",       # green — › arrow on active row
    "highlighted": "#00ff87 bold",   # green — selected row text
    "separator": "#585858",          # dim   — section header lines
    "instruction": "#585858",        # dim   — (use ↑/↓ …)
    "answer": "#00d7ff bold",        # cyan  — chosen answer echo
    "input": "#ffffff",              # white — text input
    "text": "#aaaaaa",              # light gray — normal items
})

# ── ANSI escape helpers ─────────────────────────────────────
CYAN = "\033[96m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
DIM = "\033[90m"
BOLD = "\033[1m"
RESET = "\033[0m"
