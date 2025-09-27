from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import EXTERNAL_API_TOKEN, EXTERNAL_API_URL
from src.logger import logger
from src.models import Athlete, Bracket, BracketMatch, Match, Tournament
from src.utils import parse_datetime_utc


async def sync_tournament(tournament_id: int, db: AsyncSession) -> dict[str, str]:
    try:
        # --- GET tournament & matches from API
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
        tournament_query = select(Tournament).where(Tournament.external_id == tournament["id"])
        result: Result[tuple[Tournament]] = await db.execute(tournament_query)
        obj: Optional[Tournament] = result.scalar_one_or_none()

        start_dt = parse_datetime_utc(tournament["start_date"])
        end_dt = parse_datetime_utc(tournament["end_date"])

        if obj:
            logger.info(f"Updating existing tournament {obj.id}")
            obj.name = tournament["name"]
            obj.location = tournament["location"]
            obj.start_date = start_dt.date() if start_dt else None
            obj.end_date = end_dt.date() if end_dt else None
            obj.status = tournament["status"]
        else:
            logger.info(f"Creating new tournament with external_id {tournament['id']}")
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
        logger.info(f"Tournament ID: {obj.id}")

        # --- DELETE all brackets for this tournament
        logger.info(f"Deleting ALL brackets for tournament {obj.id}")
        all_brackets_query = select(Bracket).where(Bracket.tournament_id == obj.id)
        all_brackets = await db.execute(all_brackets_query)
        for bracket in all_brackets.scalars():
            logger.info(f"Deleting bracket {bracket.id} (external_id: {bracket.external_id})")
            await db.delete(bracket)
        await db.flush()

        # --- remove orphan matches (not linked to BracketMatch anymore)
        orphans_query = select(Match).where(~Match.bracket_matches.any())
        orphans = await db.execute(orphans_query)
        for orphan in orphans.scalars():
            logger.info(f"Deleting orphan match {orphan.id} (external_id: {orphan.external_id})")
            await db.delete(orphan)
        await db.flush()

        # --- INSERT new brackets & matches from API
        for b in brackets_with_matches:
            logger.info(f"Creating bracket with external_id {b['bracket_id']}")
            bracket_obj = Bracket(
                external_id=b["bracket_id"],
                tournament_id=obj.id,
                category=b["category"],
                type=b["type"],
                tatami=b.get("tatami"),
                group_id=b.get("group_id") or 1,
                start_time=b.get("start_time") or "09:00",
                day=b.get("day") or 1,
                status=b["status"],
                display_name=b.get("display_name") or b["category"],
            )
            db.add(bracket_obj)
            await db.flush()

            for bm in b["matches"]:
                match_data = bm["match"]
                logger.info(f"Processing match with external_id {match_data['id']}")

                # --- upsert athlete1
                athlete1 = None
                if match_data["athlete1"]:
                    athlete1_query = select(Athlete).where(Athlete.external_id == match_data["athlete1"]["id"])
                    athlete1_result = await db.execute(athlete1_query)
                    athlete1 = athlete1_result.scalar_one_or_none()
                    if athlete1:
                        athlete1.first_name = match_data["athlete1"]["first_name"]
                        athlete1.last_name = match_data["athlete1"]["last_name"]
                        athlete1.coaches_last_name = ", ".join(match_data["athlete1"].get("coaches_last_name", []))
                    else:
                        athlete1 = Athlete(
                            external_id=match_data["athlete1"]["id"],
                            first_name=match_data["athlete1"]["first_name"],
                            last_name=match_data["athlete1"]["last_name"],
                            coaches_last_name=", ".join(match_data["athlete1"].get("coaches_last_name", [])),
                        )
                        db.add(athlete1)
                        await db.flush()

                # --- upsert athlete2
                athlete2 = None
                if match_data["athlete2"]:
                    athlete2_query = select(Athlete).where(Athlete.external_id == match_data["athlete2"]["id"])
                    athlete2_result = await db.execute(athlete2_query)
                    athlete2 = athlete2_result.scalar_one_or_none()
                    if athlete2:
                        athlete2.first_name = match_data["athlete2"]["first_name"]
                        athlete2.last_name = match_data["athlete2"]["last_name"]
                        athlete2.coaches_last_name = ", ".join(match_data["athlete2"].get("coaches_last_name", []))
                    else:
                        athlete2 = Athlete(
                            external_id=match_data["athlete2"]["id"],
                            first_name=match_data["athlete2"]["first_name"],
                            last_name=match_data["athlete2"]["last_name"],
                            coaches_last_name=", ".join(match_data["athlete2"].get("coaches_last_name", [])),
                        )
                        db.add(athlete2)
                        await db.flush()

                # --- determine winner
                winner_id = None
                if match_data.get("winner"):
                    w_id = match_data["winner"]["id"]
                    if athlete1 and athlete1.external_id == w_id:
                        winner_id = athlete1.id
                    elif athlete2 and athlete2.external_id == w_id:
                        winner_id = athlete2.id

                # --- create match
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

                # --- create bracket_match
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

        logger.info("Committing changes to database")
        await db.commit()
        logger.info("Commit successful")
        return {"status": "success", "message": f"Tournament {tournament_id} synced successfully"}

    except Exception as e:
        await db.rollback()
        logger.error(f"Sync failed: {e}")
        return {"status": "error", "message": f"Sync failed: {str(e)}"}
