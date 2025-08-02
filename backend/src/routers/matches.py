from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.serialize import serialize_match
from src.models import Match
from src.database import get_db
from src.schemas import MatchSchema, UpdateMatchScoresSchema

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
    print(f"Starting match: {match_id}")
    return {"message": f"Match {match_id} started successfully"}


@router.post("/{match_id}/finish", response_model=dict)
async def finish_match(match_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    print(f"Finishing match: {match_id}")
    return {"message": f"Match {match_id} finished successfully"}


@router.patch("/{match_id}/scores", response_model=dict)
async def update_match_scores(
    match_id: str, scores_data: UpdateMatchScoresSchema, db: AsyncSession = Depends(get_db)
) -> dict:
    print(
        f"Updating scores for match {match_id}: athlete1={scores_data.score_athlete1}, athlete2={scores_data.score_athlete2}"
    )
    return {
        "message": f"Scores updated for match {match_id}",
        "score_athlete1": scores_data.score_athlete1,
        "score_athlete2": scores_data.score_athlete2,
    }
