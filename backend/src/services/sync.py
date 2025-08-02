import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import EXTERNAL_API_TOKEN, EXTERNAL_API_URL
from src.models import Athlete, Bracket, BracketMatch, Match, MatchState, Tournament
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
        existing = await db.execute(select(Tournament).where(Tournament.external_id == tournament["id"]))
        obj = existing.scalar_one_or_none()
        if obj:
            obj.name = tournament["name"]
            obj.location = tournament["location"]
            start_dt = parse_datetime_utc(tournament["start_date"])
            end_dt = parse_datetime_utc(tournament["end_date"])
            obj.start_date = start_dt.date() if start_dt else None
            obj.end_date = end_dt.date() if end_dt else None
            obj.status = tournament["status"]
        else:
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
        await db.flush()  # so we have obj.id

        # --- CLEAN old matches (not started/finished)
        for bracket in await db.execute(select(Bracket).where(Bracket.tournament_id == obj.id)):
            b = bracket[0]
            to_delete = await db.execute(
                select(BracketMatch).where(
                    BracketMatch.bracket_id == b.id,
                    BracketMatch.match.has(Match.status.notin_(["started", "finished"])),
                )
            )
            for bm in to_delete.scalars():
                await db.execute(delete(MatchState).where(MatchState.match_id == bm.match_id))
                await db.delete(bm.match)
                await db.delete(bm)

        # --- INSERT updated brackets & matches
        for b in brackets_with_matches:
            bracket = await db.execute(select(Bracket).where(Bracket.external_id == b["bracket_id"]))
            bracket_obj = bracket.scalar_one_or_none()
            if not bracket_obj:
                bracket_obj = Bracket(
                    external_id=b["bracket_id"],
                    tournament_id=obj.id,
                )
                db.add(bracket_obj)
            bracket_obj.category = b["category"]
            bracket_obj.type = b["type"]
            bracket_obj.tatami = b.get("tatami")
            bracket_obj.group_id = b.get("group_id") or 1
            bracket_obj.start_time = b.get("start_time") or "09:00"
            bracket_obj.status = b["status"]
            bracket_obj.display_name = b.get("display_name") or b["category"]

            for bm in b["matches"]:
                match_data = bm["match"]
                athlete1 = athlete2 = None

                if match_data["athlete1"]:
                    athlete1 = await db.execute(
                        select(Athlete).where(Athlete.external_id == match_data["athlete1"]["id"])
                    )
                    athlete1 = athlete1.scalar_one_or_none()
                    if not athlete1:
                        athlete1 = Athlete(
                            external_id=match_data["athlete1"]["id"],
                            first_name=match_data["athlete1"]["first_name"],
                            last_name=match_data["athlete1"]["last_name"],
                            coaches_last_name=", ".join(match_data["athlete1"].get("coaches_last_name", [])),
                        )
                        db.add(athlete1)
                        await db.flush()

                if match_data["athlete2"]:
                    athlete2 = await db.execute(
                        select(Athlete).where(Athlete.external_id == match_data["athlete2"]["id"])
                    )
                    athlete2 = athlete2.scalar_one_or_none()
                    if not athlete2:
                        athlete2 = Athlete(
                            external_id=match_data["athlete2"]["id"],
                            first_name=match_data["athlete2"]["first_name"],
                            last_name=match_data["athlete2"]["last_name"],
                            coaches_last_name=", ".join(match_data["athlete2"].get("coaches_last_name", [])),
                        )
                        db.add(athlete2)
                        await db.flush()

                match = Match(
                    external_id=match_data["id"],
                    athlete1_id=athlete1.id if athlete1 else None,
                    athlete2_id=athlete2.id if athlete2 else None,
                    winner_id=match_data["winner"]["id"] if match_data.get("winner") and match_data["winner"] else None,
                    score_athlete1=match_data.get("score_athlete1"),
                    score_athlete2=match_data.get("score_athlete2"),
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
                    )
                )

        await db.commit()
        return {"status": "success", "message": f"Tournament {tournament_id} synced successfully"}

    except Exception as e:
        await db.rollback()
        print(f"Sync failed: {e}")
        return {"status": "error", "message": f"Sync failed: {str(e)}"}
