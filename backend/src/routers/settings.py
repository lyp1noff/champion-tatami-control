from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import GlobalSettings
from src.schemas import (
    GetCurrentTournamentRequest,
    SetCurrentTournamentRequest,
)

router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)


@router.get("/current-tournament", response_model=GetCurrentTournamentRequest)
async def get_current_tournament(
    db: AsyncSession = Depends(get_db),
) -> GetCurrentTournamentRequest:
    result = await db.execute(select(GlobalSettings).where(GlobalSettings.key == "current_tournament_id"))
    setting = result.scalar_one_or_none()

    return GetCurrentTournamentRequest(current_tournament_id=int(setting.value) if setting and setting.value else None)


@router.post("/current-tournament")
async def set_current_tournament(
    body: SetCurrentTournamentRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(select(GlobalSettings).where(GlobalSettings.key == "current_tournament_id"))
    setting = result.scalar_one_or_none()

    if setting:
        setting.value = str(body.current_tournament_id)
    else:
        setting = GlobalSettings(
            key="current_tournament_id",
            value=str(body.current_tournament_id),
        )
        db.add(setting)

    await db.commit()
    return {"status": "ok"}
