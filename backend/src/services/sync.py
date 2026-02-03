from datetime import time
from typing import Optional

import httpx
from sqlalchemy import delete, select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import EXTERNAL_API_TOKEN, EXTERNAL_API_URL
from src.logger import logger
from src.models import Athlete, Bracket, BracketMatch, BracketParticipant, Match, TimetableEntry, Tournament
from src.utils import parse_datetime_utc


def _parse_time_value(raw: str | None) -> Optional[time]:
    if not raw:
        return None
    candidate = raw.strip()
    try:
        return time.fromisoformat(candidate)
    except ValueError:
        pass

    if len(candidate) == 5:
        try:
            return time.fromisoformat(f"{candidate}:00")
        except ValueError:
            return None
    return None


async def _upsert_athlete_from_payload(db: AsyncSession, athlete_payload: dict | None) -> Optional[Athlete]:
    if not athlete_payload:
        return None

    ext_id = athlete_payload.get("id")
    if ext_id is None:
        return None

    athlete_query = select(Athlete).where(Athlete.external_id == ext_id)
    athlete_result = await db.execute(athlete_query)
    athlete = athlete_result.scalar_one_or_none()

    if athlete:
        athlete.first_name = athlete_payload.get("first_name") or athlete.first_name
        athlete.last_name = athlete_payload.get("last_name") or athlete.last_name
        athlete.coaches_last_name = ", ".join(athlete_payload.get("coaches_last_name", []))
    else:
        athlete = Athlete(
            external_id=ext_id,
            first_name=athlete_payload.get("first_name") or "",
            last_name=athlete_payload.get("last_name") or "",
            coaches_last_name=", ".join(athlete_payload.get("coaches_last_name", [])),
        )
        db.add(athlete)
        await db.flush()

    return athlete


async def _upsert_athlete_from_participant_payload(db: AsyncSession, participant_payload: dict) -> Optional[Athlete]:
    ext_id = participant_payload.get("athlete_id")
    if ext_id is None:
        return None

    athlete_query = select(Athlete).where(Athlete.external_id == ext_id)
    athlete_result = await db.execute(athlete_query)
    athlete = athlete_result.scalar_one_or_none()

    coaches = participant_payload.get("coaches_last_name")
    if isinstance(coaches, list):
        coaches_last_name = ", ".join(coaches)
    elif isinstance(coaches, str):
        coaches_last_name = coaches
    else:
        coaches_last_name = ""

    if athlete:
        athlete.first_name = participant_payload.get("first_name") or athlete.first_name
        athlete.last_name = participant_payload.get("last_name") or athlete.last_name
        athlete.coaches_last_name = coaches_last_name or athlete.coaches_last_name
    else:
        athlete = Athlete(
            external_id=ext_id,
            first_name=participant_payload.get("first_name") or "",
            last_name=participant_payload.get("last_name") or "",
            coaches_last_name=coaches_last_name,
        )
        db.add(athlete)
        await db.flush()

    return athlete


async def _upsert_match(
    db: AsyncSession,
    match_data: dict,
    athlete1: Optional[Athlete],
    athlete2: Optional[Athlete],
) -> Match:
    match_query = select(Match).where(Match.external_id == match_data["id"])
    match_result = await db.execute(match_query)
    match = match_result.scalar_one_or_none()

    winner_payload = match_data.get("winner")
    winner_local_id: Optional[int] = None
    if winner_payload and winner_payload.get("id") is not None:
        winner_ext_id = winner_payload["id"]
        if athlete1 and athlete1.external_id == winner_ext_id:
            winner_local_id = athlete1.id
        elif athlete2 and athlete2.external_id == winner_ext_id:
            winner_local_id = athlete2.id
        else:
            winner_athlete = await _upsert_athlete_from_payload(db, winner_payload)
            winner_local_id = winner_athlete.id if winner_athlete else None

    if match:
        match.athlete1_id = athlete1.id if athlete1 else None
        match.athlete2_id = athlete2.id if athlete2 else None
        match.winner_id = winner_local_id
        match.score_athlete1 = match_data.get("score_athlete1")
        match.score_athlete2 = match_data.get("score_athlete2")
        match.status = match_data["status"]
        match.started_at = parse_datetime_utc(match_data.get("started_at"))
        match.ended_at = parse_datetime_utc(match_data.get("ended_at"))
    else:
        match = Match(
            external_id=match_data["id"],
            athlete1_id=athlete1.id if athlete1 else None,
            athlete2_id=athlete2.id if athlete2 else None,
            winner_id=winner_local_id,
            score_athlete1=match_data.get("score_athlete1"),
            score_athlete2=match_data.get("score_athlete2"),
            status=match_data["status"],
            started_at=parse_datetime_utc(match_data.get("started_at")),
            ended_at=parse_datetime_utc(match_data.get("ended_at")),
        )
        db.add(match)
        await db.flush()

    return match


