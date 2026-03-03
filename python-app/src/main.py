from __future__ import annotations

from datetime import datetime

from db import get_connection
import repositories as repo
import services
from app_types import AppState
import views


def ensure_quiz_type_integrity(interactive: bool = True) -> None:
    try:
        with get_connection() as conn:
            audit = services.ensure_required_quiz_types(conn, apply_changes=False)
    except Exception as exc:
        print(f"Warning: quiz type integrity check skipped ({exc})")
        return

    if not audit["missing_codes"]:
        if interactive:
            print("Quiz type integrity check: OK")
        return

    print("Missing required quiz types:")
    for code in audit["missing_codes"]:
        print(f"- {code}")

    if not interactive:
        return

    if not views.ask_yes_no("Seed missing quiz types now?", default_yes=True):
        return

    with get_connection() as conn:
        fixed = services.ensure_required_quiz_types(conn, apply_changes=True)

    print("Quiz types ensured:")
    for row in fixed["rows"]:
        print(f"- {row['code']} ({row['description']})")


def get_active_student_display(state: AppState) -> str:
    if not state.active_student_id:
        return "No student"

    with get_connection() as conn:
        student = repo.get_student_profile(conn, state.active_student_id)

    if not student:
        state.active_student_id = None
        return "No student"

    return student["name"]


def prompt_difficulty() -> str:
    while True:
        difficulty = views.ask_text("Difficulty (low/medium/hard): ").lower()
        if services.is_difficulty(difficulty):
            return difficulty
        print("Please choose: low, medium, or hard.")


def prompt_gender(allow_empty: bool) -> str | None:
    print("Gender options: female, male, other, prefer_not_say")
    while True:
        raw = views.ask_text("Gender: ", allow_empty=allow_empty).lower()
        if not raw and allow_empty:
            return None
        if raw in services.ALLOWED_GENDERS:
            return raw
        print("Invalid gender.")


def prompt_learned_timetables(default_values: list[int] | None = None) -> list[int]:
    default_label = ",".join(str(value) for value in (default_values or services.DEFAULT_LEARNED_TIMETABLES))
    print("Enter learned timetables as comma-separated numbers in 1..10")
    while True:
        raw = views.ask_text(f"Learned timetables [{default_label}]: ", allow_empty=True)
        if not raw:
            values = default_values or services.DEFAULT_LEARNED_TIMETABLES
            return services.sanitize_learned_timetables(values)

        try:
            values = [int(item.strip()) for item in raw.split(",") if item.strip()]
        except ValueError:
            print("Please type numbers separated by commas.")
            continue

        sanitized = services.sanitize_learned_timetables(values)
        if not sanitized:
            print("Select at least one learned timetable.")
            continue
        return sanitized


def choose_quiz_type() -> str | None:
    with get_connection() as conn:
        quiz_types = repo.list_quiz_types(conn)

    return views.choose_from_list(
        "Choose quiz type: ",
        [(row["code"], f"{row['description']} ({row['code']})") for row in quiz_types],
    )


def start_quiz(state: AppState) -> None:
    views.print_header("Start Quiz")
    quiz_type_code = choose_quiz_type()
    if not quiz_type_code:
        return

    difficulty = prompt_difficulty()
    total_questions = views.ask_int("Total questions (1-30, default 10): ", minimum=1, maximum=30, default=10)

    student_id = state.active_student_id
    student_name = None
    student_age = None
    student_gender = None
    learned_timetables = None

    if not student_id:
        student_name = views.ask_text("New student name: ")
        student_age_raw = views.ask_text("Age (blank to skip): ", allow_empty=True)
        if student_age_raw:
            try:
                student_age = int(student_age_raw)
            except ValueError:
                print("Invalid age, skipping.")
                student_age = None

        student_gender = prompt_gender(allow_empty=True) or "prefer_not_say"
        learned_timetables = prompt_learned_timetables()

    with get_connection() as conn:
        payload = services.create_session_with_questions(
            conn,
            difficulty=difficulty,
            total_questions=total_questions,
            student_id=student_id,
            student_name=student_name,
            student_age=student_age,
            student_gender=student_gender,
            learned_timetables=learned_timetables,
            quiz_type_code=quiz_type_code,
        )

    run_quiz_session(payload["sessionId"])


def run_quiz_session(session_id: str) -> None:
    with get_connection() as conn:
        detail = services.get_session_detail(conn, session_id)
        if not detail:
            print("Session not found.")
            return

        session = detail["session"]
        total = session["totalQuestions"]
        pending_questions = [row for row in detail["questions"] if not row["answer"]]
        answered_count = total - len(pending_questions)

        print(f"\nQuiz type: {session['quizTypeCode'] or '-'}")

        for index, question in enumerate(pending_questions, start=1):
            print(f"\nProgress: {answered_count + index - 1} / {total} answered")

            if question["c"] is not None and question["d"] is not None:
                prompt = f"Question {question['position']}/{total}: What is ({question['a']} x {question['b']}) + ({question['c']} x {question['d']})? "
            else:
                prompt = f"Question {question['position']}/{total}: What is {question['a']} x {question['b']}? "

            value = views.ask_int(prompt)
            result = services.submit_answer(conn, question["id"], value)
            if not result:
                print("Could not submit answer.")
                continue

            if result["isCorrect"]:
                print("Correct!")
            else:
                print(f"Wrong, correct answer is {result['correctValue']}.")

        refreshed = services.get_session_detail(conn, session_id)
        if not refreshed:
            return

        summary = refreshed["session"]
        print("\nSession Summary")
        print(f"Correct: {summary['correctCount']}")
        print(f"Wrong: {summary['wrongCount']}")
        print(f"Score: {summary['scorePercent']:.2f}%")


