from datetime import datetime, timezone
from uuid import uuid4

from champion_domain import (
    FinishedMainMatch,
    build_repechage_plan,
    classify_bracket_match,
    compute_main_rounds,
    compute_next_match_target,
    is_bracket_finished,
)
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.logger import logger
from src.models import Athlete, Bracket, BracketMatch, BracketParticipant, Match
from src.schemas import FinishMatchSchema, MatchWithBracketSchema, UpdateMatchScoresSchema
from src.services.outbox import (
    create_bracket_structure_rebuilt_outbox,
    create_match_finish_outbox,
    create_match_scores_outbox,
    create_match_start_outbox,
)
from src.transport.mappers import to_match_with_bracket_schema


async def _get_bracket_for_match(match_id: int, db: AsyncSession) -> Bracket | None:
    result = await db.execute(
        select(Bracket)
        .join(BracketMatch, BracketMatch.bracket_id == Bracket.id)
        .where(BracketMatch.match_id == match_id)
    )
    return result.scalar_one_or_none()


async def _get_main_rounds_count(bracket_id: int, db: AsyncSession) -> int:
    participants_count = await db.scalar(
        select(func.count())
        .select_from(BracketParticipant)
        .where(BracketParticipant.bracket_id == bracket_id, BracketParticipant.athlete_id.is_not(None))
    )
    count = int(participants_count) if participants_count is not None else None
    return int(compute_main_rounds(count))


async def _ensure_repechage_generated(bracket_id: int, db: AsyncSession) -> bool:
    bracket = await db.get(Bracket, bracket_id)
    if bracket is None or bracket.type != "single_elimination":
        return False

    main_rounds = await _get_main_rounds_count(bracket_id, db)
    if main_rounds < 2:
        return False

    repechage_exists = await db.scalar(
        select(func.count())
        .select_from(BracketMatch)
        .where(
            BracketMatch.bracket_id == bracket_id,
            BracketMatch.round_number > main_rounds,
        )
    )
    if repechage_exists:
        return False

    final_bm = (
        await db.execute(
            select(BracketMatch).where(
                BracketMatch.bracket_id == bracket_id,
                BracketMatch.round_number == main_rounds,
                BracketMatch.position == 1,
            )
        )
    ).scalar_one_or_none()
    if final_bm is None:
        return False

    final_match = await db.get(Match, final_bm.match_id)
    if final_match is None or final_match.athlete1_id is None or final_match.athlete2_id is None:
        return False

    finished_main_rows = (
        await db.execute(
            select(BracketMatch, Match)
            .join(Match, Match.id == BracketMatch.match_id)
            .where(
                BracketMatch.bracket_id == bracket_id,
                BracketMatch.round_number < main_rounds,
                Match.status == "finished",
            )
        )
    ).all()

    finished_main_matches = [
        FinishedMainMatch(
            round_number=bm_row.round_number,
            winner_id=match.winner_id,
            athlete1_id=match.athlete1_id,
            athlete2_id=match.athlete2_id,
        )
        for bm_row, match in finished_main_rows
    ]

    max_round = await db.scalar(
        select(func.max(BracketMatch.round_number)).where(BracketMatch.bracket_id == bracket_id)
    )
    base_round = int(max_round or main_rounds) + 1

    plans = build_repechage_plan(
        finalist_a_id=final_match.athlete1_id,
        finalist_b_id=final_match.athlete2_id,
        finished_main_matches=finished_main_matches,
        base_round=base_round,
    )
    logger.info(
        "repechage_plan bracket_id=%s main_rounds=%s finished_main=%s plans=%s",
        bracket_id,
        main_rounds,
        len(finished_main_matches),
        len(plans),
    )

    if not plans:
        return False

    max_step_by_side: dict[str, int] = {}
    for plan in plans:
        max_step_by_side[plan.side] = max(max_step_by_side.get(plan.side, 0), plan.step)

    for plan in plans:
        rep_match = Match(
            external_id=str(uuid4()),
            athlete1_id=plan.athlete1_id,
            athlete2_id=plan.athlete2_id,
            status="not_started",
        )
        db.add(rep_match)
        await db.flush()
        db.add(
            BracketMatch(
                external_id=str(uuid4()),
                bracket_id=bracket_id,
                round_number=plan.round_number,
                position=plan.position,
                match_id=rep_match.id,
                next_slot=1 if plan.step < max_step_by_side.get(plan.side, plan.step) else None,
            )
        )
    return True


def _touch_bracket(bracket: Bracket) -> int:
    bracket.version = (bracket.version or 0) + 1
    if bracket.status == "started":
        bracket.state = "running"
    elif bracket.status == "finished":
        bracket.state = "finished"
    return bracket.version


async def get_match(match_id: str, db: AsyncSession) -> MatchWithBracketSchema:
    result = await db.execute(
        select(Match)
        .where(Match.external_id == match_id)
        .options(
            selectinload(Match.athlete1),
            selectinload(Match.athlete2),
            selectinload(Match.bracket_matches).selectinload(BracketMatch.bracket),
        )
    )
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
    return to_match_with_bracket_schema(match)


