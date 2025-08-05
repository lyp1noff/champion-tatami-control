from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.serialize import serialize_match
from src.services.outbox import create_match_start_outbox, create_match_finish_outbox, create_match_scores_outbox
from src.models import Match, BracketMatch
from src.database import get_db
from src.schemas import MatchSchema, UpdateMatchScoresSchema, FinishMatchSchema

router = APIRouter(
    prefix="/matches",
    tags=["Matches"],
)


@router.get("/{match_id}", response_model=MatchSchema)
async def get_match(match_id: str, db: AsyncSession = Depends(get_db)) -> MatchSchema:
    result = await db.execute(
        select(Match)
        .where(Match.external_id == match_id)
        .options(
            selectinload(Match.athlete1),
            selectinload(Match.athlete2),
        )
    )
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
    return serialize_match(match)


@router.post("/{match_id}/start", response_model=dict)
async def start_match(match_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    # Find the match
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status == "in_progress":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already in progress")

    if match.status == "finished":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already finished")

    # Update match status and start time
    match.status = "in_progress"
    match.started_at = datetime.now(timezone.utc)

    # Create outbox entry for external API notification
    await create_match_start_outbox(match, db)

    await db.commit()

    print(f"Starting match: {match_id}")
    return {"message": f"Match {match_id} started successfully"}


@router.post("/{match_id}/finish", response_model=dict)
async def finish_match(match_id: str, finish_data: FinishMatchSchema, db: AsyncSession = Depends(get_db)) -> dict:
    # Find the match
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status == "finished":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already finished")

    if match.status == "not_started":
        raise HTTPException(status_code=400, detail=f"Match {match_id} has not been started")

    # Validate winner_id matches one of the athletes
    if finish_data.winner_id not in [match.athlete1_id, match.athlete2_id]:
        raise HTTPException(
            status_code=400, detail=f"Winner ID {finish_data.winner_id} does not match either athlete in the match"
        )

    # Update match with scores, winner, and status
    match.score_athlete1 = finish_data.score_athlete1
    match.score_athlete2 = finish_data.score_athlete2
    match.winner_id = finish_data.winner_id
    match.status = "finished"
    match.ended_at = datetime.now(timezone.utc)

    # Create outbox entry for external API notification
    await create_match_finish_outbox(
        match, finish_data.winner_id, finish_data.score_athlete1, finish_data.score_athlete2, db
    )

    # Advance winner to next round in bracket
    bm_result = await db.execute(select(BracketMatch).where(BracketMatch.match_id == match.id))
    bm = bm_result.scalar_one_or_none()

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

    await db.commit()

    print(
        f"Finishing match: {match_id} with scores {finish_data.score_athlete1}-{finish_data.score_athlete2}, winner: {finish_data.winner_id}"
    )
    return {
        "message": f"Match {match_id} finished successfully",
        "score_athlete1": finish_data.score_athlete1,
        "score_athlete2": finish_data.score_athlete2,
        "winner_id": finish_data.winner_id,
    }


@router.patch("/{match_id}/scores", response_model=dict)
async def update_match_scores(
    match_id: str, scores_data: UpdateMatchScoresSchema, db: AsyncSession = Depends(get_db)
) -> dict:
    # Find the match
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status == "finished":
        raise HTTPException(status_code=400, detail=f"Cannot update scores for finished match {match_id}")

    # Update only the provided scores
    if scores_data.score_athlete1 is not None:
        match.score_athlete1 = scores_data.score_athlete1

    if scores_data.score_athlete2 is not None:
        match.score_athlete2 = scores_data.score_athlete2

    # Create outbox entry for external API notification
    await create_match_scores_outbox(match, db)

    await db.commit()

    print(
        f"Updating scores for match {match_id}: athlete1={scores_data.score_athlete1}, athlete2={scores_data.score_athlete2}"
    )
    return {
        "message": f"Scores updated for match {match_id}",
        "score_athlete1": match.score_athlete1,
        "score_athlete2": match.score_athlete2,
    }
