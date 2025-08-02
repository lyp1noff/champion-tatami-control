from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import MatchState, Match
from src.database import get_db
from src.schemas import MatchStateSchema, CreateMatchStateSchema, UpdateMatchStateSchema

router = APIRouter(
    prefix="/match-states",
    tags=["Match State"],
)


@router.get("/{match_id}", response_model=MatchStateSchema)
async def get_match_state(match_id: str, db: AsyncSession = Depends(get_db)) -> MatchStateSchema:
    result = await db.execute(select(MatchState).where(MatchState.external_match_id == match_id))
    match_state = result.scalar_one_or_none()

    if match_state is None:
        raise HTTPException(status_code=404, detail=f"Match state for match {match_id} not found")

    return match_state


@router.post("", response_model=MatchStateSchema)
async def create_match_state(
    match_state_data: CreateMatchStateSchema, db: AsyncSession = Depends(get_db)
) -> MatchStateSchema:
    # Check if match exists
    match_result = await db.execute(select(Match).where(Match.external_id == match_state_data.external_match_id))
    match = match_result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_state_data.external_match_id} not found")

    # Check if match state already exists
    existing_result = await db.execute(
        select(MatchState).where(MatchState.external_match_id == match_state_data.external_match_id)
    )
    existing_match_state = existing_result.scalar_one_or_none()

    if existing_match_state is not None:
        raise HTTPException(
            status_code=409, detail=f"Match state for match {match_state_data.external_match_id} already exists"
        )

    # Create new match state
    match_state = MatchState(**match_state_data.model_dump())
    db.add(match_state)
    await db.commit()
    await db.refresh(match_state)

    return match_state


@router.put("/{match_id}", response_model=MatchStateSchema)
async def update_match_state(
    match_id: str, match_state_data: UpdateMatchStateSchema, db: AsyncSession = Depends(get_db)
) -> MatchStateSchema:
    result = await db.execute(select(MatchState).where(MatchState.external_match_id == match_id))
    match_state = result.scalar_one_or_none()

    if match_state is None:
        raise HTTPException(status_code=404, detail=f"Match state for match {match_id} not found")

    # Update only provided fields
    update_data = match_state_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(match_state, field, value)

    await db.commit()
    await db.refresh(match_state)

    return match_state


@router.delete("/{match_id}")
async def delete_match_state(match_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MatchState).where(MatchState.external_match_id == match_id))
    match_state = result.scalar_one_or_none()

    if match_state is None:
        raise HTTPException(status_code=404, detail=f"Match state for match {match_id} not found")

    await db.delete(match_state)
    await db.commit()

    return {"message": f"Match state for match {match_id} deleted successfully"}
