import json
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config import EXTERNAL_API_URL
from src.models import Athlete, BracketMatch, Match, OutboxItem


async def get_tournament_id_for_match(match_id: int, db: AsyncSession) -> Optional[int]:
    """Get tournament ID for a match through its bracket relationship."""
    bm_result = await db.execute(
        select(BracketMatch).where(BracketMatch.match_id == match_id).options(selectinload(BracketMatch.bracket))
    )
    bm = bm_result.scalar_one_or_none()
    return bm.bracket.tournament_id if bm else None


async def create_outbox_entry(
    db: AsyncSession,
    endpoint: str,
    method: str,
    payload: Optional[dict[str, Any]] = None,
    tournament_id: Optional[int] = None,
    match_id: Optional[int] = None,
) -> OutboxItem:
    """Create an outbox entry for external API communication."""
    outbox_item = OutboxItem(
        tournament_id=tournament_id,
        match_id=match_id,
        endpoint=endpoint,
        method=method,
        payload=json.dumps(payload) if payload else None,
        status="pending",
        retry_count=0,
        max_retries=30,
    )

    db.add(outbox_item)
    await db.flush()

    return outbox_item


async def create_match_start_outbox(match: Match, db: AsyncSession) -> OutboxItem:
    """Create outbox entry for match start event."""
    tournament_id = await get_tournament_id_for_match(match.id, db)

    return await create_outbox_entry(
        db=db,
        endpoint=f"{EXTERNAL_API_URL}/matches/{match.external_id}/start",
        method="POST",
        tournament_id=tournament_id,
        match_id=match.id,
    )


async def create_match_finish_outbox(
    match: Match, winner_id: int, score_athlete1: int, score_athlete2: int, db: AsyncSession
) -> OutboxItem:
    """Create outbox entry for match finish event."""
    tournament_id = await get_tournament_id_for_match(match.id, db)

    # Get the winner's external_id
    winner_result = await db.execute(select(Athlete).where(Athlete.id == winner_id))
    winner = winner_result.scalar_one_or_none()
    if not winner:
        raise ValueError(f"Athlete with ID {winner_id} not found")

    winner_external_id = winner.external_id

    return await create_outbox_entry(
        db=db,
        endpoint=f"{EXTERNAL_API_URL}/matches/{match.external_id}/finish",
        method="POST",
        payload={"score_athlete1": score_athlete1, "score_athlete2": score_athlete2, "winner_id": winner_external_id},
        tournament_id=tournament_id,
        match_id=match.id,
    )


async def create_match_scores_outbox(match: Match, db: AsyncSession) -> OutboxItem:
    """Create outbox entry for match scores update event."""
    tournament_id = await get_tournament_id_for_match(match.id, db)

    return await create_outbox_entry(
        db=db,
        endpoint=f"{EXTERNAL_API_URL}/matches/{match.external_id}/scores",
        method="PATCH",
        payload={
            "score_athlete1": match.score_athlete1,
            "score_athlete2": match.score_athlete2,
        },
        tournament_id=tournament_id,
        match_id=match.id,
    )
