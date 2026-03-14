"""Multiplayer game engine — GameManager, GameBroadcaster, state machine (v4.0)."""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from fastapi import WebSocket

from app.queries import (
    get_chat_messages,
    get_multiplayer_answers,
    get_multiplayer_game_by_code,
    get_multiplayer_player_count,
    get_multiplayer_players,
    get_multiplayer_questions,
    insert_chat_message,
    insert_multiplayer_answer,
    leave_multiplayer_game,
    update_game_status,
    update_player_ready,
    update_player_stats,
)
from app.services.grader import grade_answer

COUNTDOWN_SECONDS = 10
MIN_ANSWER_INTERVAL_MS = 500


# ── Broadcaster protocol (Kubernetes-ready abstraction) ──


class GameBroadcaster(Protocol):
    async def broadcast(self, game_code: str, message: dict, exclude: str | None = None) -> None: ...
    async def send_to_user(self, game_code: str, user_id: str, message: dict) -> None: ...


# ── In-process broadcaster (single-worker deployment) ──


@dataclass
class ActiveConnection:
    user_id: str
    user_name: str
    websocket: WebSocket
    is_host: bool = False


@dataclass
class ActiveGame:
    game_id: str
    game_code: str
    host_user_id: str
    status: str = "waiting"
    penalty_seconds: int = 10
    total_questions: int = 10
    connections: dict[str, ActiveConnection] = field(default_factory=dict)
    started_at: float | None = None
    last_answer_time: dict[str, float] = field(default_factory=dict)


