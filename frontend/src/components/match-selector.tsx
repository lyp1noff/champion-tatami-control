"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tournament, Bracket, BracketMatch, Match } from "@/lib/api";
import { useTatamiStore } from "@/store/tatami";

export function MatchSelector() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>("");
  const [selectedBracket, setSelectedBracket] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { setMatch } = useTatamiStore();

  // Fetch tournaments on mount
  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tournaments");
      const data = await response.json();
      setTournaments(data.data || []);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrackets = async (tournamentId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tournaments/${tournamentId}/brackets`);
      const data = await response.json();
      setBrackets(data || []);
    } catch (error) {
      console.error("Error fetching brackets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async (bracketId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/brackets/${bracketId}/matches`);
      const data = await response.json();
      setMatches(data || []);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTournamentChange = (tournamentId: string) => {
    setSelectedTournament(tournamentId);
    setSelectedBracket("");
    setSelectedMatch("");
    setBrackets([]);
    setMatches([]);

    if (tournamentId) {
      fetchBrackets(tournamentId);
    }
  };

  const handleBracketChange = (bracketId: string) => {
    setSelectedBracket(bracketId);
    setSelectedMatch("");
    setMatches([]);

    if (bracketId) {
      fetchMatches(bracketId);
    }
  };

  const handleMatchChange = (matchId: string) => {
    setSelectedMatch(matchId);

    if (matchId) {
      const bracketMatch = matches.find((m) => m.id === matchId);
      if (bracketMatch) {
        setMatch(bracketMatch.match);
      }
    }
  };

  const getAthleteName = (athlete: any) => {
    if (!athlete) return "TBD";
    return `${athlete.first_name} ${athlete.last_name}`;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Match Selection</h3>

      <div className="space-y-3">
        {/* Tournament Selection */}
        <div>
          <label className="block text-sm font-medium mb-1">Tournament</label>
          <Select value={selectedTournament} onValueChange={handleTournamentChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select tournament" />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((tournament) => (
                <SelectItem key={tournament.id} value={tournament.id.toString()}>
                  {tournament.name} - {tournament.location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bracket Selection */}
        {selectedTournament && (
          <div>
            <label className="block text-sm font-medium mb-1">Bracket</label>
            <Select value={selectedBracket} onValueChange={handleBracketChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select bracket" />
              </SelectTrigger>
              <SelectContent>
                {brackets.map((bracket) => (
                  <SelectItem key={bracket.id} value={bracket.id.toString()}>
                    {bracket.category} - {bracket.type}
                    {bracket.tatami && ` (Tatami ${bracket.tatami})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Match Selection */}
        {selectedBracket && (
          <div>
            <label className="block text-sm font-medium mb-1">Match</label>
            <Select value={selectedMatch} onValueChange={handleMatchChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select match" />
              </SelectTrigger>
              <SelectContent>
                {matches.map((bracketMatch) => (
                  <SelectItem key={bracketMatch.id} value={bracketMatch.id}>
                    Round {bracketMatch.round_number} - Match {bracketMatch.position}:{" "}
                    {getAthleteName(bracketMatch.match.athlete1)} vs {getAthleteName(bracketMatch.match.athlete2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Selected Match Info */}
      {selectedMatch && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Selected Match:</h4>
          {(() => {
            const bracketMatch = matches.find((m) => m.id === selectedMatch);
            if (!bracketMatch) return null;

            const match = bracketMatch.match;
            return (
              <div className="space-y-1 text-sm">
                <div>
                  <strong>Round:</strong> {bracketMatch.round_number}
                </div>
                <div>
                  <strong>Position:</strong> {bracketMatch.position}
                </div>
                <div>
                  <strong>Status:</strong> {match.status}
                </div>
                <div>
                  <strong>Athlete 1:</strong> {getAthleteName(match.athlete1)}
                </div>
                <div>
                  <strong>Athlete 2:</strong> {getAthleteName(match.athlete2)}
                </div>
                {match.score_athlete1 !== undefined && (
                  <div>
                    <strong>Score:</strong> {match.score_athlete1} - {match.score_athlete2}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {loading && <div className="text-center text-sm text-gray-500">Loading...</div>}
    </div>
  );
}
