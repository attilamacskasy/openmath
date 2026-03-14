"""Multiplayer REST API router (v4.0)."""

import random
import string
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user, require_admin
from app.queries import (
    check_game_code_exists,
    create_multiplayer_game,
    delete_multiplayer_game,
    get_chat_messages,
    get_multiplayer_answers,
    get_multiplayer_game_by_code,
    get_multiplayer_history_for_user,
    get_multiplayer_history_for_users,
    get_multiplayer_player_count,
    get_multiplayer_players,
    get_multiplayer_questions,
    get_quiz_type_by_code,
    get_user_roles,
    insert_multiplayer_questions,
    is_parent_of_student,
    is_teacher_of_student,
    join_multiplayer_game,
    leave_multiplayer_game,
    list_all_multiplayer_games,
    list_parent_children,
    list_teacher_students,
    list_waiting_games,
)
from app.schemas.multiplayer import CreateGameRequest
from app.services.generator import generate_questions

router = APIRouter(prefix="/multiplayer", tags=["multiplayer"])


def _generate_game_code() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"MATH-{suffix}"


async def _unique_game_code() -> str:
    for _ in range(20):
        code = _generate_game_code()
        if not await check_game_code_exists(code):
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique game code")


# ── Game CRUD ────────────────────────────────────────


@router.post("/games")
async def create_game(
    body: CreateGameRequest,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Create a new multiplayer game. The creator becomes the host."""
    if body.max_players < body.min_players:
        raise HTTPException(status_code=400, detail="maxPlayers must be >= minPlayers")
    if body.penalty_seconds not in (5, 10, 20):
        raise HTTPException(status_code=400, detail="penaltySeconds must be 5, 10, or 20")

    quiz_type = await get_quiz_type_by_code(body.quiz_type_code)
    if not quiz_type:
        raise HTTPException(status_code=400, detail=f"Unknown quiz type: {body.quiz_type_code}")

    game_code = await _unique_game_code()

    game = await create_multiplayer_game(
        game_code=game_code,
        host_user_id=user["sub"],
        quiz_type_id=quiz_type["id"],
        difficulty=body.difficulty,
        total_questions=body.total_questions,
        penalty_seconds=body.penalty_seconds,
        min_players=body.min_players,
        max_players=body.max_players,
        learned_timetables=body.learned_timetables,
    )

    # Generate shared question set
    template_kind = quiz_type.get("template_kind") or "axb"
    generated = generate_questions(
        difficulty=body.difficulty,
        total_questions=body.total_questions,
        quiz_type_code=body.quiz_type_code,
        template_kind=template_kind,
        learned_timetables=body.learned_timetables or list(range(1, 11)),
    )
    await insert_multiplayer_questions(game["id"], quiz_type["id"], generated)

    return {
        "gameCode": game["game_code"],
        "gameId": game["id"],
        "status": game["status"],
    }


@router.get("/games")
async def list_games(user: dict[str, Any] = Depends(get_current_user)):
    """List games currently waiting for players."""
    return await list_waiting_games()


@router.get("/games/{code}")
async def get_game(code: str, user: dict[str, Any] = Depends(get_current_user)):
    """Get game details by code."""
    game = await get_multiplayer_game_by_code(code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    players = await get_multiplayer_players(game["id"])
    return {"game": game, "players": players}


@router.post("/games/{code}/join")
async def join_game(code: str, user: dict[str, Any] = Depends(get_current_user)):
    """Join a waiting game as a player."""
    game = await get_multiplayer_game_by_code(code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game is not accepting players")
    if game["host_user_id"] == user["sub"]:
        raise HTTPException(status_code=400, detail="Host cannot join as a player")

    player_count = await get_multiplayer_player_count(game["id"])
    if player_count >= game["max_players"]:
        raise HTTPException(status_code=400, detail="Game is full")

    # Check if already joined
    players = await get_multiplayer_players(game["id"])
    if any(p["user_id"] == user["sub"] for p in players):
        raise HTTPException(status_code=400, detail="Already joined this game")

    player = await join_multiplayer_game(game["id"], user["sub"])
    return {"player": player, "gameCode": code}


@router.delete("/games/{code}/leave")
async def leave_game(code: str, user: dict[str, Any] = Depends(get_current_user)):
    """Leave a game (only in waiting status)."""
    game = await get_multiplayer_game_by_code(code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Cannot leave after game started")

    removed = await leave_multiplayer_game(game["id"], user["sub"])
    if not removed:
        raise HTTPException(status_code=404, detail="Not in this game")
    return {"left": True, "gameCode": code}


# ── History ──────────────────────────────────────────


@router.get("/history")
async def get_history(user: dict[str, Any] = Depends(get_current_user)):
    """List multiplayer game history. Role-filtered visibility."""
    user_roles = await get_user_roles(user["sub"])

    if "admin" in user_roles:
        # Admin sees all completed/ended games
        return await get_multiplayer_history_for_user(user["sub"])

    # Collect user IDs: own + associated students/children
    user_ids = [user["sub"]]
    if "teacher" in user_roles:
        students = await list_teacher_students(user["sub"])
        user_ids.extend(str(s["id"]) for s in students)
    if "parent" in user_roles:
        children = await list_parent_children(user["sub"])
        user_ids.extend(str(c["id"]) for c in children)

    user_ids = list(dict.fromkeys(user_ids))
    if len(user_ids) == 1:
        return await get_multiplayer_history_for_user(user_ids[0])
    return await get_multiplayer_history_for_users(user_ids)


@router.get("/history/{code}")
async def get_history_detail(code: str, user: dict[str, Any] = Depends(get_current_user)):
    """Game detail with results, answers, and chat."""
    game = await get_multiplayer_game_by_code(code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Access check: host, participant, teacher/parent of participant, or admin
    user_roles = await get_user_roles(user["sub"])
    players = await get_multiplayer_players(game["id"])
    player_user_ids = [p["user_id"] for p in players]

    is_host = game["host_user_id"] == user["sub"]
    is_player = user["sub"] in player_user_ids
    is_admin = "admin" in user_roles

    if not (is_host or is_player or is_admin):
        # Check teacher/parent relationship
        is_related = False
        if "teacher" in user_roles:
            for pid in player_user_ids:
                if await is_teacher_of_student(user["sub"], pid):
                    is_related = True
                    break
        if not is_related and "parent" in user_roles:
            for pid in player_user_ids:
                if await is_parent_of_student(user["sub"], pid):
                    is_related = True
                    break
        if not is_related:
            raise HTTPException(status_code=403, detail="Access denied")

    questions = await get_multiplayer_questions(game["id"])
    answers = await get_multiplayer_answers(game["id"])
    chat = await get_chat_messages(game["id"])

    # Only reveal correct answers if game is completed/ended and user is host/teacher/admin
    show_answers = game["status"] in ("completed", "ended") and (is_host or is_admin or "teacher" in user_roles)
    if not show_answers:
        for q in questions:
            q.pop("correct", None)

    return {
        "game": game,
        "players": players,
        "questions": questions,
        "answers": answers,
        "chat": chat,
    }


# ── Admin ────────────────────────────────────────────


@router.get("/admin/games")
async def admin_list_games(user: dict[str, Any] = Depends(require_admin)):
    """Admin: list all multiplayer games."""
    return await list_all_multiplayer_games()


@router.delete("/admin/games/{code}")
async def admin_delete_game(code: str, user: dict[str, Any] = Depends(require_admin)):
    """Admin: delete a multiplayer game."""
    game = await get_multiplayer_game_by_code(code)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    deleted = await delete_multiplayer_game(game["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Game not found")
    return {"deleted": True, "gameCode": code}
