from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from champion_domain.use_cases import StructureMatch, StructureParticipant
from pydantic import BaseModel


class MatchScoreUpdatedPayloadDTO(BaseModel):
    score_athlete1: int | None = None
    score_athlete2: int | None = None


class MatchFinishedPayloadDTO(BaseModel):
    winner_id: int
    score_athlete1: int
    score_athlete2: int


class StructureParticipantPayloadDTO(BaseModel):
    athlete_id: int | None = None
    seed: int


class StructureMatchPayloadDTO(BaseModel):
    id: str
    round_number: int
    position: int
    next_slot: int | None = None
    round_type: str
    stage: str
    repechage_side: str | None = None
    repechage_step: int | None = None
    status: str
    athlete1_id: int | None = None
    athlete2_id: int | None = None
    winner_id: int | None = None
    score_athlete1: int | None = None
    score_athlete2: int | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None


class BracketStructureRebuiltPayloadDTO(BaseModel):
    status: str | None = None
    state: str | None = None
    participants: list[StructureParticipantPayloadDTO]
    matches: list[StructureMatchPayloadDTO]


class SyncCommandEventDTO(BaseModel):
    event_id: UUID
    seq: int
    event_type: str
    aggregate_type: str
    aggregate_id: str
    aggregate_version: int
    occurred_at: datetime
    payload: dict[str, Any]


class SyncCommandsEnvelopeDTO(BaseModel):
    edge_id: str
    events: list[SyncCommandEventDTO]


def make_match_scores_payload(score_athlete1: int | None, score_athlete2: int | None) -> dict[str, Any]:
    return MatchScoreUpdatedPayloadDTO(score_athlete1=score_athlete1, score_athlete2=score_athlete2).model_dump(
        mode="json"
    )


def make_match_finish_payload(winner_id: int, score_athlete1: int, score_athlete2: int) -> dict[str, Any]:
    return MatchFinishedPayloadDTO(
        winner_id=winner_id,
        score_athlete1=score_athlete1,
        score_athlete2=score_athlete2,
    ).model_dump(mode="json")


def make_structure_rebuilt_payload(
    status: str | None,
    state: str | None,
    participants: list[StructureParticipant],
    matches: list[StructureMatch],
) -> dict[str, Any]:
    payload_participants = [
        StructureParticipantPayloadDTO(
            athlete_id=item.athlete_id,
            seed=item.seed,
        )
        for item in participants
    ]
    payload_matches = [
        StructureMatchPayloadDTO(
            id=str(item.id),
            round_number=item.round_number,
            position=item.position,
            next_slot=item.next_slot,
            round_type=item.round_type or "round",
            stage=item.stage,
            repechage_side=item.repechage_side,
            repechage_step=item.repechage_step,
            status=item.status,
            athlete1_id=item.athlete1_id,
            athlete2_id=item.athlete2_id,
            winner_id=item.winner_id,
            score_athlete1=item.score_athlete1,
            score_athlete2=item.score_athlete2,
            started_at=item.started_at,
            ended_at=item.ended_at,
        )
        for item in matches
    ]
    return BracketStructureRebuiltPayloadDTO(
        status=status,
        state=state,
        participants=payload_participants,
        matches=payload_matches,
    ).model_dump(mode="json")


def make_sync_envelope(
    edge_id: str,
    event_id: UUID,
    seq: int,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    aggregate_version: int,
    occurred_at: datetime,
    payload: dict[str, Any],
) -> dict[str, Any]:
    envelope = SyncCommandsEnvelopeDTO(
        edge_id=edge_id,
        events=[
            SyncCommandEventDTO(
                event_id=event_id,
                seq=seq,
                event_type=event_type,
                aggregate_type=aggregate_type,
                aggregate_id=aggregate_id,
                aggregate_version=aggregate_version,
                occurred_at=occurred_at,
                payload=payload,
            )
        ],
    )
    return envelope.model_dump(mode="json")
