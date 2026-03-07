"""Question generator – produces JSONB prompt payloads for all quiz types."""

import random
from typing import Any, Callable

from app.services.difficulty import DIFFICULTY_SETS, sanitize_learned_timetables
from app.services.roman import int_to_roman, roman_to_int


# ── Helper ──────────────────────────────────────────────────

def _pick_factors(focus_set: list[int], learned_set: list[int]) -> tuple[int, int]:
    focus_factor = random.choice(focus_set) if focus_set else (learned_set[0] if learned_set else 1)
    other_factor = random.choice(learned_set) if learned_set else 1
    if random.random() < 0.5:
        return other_factor, focus_factor
    return focus_factor, other_factor


def _make_prompt(kind: str, answer_type: str, render: str, **extra: Any) -> dict[str, Any]:
    """Build a JSONB prompt dict."""
    return {
        "template": {"kind": kind, **extra},
        "answer": {"type": answer_type},
        "render": render,
    }


# ── Individual generators ──────────────────────────────────

def _gen_axb(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a, b = _pick_factors(focus, learned)
    return {"prompt": _make_prompt("axb", "int", f"{a} × {b}", a=a, b=b), "correct": a * b, "a": a, "b": b, "c": None, "d": None}


def _gen_axb_plus_cxd(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a, b = _pick_factors(focus, learned)
    c, d = _pick_factors(focus, learned)
    return {"prompt": _make_prompt("axb_plus_cxd", "int", f"({a} × {b}) + ({c} × {d})", a=a, b=b, c=c, d=d), "correct": (a * b) + (c * d), "a": a, "b": b, "c": c, "d": d}


def _gen_a_plus_b(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(1, 18)
    b = random.randint(1, 20 - a)
    return {"prompt": _make_prompt("a_plus_b", "int", f"{a} + {b}", a=a, b=b), "correct": a + b, "a": a, "b": b, "c": None, "d": None}


def _gen_a_minus_b(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(2, 20)
    b = random.randint(1, a)
    return {"prompt": _make_prompt("a_minus_b", "int", f"{a} − {b}", a=a, b=b), "correct": a - b, "a": a, "b": b, "c": None, "d": None}


def _gen_round_tens_add(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    tens = list(range(10, 100, 10))
    a = random.choice(tens)
    valid_b = [x for x in tens if a + x <= 100]
    b = random.choice(valid_b) if valid_b else 10
    return {"prompt": _make_prompt("round_tens_add", "int", f"{a} + {b}", a=a, b=b), "correct": a + b, "a": a, "b": b, "c": None, "d": None}


def _gen_round_tens_sub(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.choice(list(range(20, 100, 10)))
    valid_b = list(range(10, a + 1, 10))
    b = random.choice(valid_b) if valid_b else 10
    return {"prompt": _make_prompt("round_tens_sub", "int", f"{a} − {b}", a=a, b=b), "correct": a - b, "a": a, "b": b, "c": None, "d": None}


def _gen_a_plus_b_100(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(10, 98)
    b = random.randint(1, 100 - a)
    return {"prompt": _make_prompt("a_plus_b_100", "int", f"{a} + {b}", a=a, b=b), "correct": a + b, "a": a, "b": b, "c": None, "d": None}


def _gen_a_minus_b_100(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(11, 100)
    b = random.randint(1, a)
    return {"prompt": _make_prompt("a_minus_b_100", "int", f"{a} − {b}", a=a, b=b), "correct": a - b, "a": a, "b": b, "c": None, "d": None}


def _gen_two_plus_one(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(10, 93)
    b = random.randint(1, 9)
    return {"prompt": _make_prompt("two_plus_one", "int", f"{a} + {b}", a=a, b=b), "correct": a + b, "a": a, "b": b, "c": None, "d": None}


def _gen_two_minus_one(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(11, 99)
    max_b = min(9, a - 10)
    b = random.randint(1, max(1, max_b))
    return {"prompt": _make_prompt("two_minus_one", "int", f"{a} − {b}", a=a, b=b), "correct": a - b, "a": a, "b": b, "c": None, "d": None}


def _gen_times_table(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    # Extract fixed factor from quiz code: times_table_3 → 3, times_table_4 → 4, etc.
    parts = quiz_type_code.rsplit("_", 1)
    fixed = int(parts[-1]) if parts[-1].isdigit() else 3
    b = random.randint(1, 10)
    return {"prompt": _make_prompt("times_table", "int", f"{fixed} × {b}", a=fixed, b=b), "correct": fixed * b, "a": fixed, "b": b, "c": None, "d": None}


def _gen_a_div_b(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    b = random.randint(2, 10)
    quotient = random.randint(1, 10)
    a = b * quotient
    return {"prompt": _make_prompt("a_div_b", "int", f"{a} ÷ {b}", a=a, b=b), "correct": quotient, "a": a, "b": b, "c": None, "d": None}


def _gen_a_div_b_rem(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    b = random.randint(2, 9)
    quotient = random.randint(1, 10)
    remainder = random.randint(1, b - 1)
    a = b * quotient + remainder
    correct_str = f"{quotient} r {remainder}"
    return {"prompt": _make_prompt("a_div_b_rem", "text", f"{a} ÷ {b}", a=a, b=b), "correct": correct_str, "a": a, "b": b, "c": None, "d": None}


def _gen_double(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(2, 50)
    return {"prompt": _make_prompt("double", "int", f"2 × {a}", a=2, b=a), "correct": 2 * a, "a": 2, "b": a, "c": None, "d": None}


def _gen_count_by_n(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    step = 2 if "count_by_2" in quiz_type_code else 5
    max_start = 80 if step == 2 else 75
    start = random.randrange(step, max_start + 1, step)
    shown = [start, start + step, start + 2 * step]
    ans1 = start + 3 * step
    ans2 = start + 4 * step
    render = f"{shown[0]}, {shown[1]}, {shown[2]}, __, __"
    correct_str = f"{ans1}, {ans2}"
    return {"prompt": _make_prompt("count_by_n", "tuple", render, step=step, start=start), "correct": correct_str, "a": start, "b": step, "c": None, "d": None}


def _gen_roman_to_int(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    n = random.randint(1, 100)
    roman = int_to_roman(n)
    return {"prompt": _make_prompt("roman_to_int", "int", f"{roman} = ?", n=n), "correct": n, "a": n, "b": None, "c": None, "d": None}


def _gen_int_to_roman(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    n = random.randint(1, 100)
    roman = int_to_roman(n)
    return {"prompt": _make_prompt("int_to_roman", "text", f"{n} = ?", n=n), "correct": roman, "a": n, "b": None, "c": None, "d": None}


def _gen_dm_to_cm(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(1, 10)
    return {"prompt": _make_prompt("dm_to_cm", "int", f"{a} dm = ? cm", a=a), "correct": a * 10, "a": a, "b": None, "c": None, "d": None}


def _gen_m_to_cm(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(1, 10)
    return {"prompt": _make_prompt("m_to_cm", "int", f"{a} m = ? cm", a=a), "correct": a * 100, "a": a, "b": None, "c": None, "d": None}


def _gen_length_add(quiz_type_code: str, difficulty: str, learned: list[int], focus: list[int]) -> dict[str, Any]:
    a = random.randint(10, 90)
    b = random.randint(1, 100 - a)
    return {"prompt": _make_prompt("length_add", "int", f"{a} cm + {b} cm = ? cm", a=a, b=b), "correct": a + b, "a": a, "b": b, "c": None, "d": None}


# ── Generator registry ──────────────────────────────────────

GENERATORS: dict[str, Callable[..., dict[str, Any]]] = {
    "axb": _gen_axb,
    "axb_plus_cxd": _gen_axb_plus_cxd,
    "a_plus_b": _gen_a_plus_b,
    "a_minus_b": _gen_a_minus_b,
    "round_tens_add": _gen_round_tens_add,
    "round_tens_sub": _gen_round_tens_sub,
    "a_plus_b_100": _gen_a_plus_b_100,
    "a_minus_b_100": _gen_a_minus_b_100,
    "two_plus_one": _gen_two_plus_one,
    "two_minus_one": _gen_two_minus_one,
    "times_table": _gen_times_table,
    "a_div_b": _gen_a_div_b,
    "a_div_b_rem": _gen_a_div_b_rem,
    "double": _gen_double,
    "count_by_n": _gen_count_by_n,
    "roman_to_int": _gen_roman_to_int,
    "int_to_roman": _gen_int_to_roman,
    "dm_to_cm": _gen_dm_to_cm,
    "m_to_cm": _gen_m_to_cm,
    "length_add": _gen_length_add,
}


# ── Public API ───────────────────────────────────────────────

def generate_questions(
    difficulty: str,
    total_questions: int,
    quiz_type_code: str,
    template_kind: str,
    learned_timetables: list[int],
) -> list[dict[str, Any]]:
    """Generate question dicts with JSONB prompt structure + legacy columns."""
    learned_set = sanitize_learned_timetables(learned_timetables)
    difficulty_set = DIFFICULTY_SETS.get(difficulty, DIFFICULTY_SETS["hard"])
    focus_set = [x for x in difficulty_set if x in learned_set]
    effective_focus = focus_set if focus_set else learned_set

    gen_fn = GENERATORS.get(template_kind)
    if gen_fn is None:
        raise ValueError(f"Unknown template_kind: {template_kind}")

    seen_renders: set[str] = set()
    questions: list[dict[str, Any]] = []

    for pos in range(1, total_questions + 1):
        # Deduplicate: try up to 50 times to get a unique question
        for _ in range(50):
            q = gen_fn(quiz_type_code, difficulty, learned_set, effective_focus)
            render = q["prompt"]["render"]
            if render not in seen_renders or len(seen_renders) >= 200:
                break
        seen_renders.add(render)
        q["position"] = pos
        questions.append(q)

    return questions


def generate_preview(template_kind: str, answer_type: str, quiz_type_code: str = "") -> list[dict[str, Any]]:
    """Generate 3 sample questions for preview (no DB write)."""
    gen_fn = GENERATORS.get(template_kind)
    if gen_fn is None:
        raise ValueError(f"Unknown template_kind: {template_kind}")

    from app.services.difficulty import DIFFICULTY_SETS

    learned = list(range(1, 11))
    focus = DIFFICULTY_SETS["medium"]
    samples: list[dict[str, Any]] = []
    for _ in range(3):
        q = gen_fn(quiz_type_code, "medium", learned, focus)
        samples.append({
            "render": q["prompt"]["render"],
            "correct": str(q["correct"]),
            "answer_type": answer_type,
        })
    return samples