async def _sync_bracket_participants(
    db: AsyncSession,
    bracket: Bracket,
    remote_participants: list[dict],
) -> None:
    await db.execute(delete(BracketParticipant).where(BracketParticipant.bracket_id == bracket.id))

    for item in sorted(remote_participants, key=lambda p: int(p.get("seed") or 0)):
        seed = item.get("seed")
        if not isinstance(seed, int) or seed < 1:
            continue

        athlete = await _upsert_athlete_from_participant_payload(db, item)
        db.add(
            BracketParticipant(
                bracket_id=bracket.id,
                athlete_id=athlete.id if athlete else None,
                seed=seed,
            )
        )


async def _sync_timetable_entries(db: AsyncSession, tournament: Tournament, remote_entries: list[dict]) -> int:
    bracket_rows = await db.execute(select(Bracket).where(Bracket.tournament_id == tournament.id))
    bracket_by_external_id = {br.external_id: br for br in bracket_rows.scalars().all()}

    await db.execute(delete(TimetableEntry).where(TimetableEntry.tournament_id == tournament.id))

    synced_count = 0
    for item in remote_entries:
        if not isinstance(item, dict):
            continue

        start_time = _parse_time_value(item.get("start_time"))
        end_time = _parse_time_value(item.get("end_time"))
        if start_time is None or end_time is None:
            logger.warning("Skipping timetable entry due to invalid time fields: %s", item.get("id"))
            continue

        bracket_external_id = item.get("bracket_id")
        bracket = bracket_by_external_id.get(bracket_external_id) if isinstance(bracket_external_id, int) else None

        db.add(
            TimetableEntry(
                tournament_id=tournament.id,
                bracket_id=bracket.id if bracket is not None else None,
                entry_type=str(item.get("entry_type") or "custom"),
                title=item.get("title"),
                notes=item.get("notes"),
                day=int(item.get("day") or 1),
                tatami=int(item.get("tatami") or 1),
                start_time=start_time,
                end_time=end_time,
                order_index=int(item.get("order_index") or 0),
            )
        )
        synced_count += 1

    return synced_count


