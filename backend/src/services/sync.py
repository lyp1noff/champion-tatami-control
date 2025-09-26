from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from src.config import EXTERNAL_API_TOKEN, EXTERNAL_API_URL
from src.logger import logger
from src.models import Athlete, Bracket, BracketMatch, Match, Tournament
from src.utils import parse_datetime_utc


async def sync_tournament(tournament_id: int, db: AsyncSession) -> dict[str, str]:
    try:
        # --- GET tournament
        headers = {"Authorization": f"Bearer {EXTERNAL_API_TOKEN}"} if EXTERNAL_API_TOKEN else {}
        async with httpx.AsyncClient() as client:
            tournament_resp = await client.get(f"{EXTERNAL_API_URL}/tournaments/{tournament_id}", headers=headers)
            tournament_resp.raise_for_status()
            tournament = tournament_resp.json()

            full_data_resp = await client.get(
                f"{EXTERNAL_API_URL}/tournaments/{tournament_id}/matches_full", headers=headers
            )
            full_data_resp.raise_for_status()
            brackets_with_matches = full_data_resp.json()

        # --- UPSERT Tournament
        logger.info(f"Checking for existing tournament with external_id {tournament['id']}")
        tournament_query: Select[tuple[Tournament]] = select(Tournament).where(
            Tournament.external_id == tournament["id"]
        )
        result: Result[tuple[Tournament]] = await db.execute(tournament_query)
        obj: Optional[Tournament] = result.scalar_one_or_none()
        if obj:
            logger.info(f"Updating existing tournament {obj.id}")
            obj.name = tournament["name"]
            obj.location = tournament["location"]
            start_dt = parse_datetime_utc(tournament["start_date"])
            end_dt = parse_datetime_utc(tournament["end_date"])
            obj.start_date = start_dt.date() if start_dt else None
            obj.end_date = end_dt.date() if end_dt else None
            obj.status = tournament["status"]
        else:
            logger.info(f"Creating new tournament with external_id {tournament['id']}")
            start_dt = parse_datetime_utc(tournament["start_date"])
            end_dt = parse_datetime_utc(tournament["end_date"])
            obj = Tournament(
                external_id=tournament["id"],
                name=tournament["name"],
                location=tournament["location"],
                start_date=start_dt.date() if start_dt else None,
                end_date=end_dt.date() if end_dt else None,
                status=tournament["status"],
            )
            db.add(obj)
        await db.flush()  # Ensure tournament ID is available
        logger.info(f"Tournament ID: {obj.id}")

        # --- CLEAN non-started brackets and their associated data
        logger.info(f"Cleaning non-started brackets for tournament {obj.id}")
        non_started_brackets_query: Select[tuple[Bracket]] = select(Bracket).where(
            Bracket.tournament_id == obj.id, Bracket.status.notin_(["started", "finished"])
        )
        non_started_brackets: Result[tuple[Bracket]] = await db.execute(non_started_brackets_query)
        for bracket in non_started_brackets.scalars():
            logger.info(f"Deleting non-started bracket {bracket.id} (external_id: {bracket.external_id})")
            await db.delete(bracket)  # Cascades to BracketMatch, Match, MatchState
        await db.flush()

        # --- INSERT new or non-started brackets & matches
        for b in brackets_with_matches:
            # Skip started or finished brackets
            if b["status"] in ["started", "finished"]:
                logger.info(
                    f"Skipping started/finished bracket with external_id {b['bracket_id']} (status: {b['status']})"
                )
                continue

            logger.info(f"Processing bracket with external_id {b['bracket_id']}")
            bracket_query: Select[tuple[Bracket]] = select(Bracket).where(Bracket.external_id == b["bracket_id"])
            bracket_result: Result[tuple[Bracket]] = await db.execute(bracket_query)
            bracket_obj: Optional[Bracket] = bracket_result.scalar_one_or_none()
            if not bracket_obj:
                logger.info(f"Creating new bracket with external_id {b['bracket_id']}")
                bracket_obj = Bracket(
                    external_id=b["bracket_id"],
                    tournament_id=obj.id,
                )
                db.add(bracket_obj)
            else:
                logger.info(f"Updating existing bracket {bracket_obj.id} (external_id: {b['bracket_id']})")
            bracket_obj.category = b["category"]
            bracket_obj.type = b["type"]
            bracket_obj.tatami = b.get("tatami")
            bracket_obj.group_id = b.get("group_id") or 1
            bracket_obj.start_time = b.get("start_time") or "09:00"
            bracket_obj.day = b.get("day") or 1
            bracket_obj.status = b["status"]
            bracket_obj.display_name = b.get("display_name") or b["category"]
            await db.flush()

            for bm in b["matches"]:
                match_data = bm["match"]
                logger.info(f"Processing match with external_id {match_data['id']}")
                athlete1: Optional[Athlete] = None
                athlete2: Optional[Athlete] = None

                if match_data["athlete1"]:
                    athlete1_query: Select[tuple[Athlete]] = select(Athlete).where(
                        Athlete.external_id == match_data["athlete1"]["id"]
                    )
                    athlete1_result: Result[tuple[Athlete]] = await db.execute(athlete1_query)
                    athlete1 = athlete1_result.scalar_one_or_none()
                    if not athlete1:
                        logger.info(f"Creating new athlete with external_id {match_data['athlete1']['id']}")
                        athlete1 = Athlete(
                            external_id=match_data["athlete1"]["id"],
                            first_name=match_data["athlete1"]["first_name"],
                            last_name=match_data["athlete1"]["last_name"],
                            coaches_last_name=", ".join(match_data["athlete1"].get("coaches_last_name", [])),
                        )
                        db.add(athlete1)
                        await db.flush()

                if match_data["athlete2"]:
                    athlete2_query: Select[tuple[Athlete]] = select(Athlete).where(
                        Athlete.external_id == match_data["athlete2"]["id"]
                    )
                    athlete2_result: Result[tuple[Athlete]] = await db.execute(athlete2_query)
                    athlete2 = athlete2_result.scalar_one_or_none()
                    if not athlete2:
                        logger.info(f"Creating new athlete with external_id {match_data['athlete2']['id']}")
                        athlete2 = Athlete(
                            external_id=match_data["athlete2"]["id"],
                            first_name=match_data["athlete2"]["first_name"],
                            last_name=match_data["athlete2"]["last_name"],
                            coaches_last_name=", ".join(match_data["athlete2"].get("coaches_last_name", [])),
                        )
                        db.add(athlete2)
                        await db.flush()

                winner_id = None
                if match_data.get("winner"):
                    w_id = match_data["winner"]["id"]
                    if athlete1 and athlete1.external_id == w_id:
                        winner_id = athlete1.id
                    elif athlete2 and athlete2.external_id == w_id:
                        winner_id = athlete2.id

                match = Match(
                    external_id=match_data["id"],
                    athlete1_id=athlete1.id if athlete1 else None,
                    athlete2_id=athlete2.id if athlete2 else None,
                    winner_id=winner_id,
                    score_athlete1=match_data.get("score_athlete1"),
                    score_athlete2=match_data.get("score_athlete2"),
                    status=match_data["status"],
                    started_at=parse_datetime_utc(match_data.get("started_at")),
                    ended_at=parse_datetime_utc(match_data.get("ended_at")),
                )
                db.add(match)
                await db.flush()
                logger.info(f"Created/Updated match {match.id} (external_id: {match_data['id']})")

                db.add(
                    BracketMatch(
                        external_id=bm["id"],
                        bracket_id=bracket_obj.id,
                        match_id=match.id,
                        round_number=bm["round_number"],
                        position=bm["position"],
                        next_slot=bm.get("next_slot"),
                    )
                )
                logger.info(f"Created BracketMatch with external_id {bm['id']} for match {match.id}")

        logger.info("Committing changes to database")
        await db.commit()
        logger.info("Commit successful")
        return {"status": "success", "message": f"Tournament {tournament_id} synced successfully"}

    except Exception as e:
        await db.rollback()
        logger.info(f"Sync failed: {e}")
        return {"status": "error", "message": f"Sync failed: {str(e)}"}
