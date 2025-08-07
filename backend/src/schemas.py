from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CustomBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ExternalTournamentSchema(CustomBaseModel):
    id: int
    status: str
    name: str
    location: str
    start_date: date
    end_date: date
    registration_start_date: date
    registration_end_date: date
    image_url: Optional[str] = None


class GetCurrentTournamentRequest(CustomBaseModel):
    current_tournament_id: Optional[int]


class SetCurrentTournamentRequest(BaseModel):
    current_tournament_id: int


class TournamentSchema(CustomBaseModel):
    id: int
    external_id: int
    name: str
    location: str
    start_date: Optional[date]
    end_date: Optional[date]
    status: str
    created_at: datetime
    updated_at: datetime


class BracketSchema(CustomBaseModel):
    id: int
    external_id: int
    tournament_id: int
    category: str
    type: str
    tatami: Optional[int] = 1
    group_id: int = 1
    start_time: str
    status: Optional[str]
    display_name: Optional[str]


class AthleteSchema(CustomBaseModel):
    id: int
    external_id: int
    first_name: str
    last_name: str
    coaches_last_name: str


class MatchSchema(CustomBaseModel):
    id: int
    external_id: str
    athlete1: Optional[AthleteSchema]
    athlete2: Optional[AthleteSchema]
    winner_id: Optional[int]
    score_athlete1: Optional[int]
    score_athlete2: Optional[int]
    status: str
    started_at: Optional[datetime]
    ended_at: Optional[datetime]


class MatchWithBracketSchema(MatchSchema):
    bracket_display_name: str


class BracketMatchSchema(CustomBaseModel):
    id: int
    external_id: str
    round_number: int
    position: int
    match: MatchSchema
    next_slot: Optional[int] = None


class MatchStateSchema(CustomBaseModel):
    id: int
    external_match_id: str
    status: str
    start_timestamp: Optional[datetime]
    paused_elapsed: int
    elapsed: int
    duration_ms: int
    score1: int
    score2: int
    shido1: int
    shido2: int
    created_at: datetime
    updated_at: datetime


class CreateMatchStateSchema(BaseModel):
    external_match_id: str
    status: str = "idle"
    start_timestamp: Optional[datetime] = None
    paused_elapsed: int = 0
    elapsed: int = 0
    duration_ms: int = 60000
    score1: int = 0
    score2: int = 0
    shido1: int = 0
    shido2: int = 0


class UpdateMatchStateSchema(BaseModel):
    status: Optional[str] = None
    start_timestamp: Optional[datetime] = None
    paused_elapsed: Optional[int] = None
    elapsed: Optional[int] = None
    duration_ms: Optional[int] = None
    score1: Optional[int] = None
    score2: Optional[int] = None
    shido1: Optional[int] = None
    shido2: Optional[int] = None


class UpdateMatchScoresSchema(BaseModel):
    score_athlete1: Optional[int] = None
    score_athlete2: Optional[int] = None


class FinishMatchSchema(BaseModel):
    score_athlete1: int
    score_athlete2: int
    winner_id: int
