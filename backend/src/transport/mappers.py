from champion_domain import classify_bracket_match

from src.models import Athlete, BracketMatch, Match
from src.schemas import AthleteSchema, BracketMatchSchema, MatchSchema, MatchWithBracketSchema


def to_athlete_schema(athlete: Athlete | None) -> AthleteSchema | None:
    if athlete is None:
        return None
    return AthleteSchema(
        id=athlete.id,
        external_id=athlete.external_id,
        first_name=athlete.first_name,
        last_name=athlete.last_name,
        coaches_last_name=athlete.coaches_last_name,
    )


def to_match_with_bracket_schema(match: Match) -> MatchWithBracketSchema:
    bracket_display_name = ""
    if match.bracket_matches:
        bracket_display_name = match.bracket_matches[0].bracket.display_name or ""
    return MatchWithBracketSchema(
        id=match.id,
        bracket_display_name=bracket_display_name,
        external_id=match.external_id,
        round_type=match.round_type,
        stage=match.stage,
        repechage_side=match.repechage_side,
        repechage_step=match.repechage_step,
        athlete1=to_athlete_schema(match.athlete1),
        athlete2=to_athlete_schema(match.athlete2),
        winner_id=match.winner_id,
        score_athlete1=match.score_athlete1,
        score_athlete2=match.score_athlete2,
        status=match.status,
        started_at=match.started_at,
        ended_at=match.ended_at,
    )


def to_bracket_match_schema(bracket_match: BracketMatch, main_rounds: int) -> BracketMatchSchema:
    match = bracket_match.match
    round_type = match.round_type
    if round_type is None:
        round_type = classify_bracket_match(
            round_number=bracket_match.round_number,
            position=bracket_match.position,
            main_rounds=main_rounds,
        ).round_type
    return BracketMatchSchema(
        id=bracket_match.id,
        external_id=bracket_match.external_id,
        round_number=bracket_match.round_number,
        position=bracket_match.position,
        next_slot=bracket_match.next_slot,
        match=MatchSchema(
            id=match.id,
            external_id=match.external_id,
            round_type=round_type,
            stage=match.stage,
            repechage_side=match.repechage_side,
            repechage_step=match.repechage_step,
            athlete1=to_athlete_schema(match.athlete1),
            athlete2=to_athlete_schema(match.athlete2),
            winner_id=match.winner_id,
            score_athlete1=match.score_athlete1,
            score_athlete2=match.score_athlete2,
            status=match.status,
            started_at=match.started_at,
            ended_at=match.ended_at,
        ),
    )
