from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models import Bracket, BracketMatch, Match
from src.schemas import BracketMatchSchema
from src.services.serialize import serialize_bracket_match

router = APIRouter(
    prefix="/brackets",
    tags=["Brackets"],
)


@router.get("/{bracket_id}/matches", response_model=list[BracketMatchSchema])
async def get_bracket_matches(bracket_id: int, db: AsyncSession = Depends(get_db)) -> list[BracketMatchSchema]:
    result = await db.execute(
        select(BracketMatch)
        .join(Bracket, BracketMatch.bracket_id == Bracket.id)
        .where(Bracket.external_id == bracket_id)
        .options(
            selectinload(BracketMatch.match).selectinload(Match.athlete1),
            selectinload(BracketMatch.match).selectinload(Match.athlete2),
        )
        .order_by(BracketMatch.round_number, BracketMatch.position)
    )
    matches = result.scalars().all()
    if not matches:
        raise HTTPException(status_code=404, detail=f"Bracket {bracket_id} not found")
    return [serialize_bracket_match(m) for m in matches]
