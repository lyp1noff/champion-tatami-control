import {
  ExternalMatch,
  Tournament,
  CurrentTournamentResponse,
  TatamisResponse,
  Bracket,
  BracketMatch,
} from "./interfaces";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL as string;

export async function getMatch(matchId: string): Promise<ExternalMatch> {
  const response = await fetch(`${BACKEND_URL}/matches/${matchId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch match data");
  }
  return response.json();
}

export async function startMatch(matchId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/matches/${matchId}/start`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to start match");
  }
}

export async function finishMatch(
  matchId: string,
  scoreAthlete1: number,
  scoreAthlete2: number,
  winnerId: number,
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/matches/${matchId}/finish`, {
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
}

export async function updateScores(matchId: string, scoreAthlete1: number, scoreAthlete2: number): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/matches/${matchId}/scores`, {
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
}

// Setup API functions
export async function getTournaments(): Promise<Tournament[]> {
  const response = await fetch(`${BACKEND_URL}/external/tournaments`);
  if (!response.ok) {
    throw new Error("Failed to fetch tournaments");
  }
  const data = await response.json();
  return data || [];
}

export async function getCurrentTournament(): Promise<CurrentTournamentResponse> {
  const response = await fetch(`${BACKEND_URL}/settings/current-tournament`);
  if (!response.ok) {
    throw new Error("Failed to fetch current tournament");
  }
  return response.json();
}

export async function setCurrentTournament(tournamentId: number): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/settings/current-tournament`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ current_tournament_id: tournamentId }),
  });
  if (!response.ok) {
    throw new Error("Failed to save tournament selection");
  }
}

export async function getTatamis(tournamentId: number): Promise<TatamisResponse> {
  const response = await fetch(`${BACKEND_URL}/tournaments/${tournamentId}/tatamis`);
  if (!response.ok) {
    throw new Error("Failed to fetch available tatamis");
  }
  const data = await response.json();
  return { tatamis: data.tatamis || [] };
}

export async function syncTournament(tournamentId: number): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/tournaments/${tournamentId}/sync`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to sync tournament");
  }
}

// export async function getOutboxStatus(): Promise<any> {
//   const response = await fetch(`${BACKEND_URL}/outbox/status`);
//   if (!response.ok) {
//     throw new Error("Failed to fetch outbox status");
//   }
//   return response.json();
// }

// Tatami API functions
export async function getTournament(tournamentId: string): Promise<Tournament> {
  const response = await fetch(`${BACKEND_URL}/tournaments/${tournamentId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch tournament");
  }
  return response.json();
}

export async function getBrackets(tournamentId: string): Promise<Bracket[]> {
  const response = await fetch(`${BACKEND_URL}/tournaments/${tournamentId}/brackets`);
  if (!response.ok) {
    throw new Error("Failed to fetch brackets");
  }
  return response.json();
}

export async function getMatches(bracketId: string): Promise<BracketMatch[]> {
  const response = await fetch(`${BACKEND_URL}/brackets/${bracketId}/matches`);
  if (!response.ok) {
    throw new Error("Failed to fetch matches");
  }
  return response.json();
}
