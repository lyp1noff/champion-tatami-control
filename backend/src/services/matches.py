from datetime import datetime, timezone
from uuid import uuid4

from champion_domain import (
    FinishedMainMatch,
    ProgressionAction,
    classify_bracket_match,
    compute_main_rounds,
    decide_finish_flow_post,
    decide_finish_flow_runtime,
    plan_repechage_generation,
    should_generate_repechage,
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


async def _load_match_by_external_id(db: AsyncSession, match_id: str) -> Match | None:
    result = await db.execute(select(Match).where(Match.external_id == match_id))
    return result.scalar_one_or_none()


async def _load_match_by_external_id_or_404(db: AsyncSession, match_id: str) -> Match:
    match = await _load_match_by_external_id(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
    return match


async def _apply_winner_to_next_match(
    db: AsyncSession,
    bm: BracketMatch,
    winner_id: int,
    action: ProgressionAction,
) -> None:
    if action.kind == "repechage":
        if action.repechage_round_number is None or action.repechage_position is None:
            return
        next_bm = (
            await db.execute(
                select(BracketMatch).where(
                    BracketMatch.bracket_id == bm.bracket_id,
                    BracketMatch.round_number == action.repechage_round_number,
                    BracketMatch.position == action.repechage_position,
                )
            )
        ).scalar_one_or_none()
        if next_bm is None:
            return
        next_match = await db.get(Match, next_bm.match_id)
        if next_match is not None:
            next_match.athlete1_id = winner_id
        return

    if action.kind == "main":
        if action.main_round_number is None or action.main_position is None:
            return
        next_bm = (
            await db.execute(
                select(BracketMatch).where(
                    BracketMatch.bracket_id == bm.bracket_id,
                    BracketMatch.round_number == action.main_round_number,
                    BracketMatch.position == action.main_position,
                )
            )
        ).scalar_one_or_none()
        if next_bm is None:
            return
        next_match = await db.get(Match, next_bm.match_id)
        if next_match is None or next_match.stage != "main":
            return
        if action.slot == 1:
            next_match.athlete1_id = winner_id
        else:
            next_match.athlete2_id = winner_id


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
    if bracket is None:
        return False

    main_rounds = await _get_main_rounds_count(bracket_id, db)

    has_repechage_matches = bool(
        await db.scalar(
            select(func.count())
            .select_from(BracketMatch)
            .where(
                BracketMatch.bracket_id == bracket_id,
                BracketMatch.round_number > main_rounds,
            )
        )
    )

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
    finalist_a_id = final_match.athlete1_id if final_match is not None else None
    finalist_b_id = final_match.athlete2_id if final_match is not None else None
    if not should_generate_repechage(
        bracket_type=bracket.type,
        main_rounds=main_rounds,
        has_repechage_matches=has_repechage_matches,
        finalist_a_id=finalist_a_id,
        finalist_b_id=finalist_b_id,
    ):
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

    generation = plan_repechage_generation(
        finalist_a_id=finalist_a_id,
        finalist_b_id=finalist_b_id,
        finished_main_matches=finished_main_matches,
        base_round=base_round,
    )
    logger.info(
        "repechage_plan bracket_id=%s main_rounds=%s finished_main=%s plans=%s",
        bracket_id,
        main_rounds,
        len(finished_main_matches),
        len(generation.plans),
    )

    if not generation.plans:
        return False

    for plan in generation.plans:
        rep_match = Match(
            external_id=str(uuid4()),
            athlete1_id=plan.athlete1_id,
            athlete2_id=plan.athlete2_id,
            round_type="round",
            stage="repechage",
            repechage_side=plan.side,
            repechage_step=plan.step,
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
                next_slot=1 if plan.step < generation.max_step_by_side.get(plan.side, plan.step) else None,
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
    match = await _load_match_by_external_id_or_404(db, match_id)

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
    match = await _load_match_by_external_id_or_404(db, match_id)

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
        stage = match.stage or ("repechage" if classification.is_repechage else "main")
        is_repechage_match = stage == "repechage"
        repechage_side = match.repechage_side or classification.repechage_side
        repechage_step = match.repechage_step if match.repechage_step is not None else classification.repechage_step

        runtime = decide_finish_flow_runtime(
            origin="local",
            stage=stage,
            current_round_number=bm.round_number,
            current_position=bm.position,
            explicit_next_slot=bm.next_slot,
            repechage_side=repechage_side,
            repechage_step=repechage_step,
            allow_implicit_main_slot=False,
            main_rounds=main_rounds,
        )
        action = runtime.progression_action
        if action is not None:
            await _apply_winner_to_next_match(
                db,
                bm,
                match.winner_id,
                action,
            )

        generated_repechage = False
        if runtime.attempt_generate_repechage:
            generated_repechage = await _ensure_repechage_generated(bm.bracket_id, db)

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
            post = decide_finish_flow_post(
                is_repechage_match=is_repechage_match,
                generated_repechage=generated_repechage,
                total_matches=total_matches,
                finished_matches=finished_matches,
                current_bracket_status=bracket.status,
            )
            needs_structure_publish = post.publish_structure
            if post.completion.should_finish_bracket:
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
    match = await _load_match_by_external_id_or_404(db, match_id)

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
