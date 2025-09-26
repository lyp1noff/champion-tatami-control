from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Bracket, Tournament
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
async def sync_tournament_endpoint(tournament_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    result = await sync_tournament(tournament_id, db)
    return result


@router.get("/{tournament_id}/tatamis", response_model=dict[str, list[int]])
async def get_unique_tatamis(tournament_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, list[int]]:
    result = await db.execute(
        select(Bracket.tatami)
        .join(Tournament, Bracket.tournament_id == Tournament.id)
        .where(Tournament.external_id == tournament_id, Bracket.tatami.isnot(None))
    )

    tatamis_raw: list[Optional[int]] = list(result.scalars().all())
    unique_tatamis: list[int] = sorted({t for t in tatamis_raw if t is not None})
    return {"tatamis": unique_tatamis}


@router.get("/{tournament_id}/brackets", response_model=list[BracketSchema])
async def get_brackets(tournament_id: int, db: AsyncSession = Depends(get_db)) -> list[BracketSchema]:
    result = await db.execute(
        select(Bracket)
        .join(Tournament, Bracket.tournament_id == Tournament.id)
        .where(Tournament.external_id == tournament_id)
        .order_by(Bracket.day, Bracket.tatami, Bracket.start_time)
    )
    brackets = result.scalars().all()
    return [BracketSchema.model_validate(b) for b in brackets]
