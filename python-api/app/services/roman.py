"""Roman numeral conversion utilities."""

_ROMAN_PAIRS = [
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
    (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
    (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
]

_ROMAN_MAP = {
    "I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000,
}


def int_to_roman(n: int) -> str:
    """Convert an integer (1–3999) to a Roman numeral string."""
    if not 1 <= n <= 3999:
        raise ValueError(f"Value out of range: {n}")
    result: list[str] = []
    for value, numeral in _ROMAN_PAIRS:
        while n >= value:
            result.append(numeral)
            n -= value
    return "".join(result)


def roman_to_int(s: str) -> int:
    """Convert a Roman numeral string to an integer."""
    s = s.upper().strip()
    total = 0
    prev = 0
    for ch in reversed(s):
        val = _ROMAN_MAP.get(ch, 0)
        if val < prev:
            total -= val
        else:
            total += val
        prev = val
    return total
