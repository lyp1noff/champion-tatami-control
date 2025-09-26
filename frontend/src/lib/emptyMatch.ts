import { ExternalMatch } from "@/lib/interfaces";

export function createEmptyMatch(): ExternalMatch {
  return {
    external_id: "",
    bracket_display_name: "Match",
    athlete1: {
      id: 0,
      first_name: "AKA",
      last_name: "",
      gender: "",
      coaches_last_name: [],
    },
    athlete2: {
      id: 0,
      first_name: "AO",
      last_name: "",
      gender: "",
      coaches_last_name: [],
    },
    score_athlete1: 0,
    score_athlete2: 0,
    status: "not_started",
  };
}
