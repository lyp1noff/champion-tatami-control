const API_BASE_URL = 'http://localhost:8080/api';

export interface Match {
  external_id: string;
  round_type?: string;
  athlete1?: {
    id: number;
    first_name: string;
    last_name: string;
    gender: string;
    birth_date?: string;
    coaches_last_name: string[];
    age?: number;
  };
  athlete2?: {
    id: number;
    first_name: string;
    last_name: string;
    gender: string;
    birth_date?: string;
    coaches_last_name: string[];
    age?: number;
  };
  winner?: {
    id: number;
    first_name: string;
    last_name: string;
    gender: string;
    birth_date?: string;
    coaches_last_name: string[];
    age?: number;
  };
  score_athlete1?: number;
  score_athlete2?: number;
  status: "not_started" | "started" | "finished";
  started_at?: string;
  ended_at?: string;
}

export const matchApi = {
  // Get match data
  getMatch: async (matchId: string): Promise<Match> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch match data');
    }
    return response.json();
  },

  // Start match
  startMatch: async (matchId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/start`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to start match');
    }
  },

  // Finish match
  finishMatch: async (matchId: string, scoreAthlete1: number, scoreAthlete2: number, winnerId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        score_athlete1: scoreAthlete1,
        score_athlete2: scoreAthlete2,
        winner_id: winnerId,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to finish match');
    }
  },

  // Update scores
  updateScores: async (matchId: string, scoreAthlete1: number, scoreAthlete2: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        score_athlete1: scoreAthlete1,
        score_athlete2: scoreAthlete2,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to update scores');
    }
  },
}; 