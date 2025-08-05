export interface ExternalMatch {
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

export interface Athlete {
  id: number;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date?: string;
  coaches_last_name: string[];
  age?: number;
}

interface Match {
  external_id: string;
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
  external_id: string;
  round_number: number;
  position: number;
  match: Match;
  next_slot?: number;
}

export interface Bracket {
  external_id: number;
  category: string;
  type: string;
  start_time?: string;
  tatami?: number;
  group_id?: number;
  display_name?: string;
  status: string;
  tournament_id: number;
  participants: Athlete[];
  matches?: BracketMatch[];
}

export interface Tournament {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  registration_start_date?: string;
  registration_end_date?: string;
  image_url?: string;
  status?: string;
  description?: string;
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

export interface CurrentTournamentResponse {
  current_tournament_id: number | null;
}

export interface TatamisResponse {
  tatamis: number[];
}

// export interface OutboxStatusResponse {
//   [key: string]: any;
// }
