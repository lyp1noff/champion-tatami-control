import { ExternalMatch } from "./interfaces";

const API_BASE_URL = "http://localhost:8080/api";

export const matchApi = {
  getMatch: async (matchId: string): Promise<ExternalMatch> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch match data");
    }
    return response.json();
  },

  startMatch: async (matchId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/start`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to start match");
    }
  },

  finishMatch: async (
    matchId: string,
    scoreAthlete1: number,
    scoreAthlete2: number,
    winnerId: number
  ): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        score_athlete1: scoreAthlete1,
        score_athlete2: scoreAthlete2,
        winner_id: winnerId,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to finish match");
    }
  },

  updateScores: async (matchId: string, scoreAthlete1: number, scoreAthlete2: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        score_athlete1: scoreAthlete1,
        score_athlete2: scoreAthlete2,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to update scores");
    }
  },
};
