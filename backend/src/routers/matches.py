from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas import FinishMatchSchema, MatchWithBracketSchema, UpdateMatchScoresSchema
from src.services.matches import finish_match as finish_match_service
from src.services.matches import get_match as get_match_service
from src.services.matches import start_match as start_match_service
from src.services.matches import update_match_scores as update_match_scores_service

router = APIRouter(
    prefix="/matches",
    tags=["Matches"],
)


@router.get("/{match_id}", response_model=MatchWithBracketSchema)
async def get_match(match_id: str, db: AsyncSession = Depends(get_db)) -> MatchWithBracketSchema:
    return await get_match_service(match_id, db)


@router.post("/{match_id}/start", response_model=dict)
async def start_match(match_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    return await start_match_service(match_id, db)


@router.post("/{match_id}/finish", response_model=dict)
async def finish_match(
    match_id: str,
    finish_data: FinishMatchSchema,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    return await finish_match_service(match_id, finish_data, db)


@router.patch("/{match_id}/scores", response_model=dict)
async def update_match_scores(
    match_id: str,
    scores_data: UpdateMatchScoresSchema,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    return await update_match_scores_service(match_id, scores_data, db)
