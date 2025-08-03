const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "";

export interface Athlete {
  id: number;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date?: string;
  coaches_last_name: string[];
  age?: number;
}

export interface Match {
  id: string;
  round_type?: string;
  athlete1?: Athlete;
  athlete2?: Athlete;
  winner?: Athlete;
  score_athlete1?: number;
  score_athlete2?: number;
  status: "not_started" | "started" | "finished";
  started_at?: string;
  ended_at?: string;
}

export interface BracketMatch {
  id: string;
  round_number: number;
  position: number;
  match: Match;
  next_slot?: number;
}

export interface Bracket {
  id: number;
  category: string;
  type: string;
  start_time?: string;
  tatami?: number;
  group_id?: number;
  display_name?: string;
  status: string;
  tournament_id: number;
  participants: any[];
  matches?: BracketMatch[];
}

export interface Tournament {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  registration_start_date: string;
  registration_end_date: string;
  image_url?: string;
  status: string;
}

export interface TournamentMatchesFull {
  category: string;
  type: string;
  start_time?: string;
  tatami?: number;
  group_id?: number;
  display_name?: string;
  status: string;
  bracket_id: number;
  matches: BracketMatch[];
}

class ApiClient {
  private baseUrl: string;
  private serviceToken: string;

  constructor(baseUrl: string, serviceToken: string) {
    this.baseUrl = baseUrl;
    this.serviceToken = serviceToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Always include service token
    if (this.serviceToken) {
      headers.Authorization = `Bearer ${this.serviceToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Tournaments
  async getTournaments(
    page = 1,
    limit = 10
  ): Promise<{ data: Tournament[]; total: number; page: number; limit: number }> {
    return this.request(`/tournaments?page=${page}&limit=${limit}`);
  }

  async getTournament(id: number): Promise<Tournament> {
    return this.request(`/tournaments/${id}`);
  }

  async getTournamentMatchesFull(tournamentId: number): Promise<TournamentMatchesFull[]> {
    return this.request(`/tournaments/${tournamentId}/matches_full`);
  }

  // Brackets
  async getBrackets(tournamentId: number): Promise<Bracket[]> {
    return this.request(`/tournaments/${tournamentId}/brackets`);
  }

  async getBracket(bracketId: number): Promise<Bracket> {
    return this.request(`/brackets/${bracketId}`);
  }

  async getBracketMatches(bracketId: number): Promise<BracketMatch[]> {
    return this.request(`/brackets/${bracketId}/matches`);
  }

  // Matches
  async getMatch(matchId: string): Promise<Match> {
    return this.request(`/matches/${matchId}`);
  }

  async startMatch(matchId: string): Promise<Match> {
    return this.request(`/matches/${matchId}/start`, {
      method: "POST",
    });
  }

  async finishMatch(
    matchId: string,
    data: { score_athlete1: number; score_athlete2: number; winner_id: number }
  ): Promise<Match> {
    return this.request(`/matches/${matchId}/finish`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMatchScores(matchId: string, data: { score_athlete1?: number; score_athlete2?: number }): Promise<Match> {
    return this.request(`/matches/${matchId}/scores`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async updateMatchStatus(matchId: string, status: "not_started" | "started" | "finished"): Promise<Match> {
    return this.request(`/matches/${matchId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL, SERVICE_TOKEN);