class GameManager:
    """Singleton managing active multiplayer games in-process."""

    def __init__(self) -> None:
        self._games: dict[str, ActiveGame] = {}

    def _msg(self, msg_type: str, payload: dict | None = None) -> dict:
        return {
            "type": msg_type,
            "payload": payload or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def _broadcast(
        self, game: ActiveGame, message: dict, exclude: str | None = None
    ) -> None:
        dead: list[str] = []
        for uid, conn in game.connections.items():
            if uid == exclude:
                continue
            try:
                await conn.websocket.send_json(message)
            except Exception:
                dead.append(uid)
        for uid in dead:
            game.connections.pop(uid, None)

    async def _send_to_host(self, game: ActiveGame, message: dict) -> None:
        conn = game.connections.get(game.host_user_id)
        if conn:
            try:
                await conn.websocket.send_json(message)
            except Exception:
                game.connections.pop(game.host_user_id, None)

    async def _send_to_user(self, game: ActiveGame, user_id: str, message: dict) -> None:
        conn = game.connections.get(user_id)
        if conn:
            try:
                await conn.websocket.send_json(message)
            except Exception:
                game.connections.pop(user_id, None)

    # ── Connection management ──

    async def connect(
        self, game_code: str, user_id: str, user_name: str, websocket: WebSocket
    ) -> ActiveGame | None:
        """Register a WebSocket connection for a game."""
        game_data = await get_multiplayer_game_by_code(game_code)
        if not game_data:
            return None

        if game_code not in self._games:
            self._games[game_code] = ActiveGame(
                game_id=game_data["id"],
                game_code=game_code,
                host_user_id=game_data["host_user_id"],
                status=game_data["status"],
                penalty_seconds=game_data["penalty_seconds"],
                total_questions=game_data["total_questions"],
            )

        game = self._games[game_code]
        is_host = user_id == game.host_user_id
        game.connections[user_id] = ActiveConnection(
            user_id=user_id,
            user_name=user_name,
            websocket=websocket,
            is_host=is_host,
        )

        # Notify others
        if not is_host:
            await self._broadcast(
                game,
                self._msg("player_joined", {
                    "player": {"id": user_id, "name": user_name},
                }),
                exclude=user_id,
            )

        return game

    async def disconnect(self, game_code: str, user_id: str) -> None:
        """Handle WebSocket disconnection."""
        game = self._games.get(game_code)
        if not game:
            return

        conn = game.connections.pop(user_id, None)
        if not conn:
            return

        if game.status == "waiting":
            if user_id == game.host_user_id:
                # Host left lobby — cancel game
                await update_game_status(game.game_id, "ended")
                await self._broadcast(game, self._msg("game_ended", {}))
                self._games.pop(game_code, None)
            else:
                # Player left lobby — remove and notify
                await leave_multiplayer_game(game.game_id, user_id)
                await self._broadcast(
                    game,
                    self._msg("player_left", {"player_id": user_id}),
                )
        elif game.status in ("playing", "countdown"):
            if user_id != game.host_user_id:
                # Player disconnected during game — mark remaining questions with max penalty
                await self._handle_player_disconnect_during_game(game, user_id)
                await self._broadcast(
                    game,
                    self._msg("player_left", {"player_id": user_id}),
                )
            # Host disconnect during game: game continues autonomously

        # Clean up if no connections left
        if not game.connections:
            self._games.pop(game_code, None)

    async def _handle_player_disconnect_during_game(
        self, game: ActiveGame, user_id: str
    ) -> None:
        """Mark disconnected player's remaining questions with max penalty."""
        players = await get_multiplayer_players(game.game_id)
        player = next((p for p in players if p["user_id"] == user_id), None)
        if not player:
            return

        questions = await get_multiplayer_questions(game.game_id)
        answers = await get_multiplayer_answers(game.game_id)
        answered_q_ids = {a["question_id"] for a in answers if a["player_id"] == player["id"]}

        penalty_ms = game.penalty_seconds * 1000
        elapsed = int((time.time() - (game.started_at or time.time())) * 1000)

        for q in questions:
            if q["id"] not in answered_q_ids:
                await insert_multiplayer_answer(
                    game_id=game.game_id,
                    player_id=player["id"],
                    question_id=q["id"],
                    value=None,
                    is_correct=False,
                    lap_time_ms=elapsed,
                    penalty_ms=penalty_ms,
                )

        total_penalty = player["penalty_time_ms"] + penalty_ms * (len(questions) - len(answered_q_ids))
        await update_player_stats(
            player_id=player["id"],
            correct_count=player["correct_count"],
            wrong_count=player["wrong_count"] + (len(questions) - len(answered_q_ids)),
            penalty_time_ms=total_penalty,
            total_time_ms=elapsed + total_penalty,
            finished=True,
        )

        await self._check_game_completion(game)

    # ── Message handling ──

    async def handle_message(
        self, game_code: str, user_id: str, data: dict
    ) -> None:
        game = self._games.get(game_code)
        if not game:
            return

        msg_type = data.get("type", "")
        payload = data.get("payload", {})

        if msg_type == "player_ready":
            await self._handle_player_ready(game, user_id, payload)
        elif msg_type == "chat_message":
            await self._handle_chat_message(game, user_id, payload)
        elif msg_type == "start_game":
            await self._handle_start_game(game, user_id)
        elif msg_type == "submit_answer":
            await self._handle_submit_answer(game, user_id, payload)
        elif msg_type == "end_game":
            await self._handle_end_game(game, user_id)

    async def _handle_player_ready(
        self, game: ActiveGame, user_id: str, payload: dict
    ) -> None:
        if game.status != "waiting":
            return
        if user_id == game.host_user_id:
            return  # Host doesn't ready up

        is_ready = payload.get("ready", False)
        await update_player_ready(game.game_id, user_id, is_ready)
        await self._broadcast(
            game,
            self._msg("player_ready_changed", {
                "player_id": user_id,
                "ready": is_ready,
            }),
        )

    async def _handle_chat_message(
        self, game: ActiveGame, user_id: str, payload: dict
    ) -> None:
        text = payload.get("text", "").strip()
        if not text or len(text) > 200:
            return

        conn = game.connections.get(user_id)
        sender_name = conn.user_name if conn else "Unknown"

        await insert_chat_message(game.game_id, user_id, text)
        await self._broadcast(
            game,
            self._msg("chat_broadcast", {
                "sender": sender_name,
                "sender_id": user_id,
                "text": text,
                "time": datetime.now(timezone.utc).isoformat(),
            }),
        )

    async def _handle_start_game(self, game: ActiveGame, user_id: str) -> None:
        if user_id != game.host_user_id:
            return
        if game.status != "waiting":
            return

        players = await get_multiplayer_players(game.game_id)
        player_count = len(players)

        game_data = await get_multiplayer_game_by_code(game.game_code)
        if not game_data:
            return

        if player_count < game_data["min_players"]:
            await self._send_to_host(
                game, self._msg("error", {"message": "Not enough players"})
            )
            return

        if not all(p["is_ready"] for p in players):
            await self._send_to_host(
                game, self._msg("error", {"message": "Not all players are ready"})
            )
            return

        # Start countdown
        game.status = "countdown"
        await update_game_status(game.game_id, "countdown")

        for i in range(COUNTDOWN_SECONDS, 0, -1):
            await self._broadcast(game, self._msg("countdown_tick", {"value": i}))
            await asyncio.sleep(1)

        # Countdown finished — start game
        game.status = "playing"
        game.started_at = time.time()
        await update_game_status(game.game_id, "playing")

        questions = await get_multiplayer_questions(game.game_id)
        # Send questions WITHOUT correct answers to players
        safe_questions = [
            {
                "id": q["id"],
                "position": q["position"],
                "prompt": q.get("prompt"),
                "a": q.get("a"),
                "b": q.get("b"),
                "c": q.get("c"),
                "d": q.get("d"),
            }
            for q in questions
        ]

        await self._broadcast(
            game,
            self._msg("game_started", {"questions": safe_questions}),
        )

    async def _handle_submit_answer(
        self, game: ActiveGame, user_id: str, payload: dict
    ) -> None:
        if game.status != "playing":
            return
        if user_id == game.host_user_id:
            return

        question_id = payload.get("question_id")
        answer_value = payload.get("value")
        if not question_id:
            return

        # Anti-cheat: minimum interval between answers
        now = time.time()
        last = game.last_answer_time.get(user_id, 0)
        if (now - last) * 1000 < MIN_ANSWER_INTERVAL_MS:
            return
        game.last_answer_time[user_id] = now

        # Get player and question data
        players = await get_multiplayer_players(game.game_id)
        player = next((p for p in players if p["user_id"] == user_id), None)
        if not player:
            return

        questions = await get_multiplayer_questions(game.game_id)
        question = next((q for q in questions if q["id"] == question_id), None)
        if not question:
            return

        # Check if already answered
        existing_answers = await get_multiplayer_answers(game.game_id)
        already_answered = any(
            a["player_id"] == player["id"] and a["question_id"] == question_id
            for a in existing_answers
        )
        if already_answered:
            return

        # Grade answer
        is_correct = grade_answer(
            question.get("prompt"),
            {"parsed": {"value": answer_value}},
            question["correct"],
        )

        # Calculate times
        elapsed_ms = int((now - game.started_at) * 1000) if game.started_at else 0
        penalty_ms = 0 if is_correct else game.penalty_seconds * 1000

        await insert_multiplayer_answer(
            game_id=game.game_id,
            player_id=player["id"],
            question_id=question_id,
            value=str(answer_value) if answer_value is not None else None,
            is_correct=is_correct,
            lap_time_ms=elapsed_ms,
            penalty_ms=penalty_ms,
        )

        # Update player stats
        new_correct = player["correct_count"] + (1 if is_correct else 0)
        new_wrong = player["wrong_count"] + (0 if is_correct else 1)
        new_penalty = player["penalty_time_ms"] + penalty_ms
        total_time = elapsed_ms + new_penalty

        player_answers = [a for a in existing_answers if a["player_id"] == player["id"]]
        all_answered = len(player_answers) + 1 >= game.total_questions
        finished = all_answered

        await update_player_stats(
            player_id=player["id"],
            correct_count=new_correct,
            wrong_count=new_wrong,
            penalty_time_ms=new_penalty,
            total_time_ms=total_time if finished else None,
            finished=finished,
        )

        # Send answer_update to HOST only
        await self._send_to_host(
            game,
            self._msg("answer_update", {
                "player_id": user_id,
                "player_name": game.connections.get(user_id, ActiveConnection(user_id, "", None)).user_name,
                "question_pos": question["position"],
                "is_correct": is_correct,
                "lap_time": elapsed_ms,
                "penalty": penalty_ms,
                "total_time": total_time,
            }),
        )

        # Send answer acknowledgment to the player
        await self._send_to_user(
            game, user_id,
            self._msg("answer_result", {
                "question_id": question_id,
                "is_correct": is_correct,
                "penalty_ms": penalty_ms,
                "total_time_ms": total_time,
                "elapsed_ms": elapsed_ms,
            }),
        )

        # Recalculate positions and send to host
        await self._send_position_update(game)

        # Check if all players finished
        if finished:
            await self._check_game_completion(game)

    async def _send_position_update(self, game: ActiveGame) -> None:
        players = await get_multiplayer_players(game.game_id)
        answers = await get_multiplayer_answers(game.game_id)

        player_stats = []
        for p in players:
            p_answers = [a for a in answers if a["player_id"] == p["id"]]
            completed = len(p_answers)
            total_penalty = sum(a["penalty_ms"] for a in p_answers)
            last_lap = max((a["lap_time_ms"] for a in p_answers), default=0)
            total_time = last_lap + total_penalty
            player_stats.append({
                "player_id": p["user_id"],
                "player_name": p.get("user_name", ""),
                "completed": completed,
                "total_time": total_time,
                "finished": p.get("finished_at") is not None,
            })

        # Sort: most completed first, then lowest total time
        player_stats.sort(key=lambda x: (-x["completed"], x["total_time"]))
        for i, ps in enumerate(player_stats):
            ps["pos"] = i + 1

        await self._send_to_host(
            game, self._msg("position_update", {"positions": player_stats})
        )

    async def _check_game_completion(self, game: ActiveGame) -> None:
        players = await get_multiplayer_players(game.game_id)
        all_finished = all(p.get("finished_at") is not None for p in players)

        if not all_finished:
            return

        # Calculate final positions
        answers = await get_multiplayer_answers(game.game_id)
        player_results = []
        for p in players:
            p_answers = [a for a in answers if a["player_id"] == p["id"]]
            correct = sum(1 for a in p_answers if a["is_correct"])
            total_penalty = sum(a["penalty_ms"] for a in p_answers)
            last_lap = max((a["lap_time_ms"] for a in p_answers), default=0)
            total_time = last_lap + total_penalty
            player_results.append({
                "player_id": p["id"],
                "user_id": p["user_id"],
                "user_name": p.get("user_name", ""),
                "correct_count": correct,
                "wrong_count": len(p_answers) - correct,
                "total_time_ms": total_time,
                "penalty_time_ms": total_penalty,
            })

        # Sort: most correct, then lowest total time
        player_results.sort(key=lambda x: (-x["correct_count"], x["total_time_ms"]))

        for i, pr in enumerate(player_results):
            pr["final_position"] = i + 1
            await update_player_stats(
                player_id=pr["player_id"],
                correct_count=pr["correct_count"],
                wrong_count=pr["wrong_count"],
                penalty_time_ms=pr["penalty_time_ms"],
                total_time_ms=pr["total_time_ms"],
                final_position=pr["final_position"],
                finished=True,
            )

        game.status = "completed"
        await update_game_status(game.game_id, "completed")

        # Broadcast results to all participants
        await self._broadcast(
            game,
            self._msg("game_completed", {
                "results": [
                    {
                        "player_id": pr["user_id"],
                        "name": pr["user_name"],
                        "position": pr["final_position"],
                        "correct_count": pr["correct_count"],
                        "wrong_count": pr["wrong_count"],
                        "total_time_ms": pr["total_time_ms"],
                        "penalty_time_ms": pr["penalty_time_ms"],
                    }
                    for pr in player_results
                ],
            }),
        )

        # Evaluate badges for all players
        await self._evaluate_multiplayer_badges(game, player_results)

        # Send notifications
        await self._send_completion_notifications(game, player_results)

    async def _evaluate_multiplayer_badges(
        self, game: ActiveGame, results: list[dict]
    ) -> None:
        try:
            from app.services.badges import evaluate_multiplayer_badges
            for pr in results:
                await evaluate_multiplayer_badges(pr["user_id"], game.game_id, pr)
        except Exception:
            pass  # Badge evaluation should not break game flow

    async def _send_completion_notifications(
        self, game: ActiveGame, results: list[dict]
    ) -> None:
        try:
            from app.services.notifications import create_notification, notify_teachers_of_student

            game_data = await get_multiplayer_game_by_code(game.game_code)
            code = game.game_code

            for pr in results:
                pos = pr["final_position"]
                if pos == 1:
                    await create_notification(
                        pr["user_id"], "multiplayer_win",
                        "You won!",
                        f"You won the multiplayer game {code}!",
                        {"game_code": code},
                    )
                else:
                    await create_notification(
                        pr["user_id"], "multiplayer_result",
                        "Game completed",
                        f"Multiplayer game {code} completed. You placed #{pos}",
                        {"game_code": code, "position": pos},
                    )

                # Notify teachers
                pct = round(pr["correct_count"] / max(game.total_questions, 1) * 100)
                await notify_teachers_of_student(
                    pr["user_id"], "multiplayer_student",
                    "Student played multiplayer",
                    f"{pr['user_name']} played a multiplayer quiz (#{pos}, {pct}%)",
                    {"game_code": code, "student_id": pr["user_id"]},
                )
        except Exception:
            pass  # Notifications should not break game flow

    async def _handle_end_game(self, game: ActiveGame, user_id: str) -> None:
        if user_id != game.host_user_id:
            return
        if game.status not in ("completed", "waiting"):
            return

        game.status = "ended"
        await update_game_status(game.game_id, "ended")
        await self._broadcast(game, self._msg("game_ended", {}))
        self._games.pop(game.game_code, None)


# Module-level singleton
game_manager = GameManager()
