import httpx
from fastapi import APIRouter, HTTPException

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
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{EXTERNAL_API_URL}/tournaments")
            response.raise_for_status()
            data = response.json()
            return [ExternalTournamentSchema.model_validate(t) for t in data["data"]]
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {str(e)}")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")
