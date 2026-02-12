import unittest
from datetime import UTC, datetime
from uuid import uuid4

from champion_domain.use_cases import StructureMatch, StructureParticipant

from src.services.outbox_event_dto import (
    make_match_finish_payload,
    make_match_scores_payload,
    make_structure_rebuilt_payload,
    make_sync_envelope,
)


class OutboxEventDTOTests(unittest.TestCase):
    def test_make_match_payloads(self) -> None:
        scores_payload = make_match_scores_payload(1, 2)
        self.assertEqual(scores_payload["score_athlete1"], 1)
        self.assertEqual(scores_payload["score_athlete2"], 2)

        finish_payload = make_match_finish_payload(winner_id=5, score_athlete1=3, score_athlete2=1)
        self.assertEqual(finish_payload["winner_id"], 5)
        self.assertEqual(finish_payload["score_athlete1"], 3)
        self.assertEqual(finish_payload["score_athlete2"], 1)

    def test_make_structure_rebuilt_payload(self) -> None:
        participants = [
            StructureParticipant(athlete_id=10, seed=1),
            StructureParticipant(athlete_id=11, seed=2),
        ]
        matches = [
            StructureMatch(
                id=uuid4(),
                round_number=1,
                position=1,
                next_slot=None,
                round_type="final",
                stage="main",
                status="not_started",
                athlete1_id=10,
                athlete2_id=11,
                winner_id=None,
                score_athlete1=None,
                score_athlete2=None,
                repechage_side=None,
                repechage_step=None,
                started_at=None,
                ended_at=None,
            )
        ]
        payload = make_structure_rebuilt_payload(
            status="started",
            state="running",
            participants=participants,
            matches=matches,
        )
        self.assertEqual(payload["status"], "started")
        self.assertEqual(payload["state"], "running")
        self.assertEqual(len(payload["participants"]), 2)
        self.assertEqual(len(payload["matches"]), 1)
        self.assertEqual(payload["matches"][0]["round_type"], "final")
        self.assertEqual(payload["matches"][0]["stage"], "main")

    def test_make_sync_envelope(self) -> None:
        event_id = uuid4()
        now = datetime.now(UTC)
        payload = {"score_athlete1": 1, "score_athlete2": 0}
        envelope = make_sync_envelope(
            edge_id="edge-1",
            event_id=event_id,
            seq=7,
            event_type="match.score_updated",
            aggregate_type="match",
            aggregate_id="m-1",
            aggregate_version=4,
            occurred_at=now,
            payload=payload,
        )
        self.assertEqual(envelope["edge_id"], "edge-1")
        self.assertEqual(len(envelope["events"]), 1)
        event = envelope["events"][0]
        self.assertEqual(event["event_id"], str(event_id))
        self.assertEqual(event["seq"], 7)
        self.assertEqual(event["event_type"], "match.score_updated")
        self.assertEqual(event["payload"]["score_athlete2"], 0)


if __name__ == "__main__":
    unittest.main()