async def sync_tournament(tournament_id: int, db: AsyncSession, force: bool = False) -> dict[str, str]:
    try:
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

            brackets_resp = await client.get(
                f"{EXTERNAL_API_URL}/tournaments/{tournament_id}/brackets", headers=headers
            )
            brackets_resp.raise_for_status()
            brackets_full = brackets_resp.json()

            timetable_resp = await client.get(
                f"{EXTERNAL_API_URL}/tournaments/{tournament_id}/timetable", headers=headers
            )
            timetable_resp.raise_for_status()
            timetable_entries = timetable_resp.json()

        participants_by_bracket_external_id: dict[int, list[dict]] = {
            int(item["id"]): item.get("participants", [])
            for item in brackets_full
            if isinstance(item, dict) and item.get("id") is not None
        }

        tournament_query = select(Tournament).where(Tournament.external_id == tournament["id"])
        result: Result[tuple[Tournament]] = await db.execute(tournament_query)
        obj: Optional[Tournament] = result.scalar_one_or_none()

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

        updated_brackets = 0
        created_brackets = 0
        skipped_brackets = 0
        force_overridden_brackets = 0

        for b in brackets_with_matches:
            bracket_query = select(Bracket).where(Bracket.external_id == b["bracket_id"])
            bracket_result = await db.execute(bracket_query)
            bracket_obj = bracket_result.scalar_one_or_none()

            remote_status = b["status"]
            remote_state = b.get("state") or (
                "finished" if remote_status == "finished" else "running" if remote_status == "started" else "draft"
            )
            remote_version = int(b.get("version") or 1)

            if bracket_obj and bracket_obj.state in {"running", "finished"} and not force:
                skipped_brackets += 1
                logger.warning(
                    "Skipping bracket sync for external_id=%s due to immutable local state=%s",
                    b["bracket_id"],
                    bracket_obj.state,
                )
                continue

            if bracket_obj and bracket_obj.state in {"running", "finished"} and force:
                force_overridden_brackets += 1
                logger.warning(
                    "Force sync override for external_id=%s from local state=%s",
                    b["bracket_id"],
                    bracket_obj.state,
                )

            if bracket_obj is None:
                bracket_obj = Bracket(
                    external_id=b["bracket_id"],
                    tournament_id=obj.id,
                    category=b["category"],
                    type=b["type"],
                    group_id=b.get("group_id") or 1,
                    status=remote_status,
                    state=remote_state,
                    version=remote_version,
                    display_name=b.get("display_name") or b["category"],
                )
                db.add(bracket_obj)
                await db.flush()
                created_brackets += 1
            else:
                bracket_obj.tournament_id = obj.id
                bracket_obj.category = b["category"]
                bracket_obj.type = b["type"]
                bracket_obj.group_id = b.get("group_id") or 1
                bracket_obj.status = remote_status
                bracket_obj.state = remote_state
                bracket_obj.version = remote_version
                bracket_obj.display_name = b.get("display_name") or b["category"]
                updated_brackets += 1

            incoming_bm_external_ids: set[str] = set()
            for bm in b["matches"]:
                incoming_bm_external_ids.add(bm["id"])
                match_data = bm["match"]

                athlete1 = await _upsert_athlete_from_payload(db, match_data.get("athlete1"))
                athlete2 = await _upsert_athlete_from_payload(db, match_data.get("athlete2"))

                match = await _upsert_match(db, match_data, athlete1, athlete2)

                bm_query = select(BracketMatch).where(BracketMatch.external_id == bm["id"])
                bm_result = await db.execute(bm_query)
                bm_obj = bm_result.scalar_one_or_none()

                if bm_obj:
                    bm_obj.bracket_id = bracket_obj.id
                    bm_obj.match_id = match.id
                    bm_obj.round_number = bm["round_number"]
                    bm_obj.position = bm["position"]
                    bm_obj.next_slot = bm.get("next_slot")
                else:
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

            remote_participants = participants_by_bracket_external_id.get(int(b["bracket_id"]), [])
            await _sync_bracket_participants(db, bracket_obj, remote_participants)

            existing_bm_result = await db.execute(select(BracketMatch).where(BracketMatch.bracket_id == bracket_obj.id))
            for existing_bm in existing_bm_result.scalars().all():
                if existing_bm.external_id not in incoming_bm_external_ids:
                    await db.delete(existing_bm)

        synced_timetable_entries = await _sync_timetable_entries(db, obj, timetable_entries)

        orphan_matches = await db.execute(select(Match).where(~Match.bracket_matches.any()))
        for orphan in orphan_matches.scalars().all():
            await db.delete(orphan)

        await db.commit()
        return {
            "status": "success",
            "message": (
                f"Tournament {tournament_id} synced: created_brackets={created_brackets}, "
                f"updated_brackets={updated_brackets}, skipped_brackets={skipped_brackets}, "
                f"force_overridden_brackets={force_overridden_brackets}, "
                f"synced_timetable_entries={synced_timetable_entries}"
            ),
        }

    except Exception as e:
        await db.rollback()
        logger.error(f"Sync failed: {e}")
        return {"status": "error", "message": f"Sync failed: {str(e)}"}