async def start_match(match_id: str, db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status == "started":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already in progress")

    if match.status == "finished":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already finished")

    if match.athlete1_id is None or match.athlete2_id is None:
        raise HTTPException(status_code=400, detail="Match has no athletes")

    match.status = "started"
    match.started_at = datetime.now(timezone.utc)

    bracket = await _get_bracket_for_match(match.id, db)
    aggregate_version = 1
    if bracket is not None:
        if bracket.status != "finished":
            bracket.status = "started"
        bracket.state = "running"
        aggregate_version = _touch_bracket(bracket)

    await create_match_start_outbox(match, aggregate_version, db)
    await db.commit()

    return {"message": f"Match {match_id} started successfully"}


async def finish_match(match_id: str, finish_data: FinishMatchSchema, db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status == "finished":
        raise HTTPException(status_code=400, detail=f"Match {match_id} is already finished")

    if match.status == "not_started":
        raise HTTPException(status_code=400, detail=f"Match {match_id} has not been started")

    if finish_data.winner_id not in [match.athlete1_id, match.athlete2_id]:
        raise HTTPException(
            status_code=400,
            detail=f"Winner ID {finish_data.winner_id} does not match either athlete in the match",
        )

    winner = await db.get(Athlete, finish_data.winner_id)
    if winner is None:
        raise HTTPException(status_code=400, detail=f"Winner athlete {finish_data.winner_id} not found")

    match.score_athlete1 = finish_data.score_athlete1
    match.score_athlete2 = finish_data.score_athlete2
    match.winner_id = finish_data.winner_id
    match.status = "finished"
    match.ended_at = datetime.now(timezone.utc)

    bm_result = await db.execute(select(BracketMatch).where(BracketMatch.match_id == match.id))
    bm = bm_result.scalar_one_or_none()

    bracket = await _get_bracket_for_match(match.id, db)
    aggregate_version = 1
    if bracket is not None:
        aggregate_version = _touch_bracket(bracket)

    needs_structure_publish = False

    if bm:
        main_rounds = await _get_main_rounds_count(bm.bracket_id, db)
        classification = classify_bracket_match(
            round_number=bm.round_number,
            position=bm.position,
            main_rounds=main_rounds,
        )
        is_repechage_match = classification.is_repechage

        if is_repechage_match:
            target = compute_next_match_target(
                stage="repechage",
                current_round_number=bm.round_number,
                current_position=bm.position,
                explicit_next_slot=None,
                repechage_side=classification.repechage_side,
                repechage_step=classification.repechage_step,
            )
            if target is not None:
                next_round = main_rounds + int(target.repechage_step or 0)
                next_bm = (
                    await db.execute(
                        select(BracketMatch).where(
                            BracketMatch.bracket_id == bm.bracket_id,
                            BracketMatch.round_number == next_round,
                            BracketMatch.position == bm.position,
                        )
                    )
                ).scalar_one_or_none()
                if next_bm is not None:
                    next_match = await db.get(Match, next_bm.match_id)
                    if next_match is not None:
                        next_match.athlete1_id = match.winner_id
        else:
            target = compute_next_match_target(
                stage="main",
                current_round_number=bm.round_number,
                current_position=bm.position,
                explicit_next_slot=None,
                allow_implicit_main_slot=True,
            )
            if target is not None:
                next_bm_result = await db.execute(
                    select(BracketMatch).where(
                        BracketMatch.bracket_id == bm.bracket_id,
                        BracketMatch.round_number == target.round_number,
                        BracketMatch.position == target.position,
                    )
                )
                next_bm = next_bm_result.scalar_one_or_none()

                if next_bm:
                    next_match = await db.get(Match, next_bm.match_id)
                    if next_match:
                        if target.slot == 1:
                            next_match.athlete1_id = match.winner_id
                        else:
                            next_match.athlete2_id = match.winner_id
            generated = await _ensure_repechage_generated(bm.bracket_id, db)
            if generated:
                needs_structure_publish = True

        if bracket is not None:
            total_matches = await db.scalar(
                select(func.count()).select_from(BracketMatch).where(BracketMatch.bracket_id == bm.bracket_id)
            )
            finished_matches = await db.scalar(
                select(func.count())
                .select_from(Match)
                .join(BracketMatch, BracketMatch.match_id == Match.id)
                .where(BracketMatch.bracket_id == bm.bracket_id, Match.status == "finished")
            )
            if is_bracket_finished(total_matches, finished_matches):
                bracket.status = "finished"
                bracket.state = "finished"

    await create_match_finish_outbox(
        match,
        winner.external_id,
        finish_data.score_athlete1,
        finish_data.score_athlete2,
        aggregate_version,
        db,
    )

    if needs_structure_publish and bracket is not None:
        # `match.finished` already used current version; move structure snapshot to next version.
        _touch_bracket(bracket)
        await create_bracket_structure_rebuilt_outbox(bracket, db)

    await db.commit()
    return {"message": f"Match {match_id} finished successfully"}


async def update_match_scores(match_id: str, scores_data: UpdateMatchScoresSchema, db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")

    if match.status != "started":
        raise HTTPException(status_code=400, detail=f"Cannot update scores for not started match {match_id}")

    if scores_data.score_athlete1 is not None:
        match.score_athlete1 = scores_data.score_athlete1

    if scores_data.score_athlete2 is not None:
        match.score_athlete2 = scores_data.score_athlete2

    bracket = await _get_bracket_for_match(match.id, db)
    aggregate_version = 1
    if bracket is not None:
        aggregate_version = _touch_bracket(bracket)

    await create_match_scores_outbox(match, aggregate_version, db)
    await db.commit()
    return {"message": f"Scores updated for match {match_id}"}
