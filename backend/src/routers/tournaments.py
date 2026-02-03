from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models import Bracket, TimetableEntry, Tournament
from src.schemas import (
    BracketSchema,
    TournamentSchema,
)
from src.services.sync import sync_tournament

router = APIRouter(
    prefix="/tournaments",
    tags=["Tournaments"],
)


@router.get("", response_model=list[TournamentSchema])
async def get_tournaments(db: AsyncSession = Depends(get_db)) -> list[TournamentSchema]:
    result = await db.execute(select(Tournament))
    tournaments = result.scalars().all()
    return [TournamentSchema.model_validate(t) for t in tournaments]


@router.get("/{tournament_id}", response_model=TournamentSchema)
async def get_tournament(tournament_id: int, db: AsyncSession = Depends(get_db)) -> TournamentSchema:
    result = await db.execute(select(Tournament).where(Tournament.external_id == tournament_id))
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail=f"Tournament {tournament_id} not found")
    return TournamentSchema.model_validate(tournament)


@router.post("/{tournament_id}/sync", response_model=dict[str, str])
async def sync_tournament_endpoint(
    tournament_id: int,
    force: bool = Query(default=False, description="Bypass local immutable brackets and overwrite from master"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await sync_tournament(tournament_id, db, force=force)
    return result


@router.get("/{tournament_id}/tatamis", response_model=dict[str, list[int]])
async def get_unique_tatamis(tournament_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, list[int]]:
    result = await db.execute(
        select(TimetableEntry.tatami)
        .join(Tournament, TimetableEntry.tournament_id == Tournament.id)
        .where(Tournament.external_id == tournament_id)
    )

    tatamis_raw: list[int] = list(result.scalars().all())
    unique_tatamis: list[int] = sorted(set(tatamis_raw))
    return {"tatamis": unique_tatamis}


@router.get("/{tournament_id}/brackets", response_model=list[BracketSchema])
async def get_brackets(tournament_id: int, db: AsyncSession = Depends(get_db)) -> list[BracketSchema]:
    result = await db.execute(
        select(Bracket)
        .join(Tournament, Bracket.tournament_id == Tournament.id)
        .where(Tournament.external_id == tournament_id)
        .options(selectinload(Bracket.timetable_entry))
        .order_by(Bracket.id.asc())
    )
    brackets = result.scalars().all()

    def sort_key(bracket: Bracket) -> tuple[int, int, str, int]:
        entry = bracket.timetable_entry
        if entry is None:
            return (999, 999, "99:99:99", bracket.external_id)
        return (entry.day, entry.tatami, entry.start_time.strftime("%H:%M:%S"), bracket.external_id)

    sorted_brackets = sorted(brackets, key=sort_key)
    return [BracketSchema.model_validate(b) for b in sorted_brackets]
