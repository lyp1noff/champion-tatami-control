import { ExternalMatch } from "@/lib/interfaces";

export function createEmptyMatch(): ExternalMatch {
  return {
    external_id: "",
    bracket_display_name: "Match",
    athlete1: {
      id: 0,
      first_name: "1",
      last_name: "Fighter",
      gender: "",
      coaches_last_name: ["Coach"],
    },
    athlete2: {
      id: 0,
      first_name: "2",
      last_name: "Fighter",
      gender: "",
      coaches_last_name: ["Coach"],
    },
    score_athlete1: 0,
    score_athlete2: 0,
    status: "not_started",
  };
}
