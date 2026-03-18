"""Multiplayer WebSocket router (v4.0 + v4.1 ping/pong & logging)."""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException, status

from app.auth import decode_access_token
from app.services.multiplayer import game_manager

logger = logging.getLogger("openmath.multiplayer")

router = APIRouter(tags=["multiplayer-ws"])


async def _authenticate_websocket(websocket: WebSocket) -> dict:
    """Validate JWT from query parameter. Returns user payload or closes connection."""
    token = websocket.query_params.get("token")
    if not token:
        logger.warning("[MP] WS_AUTH_FAIL reason=missing_token")
        await websocket.close(code=4001, reason="Missing token")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    payload = decode_access_token(token)
    if not payload:
        logger.warning("[MP] WS_AUTH_FAIL reason=invalid_or_expired_token")
        await websocket.close(code=4001, reason="Invalid or expired token")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    return payload


@router.websocket("/ws/game/{game_code}")
async def game_websocket(websocket: WebSocket, game_code: str):
    """Single WebSocket endpoint per game. All messages routed by type."""
    user = await _authenticate_websocket(websocket)
    await websocket.accept()

    user_id = user["sub"]
    user_name = user.get("name", "Player")
    logger.info("[MP] WS_ACCEPT game=%s user=%s name=%s", game_code, user_id, user_name)

    game = await game_manager.connect(game_code, user_id, user_name, websocket)
    if not game:
        logger.warning("[MP] WS_GAME_NOT_FOUND game=%s user=%s", game_code, user_id)
        await websocket.close(code=4004, reason="Game not found")
        return

    # Server-side ping task to keep connection alive and detect dead clients
    async def heartbeat():
        from datetime import datetime, timezone
        while True:
            try:
                await asyncio.sleep(30)
                await websocket.send_json({
                    "type": "ping",
                    "payload": {},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                logger.info("[MP] WS_PING_FAIL game=%s user=%s", game_code, user_id)
                break

    ping_task = asyncio.create_task(heartbeat())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            # Ignore pong responses (heartbeat ack)
            if msg_type == "pong":
                continue

            logger.info("[MP] WS_MSG game=%s user=%s type=%s", game_code, user_id, msg_type)
            await game_manager.handle_message(game_code, user_id, data)
    except WebSocketDisconnect:
        logger.info("[MP] WS_DISCONNECT game=%s user=%s", game_code, user_id)
        ping_task.cancel()
        await game_manager.disconnect(game_code, user_id)
    except Exception as e:
        logger.error("[MP] WS_ERROR game=%s user=%s error=%s", game_code, user_id, str(e))
        ping_task.cancel()
        await game_manager.disconnect(game_code, user_id)


@router.get("/ws/health")
async def ws_health():
    """Health check for WebSocket infrastructure."""
    return {"status": "ok", "websocket": True}
