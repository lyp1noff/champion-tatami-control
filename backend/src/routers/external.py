import httpx
from fastapi import APIRouter

from src.config import EXTERNAL_API_URL
from src.schemas import (
    ExternalTournamentSchema,
)

router = APIRouter(
    prefix="/external",
    tags=["External"],
)


@router.get("/tournaments", response_model=list[ExternalTournamentSchema])
async def get_tournaments() -> list[ExternalTournamentSchema]:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{EXTERNAL_API_URL}/tournaments")
    response.raise_for_status()
    data = response.json()
    return [ExternalTournamentSchema.model_validate(t) for t in data["data"]]
