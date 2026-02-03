"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Athlete, Bracket, BracketMatch, Tournament } from "@/lib/interfaces";
import { getBrackets, getCurrentTournament, getMatches, getTournament } from "@/lib/api";

export default function TatamiSetupPage() {
  const router = useRouter();

  const { id: tatamiId } = useParams();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [selectedBracket, setSelectedBracket] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);
  // const [durationMinutes, setDurationMinutes] = useState<number>(1);
  // const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [includeAllMatches, setIncludeAllMatches] = useState<boolean>(false);

  // Load tournament and brackets on mount
  useEffect(() => {
    const fetchCurrentTournament = async () => {
      try {
        const data = await getCurrentTournament();
        setSelectedTournament(data.current_tournament_id);
      } catch (error) {
        console.error("Error fetching current tournament:", error);
      }
    };

    fetchCurrentTournament();
  }, []);

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const data = await getTournament(selectedTournament!.toString());
        setTournament(data);
      } catch (error) {
        console.error("Error fetching tournament:", error);
      }
    };

    const fetchBrackets = async () => {
      try {
        setLoading(true);
        const data = await getBrackets(selectedTournament!.toString());

        // Filter brackets assigned to this tatami
        const assignedBrackets = data
          .filter((bracket: Bracket) => bracket.tatami !== undefined && bracket.tatami !== null)
          .filter((bracket: Bracket) => String(bracket.tatami) === String(tatamiId))
          .sort((a, b) => {
            const dayA = a.day ?? 999;
            const dayB = b.day ?? 999;
            if (dayA !== dayB) return dayA - dayB;

            const timeA = a.start_time ?? "99:99:99";
            const timeB = b.start_time ?? "99:99:99";
            return timeA.localeCompare(timeB);
          });

        setBrackets(assignedBrackets);
      } catch (error) {
        console.error("Error fetching brackets:", error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedTournament) {
      fetchTournament();
      fetchBrackets();
    }
  }, [selectedTournament, tatamiId]);

  const fetchMatches = useCallback(
    async (bracketId: string) => {
      try {
        setLoading(true);
        const data = await getMatches(bracketId);

        const validMatches = data.filter((bracketMatch: BracketMatch) => {
          if (includeAllMatches) {
            return true;
          }
          return (
            bracketMatch.match.athlete1 && bracketMatch.match.athlete2 && bracketMatch.match.status === "not_started"
          );
        });

        setMatches(validMatches);
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }
    },
    [includeAllMatches],
  );

  useEffect(() => {
    if (selectedBracket) {
      fetchMatches(selectedBracket);
    }
  }, [fetchMatches, selectedBracket]);

  useEffect(() => {
    const saved = localStorage.getItem("selectedBracket");
    if (saved) {
      setSelectedBracket(saved);
      fetchMatches(saved);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "selectedBracket") {
        const v = e.newValue ?? "";
        setSelectedBracket(v);
        setSelectedMatch(null);
        setMatches([]);
        if (v) fetchMatches(v);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fetchMatches]);

  const handleBracketChange = (bracketId: string) => {
    setSelectedBracket(bracketId);
    setSelectedMatch(null);
    setMatches([]);

    if (bracketId) {
      localStorage.setItem("selectedBracket", bracketId);
      fetchMatches(bracketId);
    } else {
      localStorage.removeItem("selectedBracket");
    }
  };

  const handleIncludeAllMatchesChange = (checked: boolean) => {
    setIncludeAllMatches(checked as boolean);
  };

  const handleMatchChange = (matchId: string) => {
    const match = matches.find((m) => m.external_id === matchId);
    if (match) {
      setSelectedMatch(match);
    }
  };

  const getAthleteName = (athlete: Athlete) => {
    if (!athlete) return "TBD";
    return ` ${athlete.last_name} ${athlete.first_name} (${athlete.coaches_last_name})`;
  };

  const handleStartMatch = () => {
    if (!selectedMatch) {
      alert("Please select a match first");
      return;
    }

    // TODO: Store match configuration in localStorage
    // const durationMs = (durationMinutes * 60 + durationSeconds) * 1000;
    const matchId = selectedMatch.match.external_id;

    // Navigate to the match control page
    router.push(`/admin/tatami/${tatamiId}/match/${matchId}`);
  };

  const selectedMatchData = matches.find((m) => m.external_id === selectedMatch?.external_id);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tatami {tatamiId} Setup</h1>
          {tournament && <p className="text-gray-600">Tournament: {tournament.name}</p>}
        </div>

        <div className="flex flex-col gap-8">
          {/* Match Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Match Selection</h2>

            <div className="space-y-4">
              {/* Bracket Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Bracket</label>
                <Select value={selectedBracket} onValueChange={handleBracketChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bracket assigned to this tatami" />
                  </SelectTrigger>
                  <SelectContent>
                    {brackets.map((bracket) => (
                      <SelectItem key={String(bracket.external_id)} value={String(bracket.external_id)}>
                        Day {bracket.day ?? "-"} - {bracket.start_time?.slice(0, 5) ?? "--:--"} - {bracket.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {brackets.length === 0 && !loading && (
                  <p className="text-sm text-red-600 mt-1">No brackets assigned to Tatami {tatamiId}</p>
                )}
              </div>

              {/* Match Selection */}
              {selectedBracket && (
                <div>
                  <label className="block text-sm font-medium mb-2">Match</label>
                  <Select value={selectedMatch?.external_id} onValueChange={(value) => handleMatchChange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select match with 2 participants" />
                    </SelectTrigger>
                    <SelectContent>
                      {matches.map((bracketMatch) => (
                        <SelectItem key={String(bracketMatch.external_id)} value={String(bracketMatch.external_id)}>
                          Round {bracketMatch.round_number} - Match {bracketMatch.position}:{" "}
                          {bracketMatch.match.athlete1 ? getAthleteName(bracketMatch.match.athlete1) : "Unknown"} vs{" "}
                          {bracketMatch.match.athlete2 ? getAthleteName(bracketMatch.match.athlete2) : "Unknown"}
                          {bracketMatch.match.status !== "not_started" && ` (${bracketMatch.match.status})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center space-x-2 mt-4">
                    <Checkbox
                      id="include-all-matches"
                      checked={includeAllMatches}
                      onCheckedChange={handleIncludeAllMatchesChange}
                    />
                    <label
                      htmlFor="include-all-matches"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Include all matches (including incomplete or finished)
                    </label>
                  </div>

                  {matches.length === 0 && !loading && (
                    <p className="text-sm text-red-600 mt-1">
                      {includeAllMatches
                        ? "No matches found in this bracket"
                        : "No valid matches found (all matches must have 2 participants)"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Selected Match Info */}
            {selectedMatchData && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Selected Match:</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <strong>Round:</strong> {selectedMatchData.round_number}
                  </div>
                  <div>
                    <strong>Position:</strong> {selectedMatchData.position}
                  </div>
                  <div>
                    <strong>Status:</strong> {selectedMatchData.match.status}
                  </div>
                  <div>
                    <strong>Athlete 1:</strong>{" "}
                    {selectedMatchData.match.athlete1 ? getAthleteName(selectedMatchData.match.athlete1) : "Unknown"}
                  </div>
                  <div>
                    <strong>Athlete 2:</strong>{" "}
                    {selectedMatchData.match.athlete2 ? getAthleteName(selectedMatchData.match.athlete2) : "Unknown"}
                  </div>
                  {selectedMatchData.match.score_athlete1 !== undefined && (
                    <div>
                      <strong>Current Score:</strong> {selectedMatchData.match.score_athlete1} -{" "}
                      {selectedMatchData.match.score_athlete2}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Duration Configuration */}
          {/* <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Match Duration</h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Set the duration for this match. This can be adjusted later before the match starts.
              </p>

              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border rounded text-center text-lg"
                  />
                </div>
                <div className="text-2xl font-bold text-gray-400">:</div>
                <div>
                  <label className="block text-sm font-medium mb-2">Seconds</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border rounded text-center text-lg"
                  />
                </div>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-mono text-blue-800">
                  {durationMinutes}:{String(durationSeconds).padStart(2, "0")}
                </div>
                <div className="text-sm text-blue-600">Total Duration</div>
              </div>
            </div>
          </div> */}
        </div>

        {/* Action Buttons */}
        <Button onClick={handleStartMatch} disabled={!selectedMatch || loading} size="lg" className="px-8 mt-8 w-full">
          {loading ? "Loading..." : "Start Match Control"}
        </Button>

        <Button
          onClick={() => router.push(`/admin/tatami/${tatamiId}/match/empty`)}
          size="lg"
          className="px-8 mt-8 w-full"
        >
          Start Empty Match
        </Button>
      </div>
    </div>
  );
}
