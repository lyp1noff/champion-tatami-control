from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import get_db
from src.models import Athlete, Bracket, BracketMatch, Match
from src.schemas import FinishMatchSchema, MatchWithBracketSchema, UpdateMatchScoresSchema
from src.services.outbox import (
    create_match_finish_outbox,
    create_match_scores_outbox,
    create_match_start_outbox,
)
from src.services.serialize import serialize_match_with_bracket

router = APIRouter(
    prefix="/matches",
    tags=["Matches"],
)


async def _get_bracket_for_match(match_id: int, db: AsyncSession) -> Bracket | None:
    result = await db.execute(
        select(Bracket)
        .join(BracketMatch, BracketMatch.bracket_id == Bracket.id)
        .where(BracketMatch.match_id == match_id)
    )
    return result.scalar_one_or_none()


def _touch_bracket(bracket: Bracket) -> int:
    bracket.version = (bracket.version or 0) + 1
    if bracket.status == "started":
        bracket.state = "running"
    elif bracket.status == "finished":
        bracket.state = "finished"
    return bracket.version


@router.get("/{match_id}", response_model=MatchWithBracketSchema)
async def get_match(match_id: str, db: AsyncSession = Depends(get_db)) -> MatchWithBracketSchema:
    result = await db.execute(
        select(Match)
        .where(Match.external_id == match_id)
        .options(
            selectinload(Match.athlete1),
            selectinload(Match.athlete2),
            selectinload(Match.bracket_matches).selectinload(BracketMatch.bracket),
        )
    )
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
    return serialize_match_with_bracket(match)


@router.post("/{match_id}/start", response_model=dict)
async def start_match(match_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status == "started":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already in progress")

    if match.status == "finished":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already finished")

    if match.athlete1_id is None or match.athlete2_id is None:
        raise HTTPException(status_code=400, detail="Match has no athletes")

    match.status = "started"
    match.started_at = datetime.now(timezone.utc)

    bracket = await _get_bracket_for_match(match.id, db)
    aggregate_version = 1
    if bracket is not None:
        if bracket.status != "finished":
            bracket.status = "started"
        bracket.state = "running"
        aggregate_version = _touch_bracket(bracket)

    await create_match_start_outbox(match, aggregate_version, db)
    await db.commit()

    return {"message": f"Match {match_id} started successfully"}


@router.post("/{match_id}/finish", response_model=dict)
async def finish_match(
    match_id: str,
    finish_data: FinishMatchSchema,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status == "finished":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already finished")

    if match.status == "not_started":
        raise HTTPException(status_code=400, detail=f"Match {match_id} has not been started")

    if finish_data.winner_id not in [match.athlete1_id, match.athlete2_id]:
        raise HTTPException(
            status_code=400,
            detail=f"Winner ID {finish_data.winner_id} does not match either athlete in the match",
        )

    winner = await db.get(Athlete, finish_data.winner_id)
    if winner is None:
        raise HTTPException(status_code=400, detail=f"Winner athlete {finish_data.winner_id} not found")

    match.score_athlete1 = finish_data.score_athlete1
    match.score_athlete2 = finish_data.score_athlete2
    match.winner_id = finish_data.winner_id
    match.status = "finished"
    match.ended_at = datetime.now(timezone.utc)

    bm_result = await db.execute(select(BracketMatch).where(BracketMatch.match_id == match.id))
    bm = bm_result.scalar_one_or_none()

    bracket = await _get_bracket_for_match(match.id, db)
    aggregate_version = 1
    if bracket is not None:
        aggregate_version = _touch_bracket(bracket)

    await create_match_finish_outbox(
        match,
        winner.external_id,
        finish_data.score_athlete1,
        finish_data.score_athlete2,
        aggregate_version,
        db,
    )

    if bm:
        next_position = (bm.position + 1) // 2
        next_bm_result = await db.execute(
            select(BracketMatch).where(
                BracketMatch.bracket_id == bm.bracket_id,
                BracketMatch.round_number == bm.round_number + 1,
                BracketMatch.position == next_position,
            )
        )
        next_bm = next_bm_result.scalar_one_or_none()

        if next_bm:
            next_match = await db.get(Match, next_bm.match_id)
            if next_match:
                if bm.position % 2 == 1:
                    next_match.athlete1_id = match.winner_id
                else:
                    next_match.athlete2_id = match.winner_id

        if bracket is not None:
            remaining = await db.scalar(
                select(func.count())
                .select_from(Match)
                .join(BracketMatch, BracketMatch.match_id == Match.id)
                .where(BracketMatch.bracket_id == bm.bracket_id, Match.status != "finished")
            )
            if (remaining or 0) == 0:
                bracket.status = "finished"
                bracket.state = "finished"

    await db.commit()

    return {"message": f"Match {match_id} finished successfully"}


@router.patch("/{match_id}/scores", response_model=dict)
async def update_match_scores(
    match_id: str,
    scores_data: UpdateMatchScoresSchema,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status != "started":
        raise HTTPException(status_code=400, detail=f"Cannot update scores for not started match {match_id}")

    if scores_data.score_athlete1 is not None:
        match.score_athlete1 = scores_data.score_athlete1

    if scores_data.score_athlete2 is not None:
        match.score_athlete2 = scores_data.score_athlete2

    bracket = await _get_bracket_for_match(match.id, db)
    aggregate_version = 1
    if bracket is not None:
        aggregate_version = _touch_bracket(bracket)

    await create_match_scores_outbox(match, aggregate_version, db)
    await db.commit()

    return {"message": f"Scores updated for match {match_id}"}