def resume_quiz(state: AppState) -> None:
    views.print_header("Resume In-Progress Quiz")
    with get_connection() as conn:
        sessions = [row for row in services.list_sessions(conn) if row["finished_at"] is None]

    if state.active_student_id:
        sessions = [row for row in sessions if row["student_id"] == state.active_student_id]

    if not sessions:
        print("No in-progress sessions.")
        return

    session_id = views.choose_from_list(
        "Select session: ",
        [
            (
                row["id"],
                f"{row['id']} | {row['quiz_type_code']} | {row['student_name'] or '-'} | {row['difficulty']}",
            )
            for row in sessions
        ],
    )
    if not session_id:
        return

    run_quiz_session(session_id)


def history(state: AppState) -> None:
    views.print_header("History")
    only_active = views.ask_yes_no("Show only active student results?", default_yes=True)

    with get_connection() as conn:
        sessions = services.list_sessions(conn)
        quiz_types = repo.list_quiz_types(conn)

    if only_active and state.active_student_id:
        sessions = [row for row in sessions if row["student_id"] == state.active_student_id]

    if not quiz_types:
        print("No quiz types available.")
        return

    for quiz_type in quiz_types:
        code = quiz_type["code"]
        print(f"\n{quiz_type['description']} ({code})")
        group = [row for row in sessions if row["quiz_type_code"] == code]

        if not group:
            print("  No sessions yet for this quiz type.")
            continue

        for row in group:
            duration = views.format_duration_from_datetimes(row["started_at"], row["finished_at"])
            avg_seconds = 0
            if row["total_questions"] > 0:
                started = row["started_at"]
                finished = row["finished_at"] or datetime.now(tz=started.tzinfo)
                delta = int((finished - started).total_seconds()) if finished > started else 0
                avg_seconds = max(0, delta // row["total_questions"])

            avg = views.format_duration_seconds(avg_seconds)
            finished_label = row["finished_at"].isoformat(sep=" ", timespec="seconds") if row["finished_at"] else "In progress"

            print(
                f"- {row['id']} | student={row['student_name'] or '-'} | diff={row['difficulty']} | "
                f"questions={row['total_questions']} | score={row['score_percent']:.2f}% | "
                f"time={duration} | avg={avg} | finished={finished_label}"
            )


def session_detail() -> None:
    views.print_header("Session Detail")
    session_id = views.ask_text("Session id: ")

    with get_connection() as conn:
        detail = services.get_session_detail(conn, session_id)

    if not detail:
        print("Session not found.")
        return

    session = detail["session"]
    print(f"Session: {session['id']}")
    print(f"Student: {session['studentName'] or '-'}")
    print(f"Correct/Wrong: {session['correctCount']} / {session['wrongCount']}")
    print(f"Score: {session['scorePercent']:.2f}%")

    for row in detail["questions"]:
        question_text = (
            f"({row['a']} x {row['b']}) + ({row['c']} x {row['d']})"
            if row["c"] is not None and row["d"] is not None
            else f"{row['a']} x {row['b']}"
        )
        answer_value = row["answer"]["value"] if row["answer"] else "—"
        status = "Pending"
        if row["answer"]:
            status = "Correct" if row["answer"]["isCorrect"] else "Wrong"
        print(f"#{row['position']}: {question_text} | correct={row['correct']} | student={answer_value} | {status}")


def active_student_menu(state: AppState) -> None:
    views.print_header("Active Student")
    with get_connection() as conn:
        students = repo.list_students(conn)

    if state.active_student_id:
        current = next((row for row in students if row["id"] == state.active_student_id), None)
        print(f"Current active student: {(current['name'] if current else '-')}")
    else:
        print("Current active student: No student")

    options = [("", "No student")] + [(row["id"], row["name"]) for row in students]
    selected = views.choose_from_list("Select active student: ", options)
    if selected is None:
        return

    state.active_student_id = selected or None
    print("Active student updated.")


def profile(state: AppState) -> None:
    views.print_header("Profile")
    if not state.active_student_id:
        print("Select an active student first.")
        return

    with get_connection() as conn:
        student = repo.get_student_profile(conn, state.active_student_id)
        if not student:
            print("Student not found.")
            state.active_student_id = None
            return

        stats = services.get_student_performance_stats(conn, state.active_student_id)

        print(f"Name: {student['name']}")
        print(f"Age: {student['age']}")
        print(f"Gender: {student['gender']}")
        print(f"Learned timetables: {student['learned_timetables']}")

        if views.ask_yes_no("Edit profile?", default_yes=False):
            new_name = views.ask_text(f"Name [{student['name']}]: ", allow_empty=True) or student["name"]

            age_input = views.ask_text(f"Age [{student['age'] if student['age'] is not None else ''}]: ", allow_empty=True)
            new_age = student["age"] if age_input == "" else int(age_input)

            gender_input = views.ask_text(
                f"Gender [{student['gender'] or 'prefer_not_say'}] (female/male/other/prefer_not_say or blank): ",
                allow_empty=True,
            )
            new_gender = student["gender"] if gender_input == "" else gender_input
            if new_gender not in services.ALLOWED_GENDERS:
                new_gender = None

            new_tables = prompt_learned_timetables(student["learned_timetables"])

            updated = repo.update_student_profile(
                conn,
                state.active_student_id,
                {
                    "name": new_name.strip(),
                    "age": new_age,
                    "gender": new_gender,
                    "learned_timetables": new_tables,
                },
            )
            if updated:
                print("Profile saved.")

        print("\nPerformance (All quizzes)")
        overall = stats["overall"]
        print(
            f"sessions={overall['sessions']} | completed={overall['completed_sessions']} | in_progress={overall['in_progress_sessions']} | "
            f"questions={overall['total_questions']} | correct/wrong={overall['correct_answers']}/{overall['wrong_answers']} | "
            f"avg_score={overall['average_score_percent']:.2f}% | total_time={views.format_duration_seconds(overall['total_time_seconds'])}"
        )

        print("\nPerformance by quiz type")
        for row in stats["by_quiz_type"]:
            print(
                f"- {row['quiz_type_description']} ({row['quiz_type_code']}) | sessions={row['sessions']} | "
                f"completed={row['completed_sessions']} | in_progress={row['in_progress_sessions']} | "
                f"avg_score={row['average_score_percent']:.2f}% | total_time={views.format_duration_seconds(row['total_time_seconds'])}"
            )


def user_guide() -> None:
    views.print_header("User Guide")
    print("1) Select Active student or keep No student.")
    print("2) Start quiz: choose quiz type, difficulty, and question count.")
    print("3) Answer all questions; results are stored in PostgreSQL.")
    print("4) Use History and Session detail for review and audit trail.")
    print("5) Use Profile to edit student fields and view performance stats.")
    print("6) Use Database statistics and Danger zone carefully.")


def database_statistics() -> None:
    views.print_header("Database Statistics")
    with get_connection() as conn:
        stats = repo.get_database_statistics(conn)

    print(
        f"quiz_types={stats['quiz_types']}, students={stats['students']}, quiz_sessions={stats['quiz_sessions']}, "
        f"questions={stats['questions']}, answers={stats['answers']}"
    )

    if not views.ask_yes_no("Browse a table?", default_yes=False):
        return

    table = views.choose_from_list("Select table: ", [(name, name) for name in repo.ALLOWED_STATS_TABLES])
    if not table:
        return

    with get_connection() as conn:
        rows = repo.get_database_table_rows(conn, table)
    views.print_rows(rows)


def danger_zone() -> None:
    views.print_header("Danger Zone")
    print("This will delete all rows in students, quiz_sessions, questions, and answers.")
    confirmation = views.ask_text("Type DELETE ALL DATA to confirm: ", allow_empty=True)
    if confirmation != "DELETE ALL DATA":
        print("Confirmation mismatch. Canceled.")
        return

    with get_connection() as conn:
        repo.delete_all_schema_data(conn)
    print("All data deleted.")


def main() -> None:
    state = AppState()
    ensure_quiz_type_integrity(interactive=True)

    while True:
        try:
            active_student_display = get_active_student_display(state)
            views.print_header("OpenMath CLI")
            print(f"Active student: {active_student_display}")
            print("1. Start quiz")
            print("2. Resume in-progress quiz")
            print("3. History")
            print("4. Session detail")
            print("5. Active student")
            print("6. Profile")
            print("7. User guide")
            print("8. Database statistics")
            print("9. Danger zone")
            print("10. Ensure quiz types")
            print("0. Exit")
            views.print_start_footer()

            choice = views.ask_int("Select option: ", minimum=0, maximum=10)
            if choice == 0:
                print("Goodbye.")
                return
            if choice == 1:
                start_quiz(state)
            elif choice == 2:
                resume_quiz(state)
            elif choice == 3:
                history(state)
            elif choice == 4:
                session_detail()
            elif choice == 5:
                active_student_menu(state)
            elif choice == 6:
                profile(state)
            elif choice == 7:
                user_guide()
            elif choice == 8:
                database_statistics()
            elif choice == 9:
                danger_zone()
            elif choice == 10:
                ensure_quiz_type_integrity(interactive=True)
        except KeyboardInterrupt:
            print("\nCanceled by user.")
        except EOFError:
            print("\nInput stream closed. Exiting.")
            return
        except Exception as exc:
            print(f"Error: {exc}")


if __name__ == "__main__":
    main()