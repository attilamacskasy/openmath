"""Multiplayer WebSocket router (v4.0)."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException, status

from app.auth import decode_access_token
from app.services.multiplayer import game_manager

router = APIRouter(tags=["multiplayer-ws"])


async def _authenticate_websocket(websocket: WebSocket) -> dict:
    """Validate JWT from query parameter. Returns user payload or closes connection."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid or expired token")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    return payload


@router.websocket("/ws/game/{game_code}")
async def game_websocket(websocket: WebSocket, game_code: str):
    """Single WebSocket endpoint per game. All messages routed by type."""
    user = await _authenticate_websocket(websocket)
    await websocket.accept()

    game = await game_manager.connect(
        game_code, user["sub"], user.get("name", "Player"), websocket
    )
    if not game:
        await websocket.close(code=4004, reason="Game not found")
        return

    try:
        while True:
            data = await websocket.receive_json()
            await game_manager.handle_message(game_code, user["sub"], data)
    except WebSocketDisconnect:
        await game_manager.disconnect(game_code, user["sub"])


@router.get("/ws/health")
async def ws_health():
    """Health check for WebSocket infrastructure."""
    return {"status": "ok", "websocket": True}
