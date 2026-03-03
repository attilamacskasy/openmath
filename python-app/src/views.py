from __future__ import annotations

from datetime import datetime
from decimal import Decimal
import json


def print_header(title: str) -> None:
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def ask_text(prompt: str, allow_empty: bool = False) -> str:
    while True:
        value = input(prompt).strip()
        if value or allow_empty:
            return value
        print("Value is required.")


def ask_int(
    prompt: str,
    minimum: int | None = None,
    maximum: int | None = None,
    default: int | None = None,
) -> int:
    while True:
        raw = input(prompt).strip()
        if raw == "" and default is not None:
            number = default
        else:
            try:
                number = int(raw)
            except ValueError:
                print("Please type a number.")
                continue
        if minimum is not None and number < minimum:
            print(f"Value must be >= {minimum}.")
            continue
        if maximum is not None and number > maximum:
            print(f"Value must be <= {maximum}.")
            continue
        return number


def ask_yes_no(prompt: str, default_yes: bool = True) -> bool:
    suffix = " [Y/n]: " if default_yes else " [y/N]: "
    while True:
        value = input(f"{prompt}{suffix}").strip().lower()
        if not value:
            return default_yes
        if value in {"y", "yes"}:
            return True
        if value in {"n", "no"}:
            return False
        print("Please answer y or n.")


def choose_from_list(prompt: str, options: list[tuple[str, str]], allow_cancel: bool = True) -> str | None:
    if not options:
        print("No options available.")
        return None

    for index, (_, label) in enumerate(options, start=1):
        print(f"{index}. {label}")

    if allow_cancel:
        print("0. Cancel")

    while True:
        choice = ask_int(prompt, minimum=0 if allow_cancel else 1, maximum=len(options))
        if allow_cancel and choice == 0:
            return None
        return options[choice - 1][0]


def format_percent(value: int | float | Decimal) -> str:
    return f"{float(value):.2f}%"


def format_duration_seconds(total_seconds: int) -> str:
    if total_seconds <= 0:
        return "0s"

    if total_seconds < 60:
        return f"{total_seconds}s"

    if total_seconds < 3600:
        minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{minutes:02d}:{seconds:02d}"

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def format_duration_from_datetimes(started_at: datetime | None, finished_at: datetime | None) -> str:
    if not started_at:
        return "0s"

    end = finished_at or datetime.now(tz=started_at.tzinfo)
    delta_seconds = int((end - started_at).total_seconds())
    return format_duration_seconds(delta_seconds)


def print_rows(rows: list[dict], limit: int = 100) -> None:
    if not rows:
        print("No rows found.")
        return

    for index, row in enumerate(rows[:limit], start=1):
        payload = {key: _jsonify(value) for key, value in row.items()}
        print(f"[{index}] {json.dumps(payload, default=str, ensure_ascii=False)}")

    if len(rows) > limit:
        print(f"... truncated to first {limit} rows.")


def print_start_footer() -> None:
    print("\n" + "-" * 72)
    print("OpenMath v1.5 CLI")
    print("GitHub Source: https://github.com/attilamacskasy/openmath")
    print("Attila Macskasy · March 2026")
    print("Python CLI + PostgreSQL  |  Mirrors Nuxt web app core flows")
    print("-" * 72)


def _jsonify(value):
    if isinstance(value, Decimal):
        return float(value)
    return value
