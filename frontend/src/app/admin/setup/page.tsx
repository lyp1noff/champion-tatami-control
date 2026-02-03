"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTournaments,
  getCurrentTournament,
  setCurrentTournament,
  getTatamis,
  syncTournament,
  getOutboxStatus,
} from "@/lib/api";
import { Tournament } from "@/lib/interfaces";

export default function SetupPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [availableTatamis, setAvailableTatamis] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [outboxStatus, setOutboxStatus] = useState<{
    total: number;
    pending: number;
    failed: number;
    succeeded: number;
  } | null>(null);

  // Fetch outbox status every 10 seconds
  useEffect(() => {
    fetchOutboxStatus();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchOutboxStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoading(true);
        const data = await getTournaments();
        setTournaments(data);
      } catch (error) {
        console.error("Error fetching tournaments:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCurrentTournament = async () => {
      try {
        const data = await getCurrentTournament();
        setSelectedTournament(data.current_tournament_id);

        if (data.current_tournament_id) {
          await fetchAvailableTatamis(data.current_tournament_id);
        }
      } catch (error) {
        console.error("Error fetching current tournament:", error);
      }
    };

    fetchTournaments();
    fetchCurrentTournament();
  }, []);

  const fetchOutboxStatus = async () => {
    try {
      const data = await getOutboxStatus();
      setOutboxStatus(data);
    } catch (error) {
      console.error("Error fetching outbox status:", error);
    }
  };

  const handleTournamentSelect = async (tournamentId: number) => {
    try {
      await setCurrentTournament(tournamentId);
      setSelectedTournament(tournamentId);
      if (tournamentId) {
        await fetchAvailableTatamis(tournamentId);
      } else {
        setAvailableTatamis([]);
      }
    } catch (error) {
      console.error("Error saving tournament selection:", error);
    }
  };

  const fetchAvailableTatamis = async (tournamentId: number) => {
    try {
      const data = await getTatamis(tournamentId);
      setAvailableTatamis(data.tatamis);
    } catch (error) {
      console.error("Error fetching available tatamis:", error);
    }
  };

  const runTournamentSync = async (force = false) => {
    if (!selectedTournament) return;

    try {
      setSyncing(true);
      const result = await syncTournament(selectedTournament, force);
      console.log("sync result", result);
      await fetchAvailableTatamis(selectedTournament);
      await fetchOutboxStatus();
      alert(result.message ?? `Tournament sync ${result.status}`);
    } catch (error) {
      console.error("Error syncing tournament:", error);
      alert("Error syncing tournament");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncTournament = async () => {
    await runTournamentSync(false);
  };

  const handleForceSyncTournament = async () => {
    if (!selectedTournament) return;

    const ok = window.confirm("Force sync will overwrite local running/finished brackets from master. Continue?");
    if (!ok) return;

    await runTournamentSync(true);
  };

  const handleTatamiSelect = (tatamiId: number) => {
    window.open(`/admin/tatami/${tatamiId}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Tournament Setup</h1>

          <div className="space-y-6">
            {/* Outbox Status */}
            {outboxStatus && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Outbox Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{outboxStatus.total}</p>
                    <p className="text-sm text-gray-600">Total</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-800">{outboxStatus.succeeded}</p>
                    <p className="text-sm text-green-700">Succeeded</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-800">{outboxStatus.pending}</p>
                    <p className="text-sm text-yellow-700">Pending</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-800">{outboxStatus.failed}</p>
                    <p className="text-sm text-red-700">Failed</p>
                  </div>
                </div>
              </div>
            )}

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
            <div className="flex flex-wrap gap-4">
              {selectedTournament && (
                <>
                  <Button onClick={handleSyncTournament} disabled={syncing} variant="outline" className="px-4">
                    {syncing ? "Syncing..." : "Sync Selected Tournament"}
                  </Button>
                  <Button onClick={handleForceSyncTournament} disabled={syncing} variant="destructive" className="px-4">
                    {syncing ? "Syncing..." : "Force Sync (Bypass Lock)"}
                  </Button>
                </>
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
