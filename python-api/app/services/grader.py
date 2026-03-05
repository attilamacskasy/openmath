"""Answer grading logic – supports JSONB response types."""

from typing import Any


def grade_answer(prompt: dict | None, response: dict | None, correct_value: int) -> bool:
    """Grade student response based on answer type.

    For v2.0 baseline, only 'int' type is active.  Future types
    (choice, tuple, fraction, unit_int) are stubbed for when new
    quiz types are added.
    """
    if response is None:
        return False

    answer_type = "int"
    if prompt and "answer" in prompt:
        answer_type = prompt["answer"].get("type", "int")

    parsed = response.get("parsed", {})

    if answer_type == "int":
        return parsed.get("value") == correct_value

    if answer_type == "choice":
        expected = _determine_expected_choice(prompt or {})
        return parsed.get("value") == expected

    if answer_type == "tuple":
        values = parsed.get("values", [])
        constraints = (prompt or {}).get("constraints", {})
        must_sum = constraints.get("must_sum_to")
        if must_sum is not None:
            return sum(values) == must_sum
        return False

    if answer_type == "fraction":
        num = parsed.get("num")
        den = parsed.get("den")
        if num is None or den is None or den == 0:
            return False
        # Normalize: compare cross-multiplication
        # expected value stored as correct_value for simple check
        return num / den == correct_value

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
