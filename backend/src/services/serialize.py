from src.models import Athlete, BracketMatch, Match
from src.schemas import AthleteSchema, BracketMatchSchema, MatchSchema, MatchWithBracketSchema


def serialize_athlete(athlete: Athlete) -> AthleteSchema:
    return AthleteSchema(
        id=athlete.id,
        external_id=athlete.external_id,
        first_name=athlete.first_name,
        last_name=athlete.last_name,
        coaches_last_name=athlete.coaches_last_name,
    )


def serialize_match(match: Match) -> MatchSchema:
    return MatchSchema(
        id=match.id,
        external_id=match.external_id,
        athlete1=serialize_athlete(match.athlete1) if match.athlete1 else None,
        athlete2=serialize_athlete(match.athlete2) if match.athlete2 else None,
        winner_id=match.winner_id,
        score_athlete1=match.score_athlete1,
        score_athlete2=match.score_athlete2,
        status=match.status,
        started_at=match.started_at,
        ended_at=match.ended_at,
    )


def serialize_match_with_bracket(match: Match) -> MatchWithBracketSchema:
    bracket_display_name = ""
    if match.bracket_matches:
        bracket_display_name = match.bracket_matches[0].bracket.display_name or ""

    return MatchWithBracketSchema(
        id=match.id,
        bracket_display_name=bracket_display_name,
        external_id=match.external_id,
        athlete1=serialize_athlete(match.athlete1) if match.athlete1 else None,
        athlete2=serialize_athlete(match.athlete2) if match.athlete2 else None,
        winner_id=match.winner_id,
        score_athlete1=match.score_athlete1,
        score_athlete2=match.score_athlete2,
        status=match.status,
        started_at=match.started_at,
        ended_at=match.ended_at,
    )


def serialize_bracket_match(bracketMatch: BracketMatch) -> BracketMatchSchema:
    return BracketMatchSchema(
        id=bracketMatch.id,
        external_id=bracketMatch.external_id,
        round_number=bracketMatch.round_number,
        position=bracketMatch.position,
        match=serialize_match(bracketMatch.match),
        next_slot=bracketMatch.next_slot,
    )
