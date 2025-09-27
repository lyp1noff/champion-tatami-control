from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import OutboxItem

router = APIRouter(prefix="/outbox", tags=["outbox"])


@router.get("/status")
async def get_outbox_status(db: AsyncSession = Depends(get_db)) -> dict[str, int]:
    total = await db.scalar(select(func.count()).select_from(OutboxItem))
    pending = await db.scalar(select(func.count()).select_from(OutboxItem).where(OutboxItem.status == "pending"))
    failed = await db.scalar(select(func.count()).select_from(OutboxItem).where(OutboxItem.status == "failed"))
    succeeded = await db.scalar(select(func.count()).select_from(OutboxItem).where(OutboxItem.status == "success"))

    return {
        "total": total or 0,
        "pending": pending or 0,
        "failed": failed or 0,
        "succeeded": succeeded or 0,
    }
