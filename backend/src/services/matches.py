from typing import List, Dict, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import BracketMatch, Match, MatchType


async def advance_participants(db: AsyncSession, bracket_id: int) -> None:
    # --- 1. Общее количество раундов MAIN ---
    total_rounds: int = (
            await db.scalar(
                select(func.max(BracketMatch.round_number))
                .filter_by(bracket_id=bracket_id, match_type=MatchType.MAIN.value)
            ) or 1
    )
    repechage_depth: int = max(1, total_rounds - 1)

    # --- 2. Загружаем все BracketMatch ---
    result = await db.execute(
        select(BracketMatch)
        .filter_by(bracket_id=bracket_id)
        .options(selectinload(BracketMatch.match))
        .order_by(BracketMatch.round_number, BracketMatch.position)
    )
    matches: List[BracketMatch] = list(result.scalars().all())

    # --- 3. Матрица по раундам ---
    match_matrix: List[List[BracketMatch]] = [[] for _ in range(total_rounds + repechage_depth)]
    for m in matches:
        match_matrix[m.round_number - 1].append(m)

    # --- 4. Продвижение победителей в MAIN ---
    for round_index in range(total_rounds - 1):
        current_round = [m for m in match_matrix[round_index] if m.match_type == MatchType.MAIN.value]
        next_round = [m for m in match_matrix[round_index + 1] if m.match_type == MatchType.MAIN.value]

        for bm in current_round:
            match = bm.match
            if not match or match.status != "finished" or not match.winner_id:
                continue

            next_position = (bm.position + 1) // 2
            next_bm = next((m for m in next_round if m.position == next_position), None)
            if next_bm:
                next_match = await db.get(Match, next_bm.match_id)
                if next_match:
                    if bm.position % 2 == 1:
                        next_match.athlete1_id = match.winner_id
                    else:
                        next_match.athlete2_id = match.winner_id

    # --- 5. Продвижение победителей в REPECHAGE ---
    for branch in ["A", "B"]:
        for round_index in range(total_rounds, total_rounds + repechage_depth - 1):
            current_round = [
                m for m in match_matrix[round_index] if m.match_type == f"REPECHAGE_{branch}"
            ]
            next_round = [
                m for m in match_matrix[round_index + 1] if m.match_type == f"REPECHAGE_{branch}"
            ]

            for bm in current_round:
                match = bm.match
                if not match or match.status != "finished" or not match.winner_id:
                    continue

                if next_round:
                    next_bm = next_round[0]
                    next_match = await db.get(Match, next_bm.match_id)
                    if next_match:
                        if not next_match.athlete1_id:
                            next_match.athlete1_id = match.winner_id
                        elif not next_match.athlete2_id:
                            next_match.athlete2_id = match.winner_id

    # --- 6. Триггер репазажа после полуфиналов ---
    semifinal_matches: List[BracketMatch] = [
        m for m in match_matrix[total_rounds - 2]
        if m.match_type == MatchType.MAIN.value
           and m.match
           and m.match.round_type == "semifinal"
           and m.match.status == "finished"
    ]

    if len(semifinal_matches) == 2:
        finalists: List[int] = [bm.match.winner_id for bm in semifinal_matches if bm.match.winner_id]
        for finalist_id, branch in zip(finalists, ["A", "B"]):
            losers: List[Dict[str, int]] = await get_losers_to_finalist(db, finalist_id, bracket_id, total_rounds)

            repechage_matches: List[BracketMatch] = [
                m
                for round_matches in match_matrix[total_rounds: total_rounds + repechage_depth]
                for m in round_matches
                if m.match_type == f"REPECHAGE_{branch}"
            ]
            repechage_matches.sort(key=lambda m: (m.round_number, m.position))

            # Первый раунд репазажа
            first_round_repechage = [m for m in repechage_matches if m.round_number == total_rounds + 1]
            for loser, rm in zip(losers, first_round_repechage):
                rm_match = await db.get(Match, rm.match_id)
                if rm_match:
                    if not rm_match.athlete1_id:
                        rm_match.athlete1_id = loser["loser_id"]
                    elif not rm_match.athlete2_id:
                        rm_match.athlete2_id = loser["loser_id"]

            # --- 7. Бронзовый матч ---
            bronze_match_bm = next(
                (m for m in repechage_matches if m.match.round_type == "bronze"), None
            )
            if bronze_match_bm:
                bronze_match = await db.get(Match, bronze_match_bm.match_id)
                if bronze_match:
                    # Определяем проигравшего полуфинала
                    semi = semifinal_matches[0 if branch == "A" else 1].match
                    if semi and semi.athlete1_id and semi.athlete2_id:
                        loser_id = semi.athlete1_id if semi.winner_id == semi.athlete2_id else semi.athlete2_id
                        bronze_match.athlete1_id = loser_id

                    # Определяем победителя финала репазажа
                    repechage_final = next(
                        (
                            m for m in repechage_matches
                            if m.match.round_type == f"round_{repechage_depth}"
                               and m.match.status == "finished"
                        ),
                        None,
                    )
                    if repechage_final and repechage_final.match.winner_id:
                        bronze_match.athlete2_id = repechage_final.match.winner_id

    await db.flush()


async def get_losers_to_finalist(
        db: AsyncSession, finalist_id: int, bracket_id: int, total_rounds: int
) -> List[Dict[str, int]]:
    losers: List[Dict[str, int]] = []

    for round_index in range(1, total_rounds + 1):
        result = await db.execute(
            select(BracketMatch)
            .filter_by(bracket_id=bracket_id, match_type=MatchType.MAIN.value, round_number=round_index)
            .options(selectinload(BracketMatch.match))
        )
        for bm in result.scalars():
            match: Optional[Match] = bm.match
            if (
                    match
                    and match.winner_id == finalist_id
                    and match.athlete1_id is not None
                    and match.athlete2_id is not None
                    and match.status == "finished"
            ):
                # Определяем проигравшего
                loser_id: int = (
                    match.athlete1_id if match.winner_id == match.athlete2_id else match.athlete2_id
                )
                losers.append({"loser_id": loser_id, "round_number": bm.round_number})

    losers.sort(key=lambda x: x["round_number"] if x["round_number"] is not None else 0, reverse=True)
    return losers
