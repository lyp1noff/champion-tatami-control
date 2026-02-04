import unittest

from champion_domain import (
    FinishedMainMatch,
    compute_progression_action,
    decide_bracket_completion,
    plan_repechage_generation,
    should_attempt_repechage_generation_on_finish,
    should_finish_tournament,
    should_generate_repechage,
    should_publish_structure_after_match_finish,
)


class DomainContractsTests(unittest.TestCase):
    def test_progression_contract_main_and_repechage(self) -> None:
        main_action = compute_progression_action(
            stage="main",
            current_round_number=1,
            current_position=2,
            explicit_next_slot=None,
            allow_implicit_main_slot=True,
        )
        self.assertIsNotNone(main_action)
        assert main_action is not None
        self.assertEqual(main_action.kind, "main")
        self.assertEqual(main_action.main_round_number, 2)
        self.assertEqual(main_action.main_position, 1)
        self.assertEqual(main_action.slot, 2)

        rep_action = compute_progression_action(
            stage="repechage",
            current_round_number=4,
            current_position=1,
            explicit_next_slot=None,
            repechage_side="A",
            repechage_step=1,
            main_rounds=3,
        )
        self.assertIsNotNone(rep_action)
        assert rep_action is not None
        self.assertEqual(rep_action.kind, "repechage")
        self.assertEqual(rep_action.repechage_side, "A")
        self.assertEqual(rep_action.repechage_step, 2)
        self.assertEqual(rep_action.repechage_round_number, 5)
        self.assertEqual(rep_action.repechage_position, 1)

    def test_repechage_policy_contract(self) -> None:
        self.assertTrue(
            should_generate_repechage(
                bracket_type="single_elimination",
                main_rounds=3,
                has_repechage_matches=False,
                finalist_a_id=10,
                finalist_b_id=20,
            )
        )
        self.assertFalse(
            should_generate_repechage(
                bracket_type="single_elimination",
                main_rounds=1,
                has_repechage_matches=False,
                finalist_a_id=10,
                finalist_b_id=20,
            )
        )

        generation = plan_repechage_generation(
            finalist_a_id=10,
            finalist_b_id=20,
            finished_main_matches=[
                FinishedMainMatch(round_number=1, winner_id=10, athlete1_id=10, athlete2_id=11),
                FinishedMainMatch(round_number=2, winner_id=10, athlete1_id=10, athlete2_id=12),
                FinishedMainMatch(round_number=1, winner_id=20, athlete1_id=20, athlete2_id=21),
                FinishedMainMatch(round_number=2, winner_id=20, athlete1_id=20, athlete2_id=22),
            ],
            base_round=4,
        )
        self.assertEqual(len(generation.plans), 2)
        self.assertEqual(generation.max_step_by_side, {"A": 1, "B": 1})
        self.assertTrue(should_attempt_repechage_generation_on_finish(origin="local", stage="main"))
        self.assertFalse(should_attempt_repechage_generation_on_finish(origin="sync", stage="main"))
        self.assertTrue(should_publish_structure_after_match_finish(is_repechage_match=False, generated_repechage=True))
        self.assertFalse(should_publish_structure_after_match_finish(is_repechage_match=True, generated_repechage=True))
        completion = decide_bracket_completion(total_matches=3, finished_matches=3, current_bracket_status="started")
        self.assertTrue(completion.should_finish_bracket)
        self.assertTrue(should_finish_tournament(0))


if __name__ == "__main__":
    unittest.main()
