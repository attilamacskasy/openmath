import random

QUESTION_COUNT = 10
DIFFICULTY_FACTORS = {
    "low": [1, 5, 10],
    "medium": [1, 2, 3, 4, 5, 6, 10],
    "hard": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}


def ask_difficulty():
    print("Multiplication Practice")
    print("Choose difficulty: low, medium, hard")

    while True:
        difficulty = input("Difficulty: ").strip().lower()
        if difficulty in DIFFICULTY_FACTORS:
            return difficulty
        print("Please choose: low, medium, or hard.")


def ask_integer(prompt):
    while True:
        raw_value = input(prompt).strip()
        try:
            return int(raw_value)
        except ValueError:
            print("Please type a number.")


def generate_question(difficulty):
    focus_factor = random.choice(DIFFICULTY_FACTORS[difficulty])
    other_factor = random.randint(1, 10)

    if random.choice([True, False]):
        return focus_factor, other_factor
    return other_factor, focus_factor


def run_quiz(question_count=QUESTION_COUNT):
    difficulty = ask_difficulty()
    correct_answers = 0

    print(f"\nStarting {difficulty} quiz with {question_count} questions.\n")

    for question_index in range(1, question_count + 1):
        left, right = generate_question(difficulty)
        answer = ask_integer(f"{question_index}. What is {left} x {right}? ")

        if answer == left * right:
            correct_answers += 1
            print("Correct!\n")
        else:
            print(f"Not quite. The correct answer is {left * right}.\n")

    wrong_answers = question_count - correct_answers
    score_percent = round((correct_answers / question_count) * 100)

    print("Quiz complete!")
    print(f"Correct: {correct_answers} / {question_count}")
    print(f"Wrong: {wrong_answers}")
    print(f"Score: {score_percent}%")


if __name__ == "__main__":
    run_quiz()