"""Stats router."""

from fastapi import APIRouter, HTTPException

from app.queries import (
    STATS_TABLE_NAMES,
    delete_all_schema_data,
    get_database_statistics,
    get_database_table_rows,
)
from app.schemas.stats import ResetRequest

router = APIRouter(tags=["stats"])


@router.get("/stats")
async def get_stats():
    return await get_database_statistics()


@router.get("/stats/{table}")
async def get_table_rows(table: str):
    if table not in STATS_TABLE_NAMES:
        raise HTTPException(status_code=400, detail=f"Invalid table: {table}")

    rows = await get_database_table_rows(table)
    return {"table": table, "rows": rows}


@router.post("/stats/reset")
async def reset_data(body: ResetRequest):
    if body.confirmation != "DELETE ALL DATA":
        raise HTTPException(status_code=400, detail="Invalid confirmation")

    await delete_all_schema_data()
    return {"success": True}
