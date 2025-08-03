"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Tournament {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [availableTatamis, setAvailableTatamis] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);

  // Load tournaments and current tournament on mount
  useEffect(() => {
    fetchTournaments();
    fetchCurrentTournament();
  }, []);

  // Fetch outbox status every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchOutboxStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8080/api/external/tournaments");
      const data = await response.json();
      setTournaments(data.data || []);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentTournament = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/settings/current-tournament");
      const data = await response.json();
      console.log(data);
      setSelectedTournament(data.current_tournament_id);

      if (data.current_tournament_id) {
        await fetchAvailableTatamis(parseInt(data.current_tournament_id));
      }
    } catch (error) {
      console.error("Error fetching current tournament:", error);
    }
  };

  const fetchOutboxStatus = async () => {
    try {
      console.log("fetching outbox status");
      // const response = await fetch("/api/outbox/status");
      // const data = await response.json();
      // setOutboxStatus(data);
    } catch (error) {
      console.error("Error fetching outbox status:", error);
    }
  };

  const handleTournamentSelect = async (tournamentId: number) => {
    try {
      // Save to global database
      const response = await fetch("http://10.26.1.90:8080/api/settings/current-tournament", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });

      if (response.ok) {
        setSelectedTournament(tournamentId);
        if (tournamentId) {
          await fetchAvailableTatamis(tournamentId);
        } else {
          setAvailableTatamis([]);
        }
      } else {
        console.error("Failed to save tournament selection");
      }
    } catch (error) {
      console.error("Error saving tournament selection:", error);
    }
  };

  const fetchAvailableTatamis = async (tournamentId: number) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/tatamis`);
      const data = await response.json();
      setAvailableTatamis(data.tatamis || []);
    } catch (error) {
      console.error("Error fetching available tatamis:", error);
    }
  };

  const handleSyncTournament = async () => {
    if (!selectedTournament) return;

    try {
      setSyncing(true);
      const response = await fetch(`http://localhost:8080/api/tournaments/${selectedTournament}/sync`, {
        method: "POST",
      });

      if (response.ok) {
        await fetchAvailableTatamis(selectedTournament);
        await fetchOutboxStatus();
        alert("Tournament synced successfully!");
      } else {
        alert("Failed to sync tournament");
      }
    } catch (error) {
      console.error("Error syncing tournament:", error);
      alert("Error syncing tournament");
    } finally {
      setSyncing(false);
    }
  };

  const handleTatamiSelect = (tatamiId: number) => {
    router.push(`/admin/tatami/${tatamiId}/setup`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Tournament Setup</h1>

          <div className="space-y-6">
            {/* Tournament Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Tournament</label>
              <Select
                value={selectedTournament?.toString() || undefined}
                onValueChange={(value) => handleTournamentSelect(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tournament" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((tournament) => (
                    <SelectItem key={tournament.id} value={tournament.id.toString()}>
                      {tournament.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sync Buttons */}
            <div className="flex space-x-4">
              {selectedTournament && (
                <Button onClick={handleSyncTournament} disabled={syncing} variant="outline" className="px-4">
                  {syncing ? "Syncing..." : "Sync Selected Tournament"}
                </Button>
              )}
            </div>

            {/* Selected Tournament Info */}
            {selectedTournament && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-blue-800">Selected: {tournaments.find((t) => t.id === selectedTournament)?.name}</p>
              </div>
            )}

            {/* Available Tatamis */}
            {selectedTournament && availableTatamis.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Available Tatamis</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {availableTatamis.map((tatamiId) => (
                    <Button
                      key={tatamiId}
                      onClick={() => handleTatamiSelect(tatamiId)}
                      className="h-20 text-lg font-semibold"
                    >
                      Tatami {tatamiId}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedTournament && availableTatamis.length === 0 && !loading && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-yellow-800">
                  No tatamis assigned to this tournament. Please sync the tournament first.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
