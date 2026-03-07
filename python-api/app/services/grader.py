"""Answer grading logic – supports JSONB response types."""

import re
from typing import Any


def grade_answer(prompt: dict | None, response: dict | None, correct_value: Any) -> bool:
    """Grade student response based on answer type.

    Supports: int, text, tuple, choice, fraction.
    """
    if response is None:
        return False

    answer_type = "int"
    if prompt and "answer" in prompt:
        answer_type = prompt["answer"].get("type", "int")

    parsed = response.get("parsed", {})

    if answer_type == "int":
        try:
            return int(parsed.get("value", 0)) == int(correct_value)
        except (ValueError, TypeError):
            return False

    if answer_type == "text":
        student = _normalize_text(str(parsed.get("value", "")))
        expected = _normalize_text(str(correct_value))
        return student == expected

    if answer_type == "tuple":
        student_str = str(parsed.get("value", ""))
        expected_str = str(correct_value)
        return _compare_tuple(student_str, expected_str)

    if answer_type == "choice":
        expected = _determine_expected_choice(prompt or {})
        return parsed.get("value") == expected

    if answer_type == "fraction":
        num = parsed.get("num")
        den = parsed.get("den")
        if num is None or den is None or den == 0:
            return False
        try:
            return num / den == float(correct_value)
        except (ValueError, TypeError):
            return False

    return False


def _normalize_text(s: str) -> str:
    """Normalize whitespace and case for text comparison."""
    return re.sub(r"\s+", " ", s.strip().upper())


def _compare_tuple(student: str, expected: str) -> bool:
    """Compare comma-separated int tuples."""
    try:
        student_vals = [int(x.strip()) for x in student.split(",") if x.strip()]
        expected_vals = [int(x.strip()) for x in expected.split(",") if x.strip()]
        return student_vals == expected_vals
    except ValueError:
        return False


def _determine_expected_choice(prompt: dict) -> str:
    template = prompt.get("template", {})
    if template.get("kind") == "compare":
        left = template.get("left", 0)
        right = template.get("right", 0)
        if left < right:
            return "<"
        elif left > right:
            return ">"
        return "="
    return ""
