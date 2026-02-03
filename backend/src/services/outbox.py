import json
import math
from datetime import UTC, datetime
from typing import Any, Optional
from uuid import uuid4

from champion_domain import get_round_type
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config import EDGE_ID, EXTERNAL_API_URL
from src.models import Athlete, Bracket, BracketMatch, BracketParticipant, Match, OutboxItem


async def get_tournament_id_for_match(match_id: int, db: AsyncSession) -> Optional[int]:
    """Get tournament ID for a match through its bracket relationship."""
    bm_result = await db.execute(
        select(BracketMatch).where(BracketMatch.match_id == match_id).options(selectinload(BracketMatch.bracket))
    )
    bm = bm_result.scalar_one_or_none()
    return bm.bracket.tournament_id if bm else None


async def get_bracket_for_match(match_id: int, db: AsyncSession) -> Optional[Bracket]:
    bm_result = await db.execute(
        select(BracketMatch).where(BracketMatch.match_id == match_id).options(selectinload(BracketMatch.bracket))
    )
    bm = bm_result.scalar_one_or_none()
    return bm.bracket if bm else None


async def create_outbox_entry(
    db: AsyncSession,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    aggregate_version: int,
    payload: Optional[dict[str, Any]] = None,
    tournament_id: Optional[int] = None,
    match_id: Optional[int] = None,
) -> OutboxItem:
    """Create an outbox entry that targets master /sync/commands API."""
    outbox_item = OutboxItem(
        tournament_id=tournament_id,
        match_id=match_id,
        endpoint=f"{EXTERNAL_API_URL}/sync/commands",
        method="POST",
        payload=None,
        status="pending",
        retry_count=0,
        max_retries=30,
    )

    db.add(outbox_item)
    await db.flush()

    event = {
        "event_id": str(uuid4()),
        "seq": outbox_item.id,
        "event_type": event_type,
        "aggregate_type": aggregate_type,
        "aggregate_id": aggregate_id,
        "aggregate_version": aggregate_version,
        "occurred_at": datetime.now(UTC).isoformat(),
        "payload": payload or {},
    }

    outbox_item.payload = json.dumps({"edge_id": EDGE_ID, "events": [event]})
    await db.flush()

    return outbox_item


async def create_match_start_outbox(match: Match, aggregate_version: int, db: AsyncSession) -> OutboxItem:
    """Create outbox entry for match start event."""
    tournament_id = await get_tournament_id_for_match(match.id, db)

    return await create_outbox_entry(
        db=db,
        event_type="match.started",
        aggregate_type="match",
        aggregate_id=match.external_id,
        aggregate_version=aggregate_version,
        tournament_id=tournament_id,
        match_id=match.id,
    )


async def create_match_finish_outbox(
    match: Match,
    winner_external_id: int,
    score_athlete1: int,
    score_athlete2: int,
    aggregate_version: int,
    db: AsyncSession,
) -> OutboxItem:
    """Create outbox entry for match finish event."""
    tournament_id = await get_tournament_id_for_match(match.id, db)

    return await create_outbox_entry(
        db=db,
        event_type="match.finished",
        aggregate_type="match",
        aggregate_id=match.external_id,
        aggregate_version=aggregate_version,
        payload={
            "score_athlete1": score_athlete1,
            "score_athlete2": score_athlete2,
            "winner_id": winner_external_id,
        },
        tournament_id=tournament_id,
        match_id=match.id,
    )


async def create_match_scores_outbox(match: Match, aggregate_version: int, db: AsyncSession) -> OutboxItem:
    """Create outbox entry for match scores update event."""
    tournament_id = await get_tournament_id_for_match(match.id, db)

    return await create_outbox_entry(
        db=db,
        event_type="match.score_updated",
        aggregate_type="match",
        aggregate_id=match.external_id,
        aggregate_version=aggregate_version,
        payload={
            "score_athlete1": match.score_athlete1,
            "score_athlete2": match.score_athlete2,
        },
        tournament_id=tournament_id,
        match_id=match.id,
    )


async def create_bracket_structure_rebuilt_outbox(bracket: Bracket, db: AsyncSession) -> OutboxItem:
    """Create outbox entry with full bracket snapshot for structural rebuild sync."""
    participants_result = await db.execute(
        select(BracketParticipant)
        .where(BracketParticipant.bracket_id == bracket.id)
        .options(selectinload(BracketParticipant.athlete))
        .order_by(BracketParticipant.seed.asc())
    )
    participants = participants_result.scalars().all()

    matches_result = await db.execute(
        select(BracketMatch)
        .where(BracketMatch.bracket_id == bracket.id)
        .options(
            selectinload(BracketMatch.match).selectinload(Match.athlete1),
            selectinload(BracketMatch.match).selectinload(Match.athlete2),
        )
        .order_by(BracketMatch.round_number.asc(), BracketMatch.position.asc())
    )
    bracket_matches = matches_result.scalars().all()

    participants_count = await db.scalar(
        select(func.count())
        .select_from(BracketParticipant)
        .where(BracketParticipant.bracket_id == bracket.id, BracketParticipant.athlete_id.is_not(None))
    )
    main_rounds = int(math.ceil(math.log2(participants_count))) if participants_count and participants_count >= 2 else 0

    payload_participants: list[dict[str, int | None]] = []
    for participant in participants:
        payload_participants.append(
            {
                "athlete_id": participant.athlete.external_id if participant.athlete else None,
                "seed": participant.seed,
            }
        )

    payload_matches: list[dict[str, Any]] = []
    for bm in bracket_matches:
        match = bm.match
        if match is None:
            continue

        is_repechage = main_rounds > 0 and bm.round_number > main_rounds
        rep_side = None
        rep_step = None
        stage = "main"
        if is_repechage:
            stage = "repechage"
            rep_side = "A" if bm.position == 1 else "B"
            rep_step = bm.round_number - main_rounds
        round_type = "round"
        if not is_repechage and main_rounds > 0:
            round_type = get_round_type(bm.round_number - 1, main_rounds)

        winner_external_id: int | None = None
        if match.winner_id is not None:
            winner = await db.get(Athlete, match.winner_id)
            winner_external_id = winner.external_id if winner else None

        payload_matches.append(
            {
                "id": match.external_id,
                "round_number": bm.round_number,
                "position": bm.position,
                "next_slot": bm.next_slot,
                "round_type": round_type,
                "stage": stage,
                "repechage_side": rep_side,
                "repechage_step": rep_step,
                "status": match.status,
                "athlete1_id": match.athlete1.external_id if match.athlete1 else None,
                "athlete2_id": match.athlete2.external_id if match.athlete2 else None,
                "winner_id": winner_external_id,
                "score_athlete1": match.score_athlete1,
                "score_athlete2": match.score_athlete2,
                "started_at": match.started_at.isoformat() if match.started_at else None,
                "ended_at": match.ended_at.isoformat() if match.ended_at else None,
            }
        )

    payload: dict[str, Any] = {
        "status": bracket.status,
        "state": bracket.state,
        "participants": payload_participants,
        "matches": payload_matches,
    }

    return await create_outbox_entry(
        db=db,
        event_type="bracket.structure_rebuilt",
        aggregate_type="bracket",
        aggregate_id=str(bracket.external_id),
        aggregate_version=bracket.version,
        payload=payload,
        tournament_id=bracket.tournament_id,
        match_id=None,
    )
