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
    tatami: Optional[int] = None
    group_id: int = 1
    start_time: Optional[str] = None
    day: Optional[int] = None
    status: Optional[str]
    state: Optional[str] = "draft"
    version: int = 1
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


class UpdateMatchScoresSchema(BaseModel):
    score_athlete1: Optional[int] = None
    score_athlete2: Optional[int] = None


class FinishMatchSchema(BaseModel):
    score_athlete1: int
    score_athlete2: int
    winner_id: int
