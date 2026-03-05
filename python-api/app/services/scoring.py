"""Scoring utilities."""


def calculate_percent(correct_count: int, total_questions: int) -> float:
    """Calculate score as percentage with 2 decimal precision."""
    if total_questions <= 0:
        return 0.0
    return round((correct_count / total_questions) * 100, 2)
