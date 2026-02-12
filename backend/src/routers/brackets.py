from champion_domain import compute_main_rounds
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models import Bracket, BracketMatch, BracketParticipant, Match
from src.schemas import BracketMatchSchema
from src.services.outbox import create_bracket_structure_rebuilt_outbox
from src.transport.mappers import to_bracket_match_schema

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

    participants_count = await db.scalar(
        select(func.count())
        .select_from(BracketParticipant)
        .join(Bracket, BracketParticipant.bracket_id == Bracket.id)
        .where(Bracket.external_id == bracket_id, BracketParticipant.athlete_id.is_not(None))
    )
    count = int(participants_count) if participants_count is not None else None
    main_rounds = compute_main_rounds(count)

    return [to_bracket_match_schema(m, main_rounds=main_rounds) for m in matches]


@router.post("/{bracket_id}/publish-structure")
async def publish_bracket_structure(bracket_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    bracket_result = await db.execute(select(Bracket).where(Bracket.external_id == bracket_id))
    bracket = bracket_result.scalar_one_or_none()
    if bracket is None:
        raise HTTPException(status_code=404, detail=f"Bracket {bracket_id} not found")

    if bracket.state in {"running", "finished"}:
        raise HTTPException(status_code=409, detail="Running or finished bracket is structurally immutable")

    await create_bracket_structure_rebuilt_outbox(bracket, db)
    await db.commit()

    return {"status": "ok"}


@router.post("/{bracket_id}/unlock")
async def unlock_bracket(
    bracket_id: int,
    publish: bool = Query(default=False, description="Enqueue bracket.structure_rebuilt after unlock"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str | int]:
    bracket_result = await db.execute(select(Bracket).where(Bracket.external_id == bracket_id))
    bracket = bracket_result.scalar_one_or_none()
    if bracket is None:
        raise HTTPException(status_code=404, detail=f"Bracket {bracket_id} not found")

    previous_state = bracket.state
    bracket.state = "draft"
    if bracket.status in {"started", "finished"}:
        bracket.status = "pending"
    bracket.version = max(1, bracket.version + 1)

    if publish:
        await create_bracket_structure_rebuilt_outbox(bracket, db)

    await db.commit()

    return {
        "status": "ok",
        "bracket_id": bracket_id,
        "previous_state": previous_state,
        "state": bracket.state,
        "version": bracket.version,
    }
