from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from src.config import EXTERNAL_API_TOKEN, EXTERNAL_API_URL
from src.models import Athlete, Bracket, BracketMatch, Match, Tournament, MatchType
from src.utils import parse_datetime_utc

MATCH_TYPE_MAP = {
    "main_matches": MatchType.MAIN,
    "repechage_a_matches": MatchType.REPECHAGE_A,
    "repechage_b_matches": MatchType.REPECHAGE_B,
}


async def upsert_tournament(db: AsyncSession, tournament: dict) -> Tournament:
    query: Select[tuple[Tournament]] = select(Tournament).where(Tournament.external_id == tournament["id"])
    result: Result[tuple[Tournament]] = await db.execute(query)
    obj = result.scalar_one_or_none()

    start_dt = parse_datetime_utc(tournament["start_date"])
    end_dt = parse_datetime_utc(tournament["end_date"])

    if obj:
        obj.name = tournament["name"]
        obj.location = tournament["location"]
        obj.start_date = start_dt.date() if start_dt else None
        obj.end_date = end_dt.date() if end_dt else None
        obj.status = tournament["status"]
    else:
        obj = Tournament(
            external_id=tournament["id"],
            name=tournament["name"],
            location=tournament["location"],
            start_date=start_dt.date() if start_dt else None,
            end_date=end_dt.date() if end_dt else None,
            status=tournament["status"],
        )
        db.add(obj)
    await db.flush()
    return obj


async def cleanup_brackets(db: AsyncSession, tournament_id: int) -> None:
    non_started_query: Select[tuple[Bracket]] = select(Bracket).where(
        Bracket.tournament_id == tournament_id, Bracket.status.notin_(["started", "finished"])
    )
    result: Result[tuple[Bracket]] = await db.execute(non_started_query)
    for bracket in result.scalars():
        await db.delete(bracket)
    await db.flush()


async def upsert_bracket(db: AsyncSession, tournament_id: int, b: dict) -> Bracket:
    query: Select[tuple[Bracket]] = select(Bracket).where(Bracket.external_id == b["bracket_id"])
    result: Result[tuple[Bracket]] = await db.execute(query)
    bracket_obj = result.scalar_one_or_none()

    if not bracket_obj:
        bracket_obj = Bracket(
            external_id=b["bracket_id"],
            tournament_id=tournament_id,
        )
        db.add(bracket_obj)

    bracket_obj.category = b["category"]
    bracket_obj.type = b["type"]
    bracket_obj.tatami = b.get("tatami")
    bracket_obj.group_id = b.get("group_id") or 1
    bracket_obj.start_time = b.get("start_time") or "09:00"
    bracket_obj.status = b["status"]
    bracket_obj.display_name = b.get("display_name") or b["category"]
    await db.flush()
    return bracket_obj


async def upsert_athlete(db: AsyncSession, athlete_data: dict | None) -> Optional[Athlete]:
    if not athlete_data:
        return None
    query: Select[tuple[Athlete]] = select(Athlete).where(Athlete.external_id == athlete_data["id"])
    result: Result[tuple[Athlete]] = await db.execute(query)
    athlete = result.scalar_one_or_none()
    if not athlete:
        athlete = Athlete(
            external_id=athlete_data["id"],
            first_name=athlete_data["first_name"],
            last_name=athlete_data["last_name"],
            coaches_last_name=", ".join(athlete_data.get("coaches_last_name", [])),
        )
        db.add(athlete)
        await db.flush()
    return athlete


async def upsert_match_and_bracket_match(
        db: AsyncSession,
        bm: dict,
        bracket_obj: Bracket,
        group_name: str,
) -> None:
    match_data = bm["match"]
    athlete1 = await upsert_athlete(db, match_data.get("athlete1"))
    athlete2 = await upsert_athlete(db, match_data.get("athlete2"))

    match = Match(
        external_id=match_data["id"],
        athlete1_id=athlete1.id if athlete1 else None,
        athlete2_id=athlete2.id if athlete2 else None,
        winner_id=match_data["winner"]["id"] if match_data.get("winner") else None,
        score_athlete1=match_data.get("score_athlete1"),
        score_athlete2=match_data.get("score_athlete2"),
        round_type=match_data.get("round_type"),
        status=match_data["status"],
        started_at=parse_datetime_utc(match_data.get("started_at")),
        ended_at=parse_datetime_utc(match_data.get("ended_at")),
    )
    db.add(match)
    await db.flush()

    db.add(
        BracketMatch(
            external_id=bm["id"],
            bracket_id=bracket_obj.id,
            match_id=match.id,
            round_number=bm["round_number"],
            position=bm["position"],
            next_slot=bm.get("next_slot"),
            match_type=MATCH_TYPE_MAP[group_name].value,
        )
    )


async def sync_tournament(tournament_id: int, db: AsyncSession) -> dict[str, str]:
    try:
        headers = {"Authorization": f"Bearer {EXTERNAL_API_TOKEN}"} if EXTERNAL_API_TOKEN else {}
        async with httpx.AsyncClient() as client:
            t_resp = await client.get(f"{EXTERNAL_API_URL}/tournaments/{tournament_id}", headers=headers)
            t_resp.raise_for_status()
            tournament = t_resp.json()

            full_resp = await client.get(
                f"{EXTERNAL_API_URL}/tournaments/{tournament_id}/matches_full", headers=headers
            )
            full_resp.raise_for_status()
            brackets_with_matches = full_resp.json()

        obj = await upsert_tournament(db, tournament)
        await cleanup_brackets(db, obj.id)

        for b in brackets_with_matches:
            if b["status"] in ["started", "finished"]:
                continue

            bracket_obj = await upsert_bracket(db, obj.id, b)

            for group_name in ["main_matches", "repechage_a_matches", "repechage_b_matches"]:
                for bm in b["matches"].get(group_name, []):
                    await upsert_match_and_bracket_match(db, bm, bracket_obj, group_name)

        await db.commit()
        return {"status": "success", "message": f"Tournament {tournament_id} synced successfully"}

    except Exception as e:
        await db.rollback()
        return {"status": "error", "message": f"Sync failed: {str(e)}"}
