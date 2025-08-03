"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTatamiStore } from "@/store/tatami";
import { sendTatamiMessage } from "@/lib/tatami-bus";

export default function MatchControlPage({ params }: { params: Promise<{ id: string; match_id: string }> }) {
  const router = useRouter();
  const { id: tatamiId, match_id: matchId } = use(params);

  const {
    status,
    elapsed,
    remaining,
    durationMs,
    score1,
    score2,
    shido1,
    shido2,
    currentMatch,
    athlete1,
    athlete2,
    start,
    pause,
    stop,
    reset,
    setDuration,
    setState,
    setMatch,
  } = useTatamiStore();

  const [matchStatus, setMatchStatus] = useState<"not_started" | "started" | "finished">("not_started");
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const [showTimeAdjustDialog, setShowTimeAdjustDialog] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number>(Math.floor(durationMs / 60000));
  const [durationSeconds, setDurationSeconds] = useState<number>(Math.floor((durationMs % 60000) / 1000));
  const [adjustMinutes, setAdjustMinutes] = useState<number>(0);
  const [adjustSeconds, setAdjustSeconds] = useState<number>(0);
  const [adjustCentiseconds, setAdjustCentiseconds] = useState<number>(0);

  // Load match data on mount
  useEffect(() => {
    loadMatchData();
  }, [matchId]);

  const loadMatchData = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      if (response.ok) {
        const matchData = await response.json();
        setMatch(matchData);
        setMatchStatus(matchData.status);
      }
    } catch (error) {
      console.error("Error loading match data:", error);
    }
  };

  const startMatch = async () => {
    if (!currentMatch) {
      alert("No match data available");
      return;
    }

    try {
      const response = await fetch(`/api/matches/${currentMatch.id}/start`, {
        method: "POST",
      });

      if (response.ok) {
        const updatedMatch = await response.json();
        setMatch(updatedMatch);
        start();
        setMatchStatus("started");
      } else {
        alert("Failed to start match");
      }
    } catch (error) {
      console.error("Error starting match:", error);
      alert("Error starting match");
    }
  };

  const finishMatch = async () => {
    if (!currentMatch) {
      alert("No match data available");
      return;
    }

    try {
      // Determine winner based on scores
      let winnerId = 0;
      if (score1 > score2) {
        winnerId = athlete1?.id || 0;
      } else if (score2 > score1) {
        winnerId = athlete2?.id || 0;
      }

      const response = await fetch(`/api/matches/${currentMatch.id}/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score_athlete1: score1,
          score_athlete2: score2,
          winner_id: winnerId,
        }),
      });

      if (response.ok) {
        const updatedMatch = await response.json();
        setMatch(updatedMatch);
        setMatchStatus("finished");
        stop();
        setShowFinishDialog(false);
      } else {
        alert("Failed to finish match");
      }
    } catch (error) {
      console.error("Error finishing match:", error);
      alert("Error finishing match");
    }
  };

  const adjustScore = async (fighter: 1 | 2, delta: number) => {
    if (!currentMatch) {
      alert("No match data available");
      return;
    }

    const current = fighter === 1 ? score1 : score2;
    const newScore = Math.max(0, current + delta);

    try {
      const response = await fetch(`/api/matches/${currentMatch.id}/scores`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score_athlete1: fighter === 1 ? newScore : score1,
          score_athlete2: fighter === 2 ? newScore : score2,
        }),
      });

      if (response.ok) {
        const updatedMatch = await response.json();
        setMatch(updatedMatch);
        sendTatamiMessage({ type: "score", fighter, score: newScore });
      } else {
        alert("Failed to update score");
      }
    } catch (error) {
      console.error("Error updating score:", error);
      alert("Error updating score");
    }
  };

  const adjustShido = (fighter: 1 | 2, shido: number) => {
    if (fighter === 1) {
      useTatamiStore.getState().shido1 = shido;
    } else {
      useTatamiStore.getState().shido2 = shido;
    }
    sendTatamiMessage({ type: "shido", fighter, shido });
  };

  const handleSaveDuration = () => {
    const newDurationMs = (durationMinutes * 60 + durationSeconds) * 1000;
    setDuration(newDurationMs);
    setShowDurationDialog(false);
  };

  const handleSaveTimeAdjust = () => {
    const adjustMs = (adjustMinutes * 60 + adjustSeconds) * 1000 + adjustCentiseconds * 10;
    const newRemaining = Math.max(0, remaining + adjustMs);
    setState({ remaining: newRemaining });
    setShowTimeAdjustDialog(false);
  };

  const format = (ms: number) => {
    const clamped = Math.max(0, ms);
    const minutes = Math.floor(clamped / 60000);
    const seconds = Math.floor((clamped % 60000) / 1000);
    const centiseconds = Math.floor((clamped % 1000) / 10);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (status === "paused") return "text-yellow-600";
    if (remaining <= 10000) return "text-red-600";
    return "text-gray-900";
  };

  const getProgressColor = () => {
    if (status === "paused") return "bg-yellow-500";
    if (remaining <= 10000) return "bg-red-500";
    return "bg-blue-500";
  };

  const remainingProgress = (remaining / durationMs) * 100;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tatami {tatamiId} - Match Control</h1>
            {currentMatch && (
              <p className="text-gray-600">
                {athlete1?.first_name} {athlete1?.last_name} vs {athlete2?.first_name} {athlete2?.last_name}
              </p>
            )}
          </div>
          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => router.push(`/admin/tatami/${tatamiId}/setup`)}>
              Setup New Match
            </Button>
            <Button variant="outline" onClick={() => router.push("/admin/setup")}>
              Change Tournament
            </Button>
          </div>
        </div>

        {/* Timer Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center">
            <div className={`text-8xl font-mono font-bold ${getTimerColor()} mb-4`}>{format(remaining)}</div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-6">
              <div
                className={`h-4 rounded-full ${getProgressColor()}`}
                style={{ width: `${remainingProgress}%` }}
              ></div>
            </div>

            {/* Timer Controls */}
            <div className="flex justify-center space-x-4 mb-6">
              {status === "idle" && (
                <Button onClick={startMatch} size="lg" className="px-8">
                  Start Match
                </Button>
              )}
              {status === "running" && (
                <Button onClick={pause} size="lg" className="px-8">
                  Pause
                </Button>
              )}
              {status === "paused" && (
                <Button onClick={start} size="lg" className="px-8">
                  Resume
                </Button>
              )}
              <Button onClick={stop} variant="outline" size="lg" className="px-8">
                Stop
              </Button>
              <Button onClick={reset} variant="outline" size="lg" className="px-8">
                Reset
              </Button>
            </div>

            {/* Duration and Time Adjustment */}
            <div className="flex justify-center space-x-4">
              {status === "idle" && (
                <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Set Duration</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Set Match Duration</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Minutes</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                            className="w-20 px-3 py-2 border rounded text-center"
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
                            className="w-20 px-3 py-2 border rounded text-center"
                          />
                        </div>
                      </div>
                      <Button onClick={handleSaveDuration} className="w-full">
                        Save Duration
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {status === "paused" && (
                <Dialog open={showTimeAdjustDialog} onOpenChange={setShowTimeAdjustDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-yellow-100 border-yellow-300 text-yellow-800">
                      Adjust Time
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adjust Remaining Time</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <label className="block text-sm font-medium mb-2">Minutes</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={adjustMinutes}
                            onChange={(e) => setAdjustMinutes(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                        </div>
                        <div className="text-xl font-bold text-gray-400">:</div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Seconds</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={adjustSeconds}
                            onChange={(e) => setAdjustSeconds(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                        </div>
                        <div className="text-xl font-bold text-gray-400">.</div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Centiseconds</label>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={adjustCentiseconds}
                            onChange={(e) => setAdjustCentiseconds(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                        </div>
                      </div>
                      <Button onClick={handleSaveTimeAdjust} className="w-full">
                        Save Time
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* Score and Shido Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Fighter 1 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-center mb-6">
              {athlete1?.first_name} {athlete1?.last_name}
            </h2>

            {/* Score */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-blue-600 mb-4">{score1}</div>
              <div className="flex justify-center space-x-2">
                <Button onClick={() => adjustScore(1, 1)} size="sm" className="w-12 h-12">
                  +1
                </Button>
                <Button onClick={() => adjustScore(1, 2)} size="sm" className="w-12 h-12">
                  +2
                </Button>
                <Button onClick={() => adjustScore(1, 3)} size="sm" className="w-12 h-12">
                  +3
                </Button>
              </div>
              <div className="flex justify-center space-x-2 mt-2">
                <Button onClick={() => adjustScore(1, -1)} variant="outline" size="sm" className="w-12 h-12">
                  -1
                </Button>
                <Button onClick={() => adjustScore(1, -2)} variant="outline" size="sm" className="w-12 h-12">
                  -2
                </Button>
                <Button onClick={() => adjustScore(1, -3)} variant="outline" size="sm" className="w-12 h-12">
                  -3
                </Button>
              </div>
            </div>

            {/* Shido */}
            <div className="text-center">
              <div className="text-lg font-semibold mb-3">Shido: {shido1}</div>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => adjustShido(1, 0)} variant={shido1 === 0 ? "default" : "outline"} size="sm">
                  None
                </Button>
                <Button onClick={() => adjustShido(1, 1)} variant={shido1 === 1 ? "default" : "outline"} size="sm">
                  C1
                </Button>
                <Button onClick={() => adjustShido(1, 2)} variant={shido1 === 2 ? "default" : "outline"} size="sm">
                  C2
                </Button>
                <Button onClick={() => adjustShido(1, 3)} variant={shido1 === 3 ? "default" : "outline"} size="sm">
                  C3
                </Button>
                <Button onClick={() => adjustShido(1, 4)} variant={shido1 === 4 ? "default" : "outline"} size="sm">
                  HC
                </Button>
                <Button onClick={() => adjustShido(1, 5)} variant={shido1 === 5 ? "default" : "outline"} size="sm">
                  H
                </Button>
              </div>
            </div>
          </div>

          {/* Fighter 2 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-center mb-6">
              {athlete2?.first_name} {athlete2?.last_name}
            </h2>

            {/* Score */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-blue-600 mb-4">{score2}</div>
              <div className="flex justify-center space-x-2">
                <Button onClick={() => adjustScore(2, 1)} size="sm" className="w-12 h-12">
                  +1
                </Button>
                <Button onClick={() => adjustScore(2, 2)} size="sm" className="w-12 h-12">
                  +2
                </Button>
                <Button onClick={() => adjustScore(2, 3)} size="sm" className="w-12 h-12">
                  +3
                </Button>
              </div>
              <div className="flex justify-center space-x-2 mt-2">
                <Button onClick={() => adjustScore(2, -1)} variant="outline" size="sm" className="w-12 h-12">
                  -1
                </Button>
                <Button onClick={() => adjustScore(2, -2)} variant="outline" size="sm" className="w-12 h-12">
                  -2
                </Button>
                <Button onClick={() => adjustScore(2, -3)} variant="outline" size="sm" className="w-12 h-12">
                  -3
                </Button>
              </div>
            </div>

            {/* Shido */}
            <div className="text-center">
              <div className="text-lg font-semibold mb-3">Shido: {shido2}</div>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => adjustShido(2, 0)} variant={shido2 === 0 ? "default" : "outline"} size="sm">
                  None
                </Button>
                <Button onClick={() => adjustShido(2, 1)} variant={shido2 === 1 ? "default" : "outline"} size="sm">
                  C1
                </Button>
                <Button onClick={() => adjustShido(2, 2)} variant={shido2 === 2 ? "default" : "outline"} size="sm">
                  C2
                </Button>
                <Button onClick={() => adjustShido(2, 3)} variant={shido2 === 3 ? "default" : "outline"} size="sm">
                  C3
                </Button>
                <Button onClick={() => adjustShido(2, 4)} variant={shido2 === 4 ? "default" : "outline"} size="sm">
                  HC
                </Button>
                <Button onClick={() => adjustShido(2, 5)} variant={shido2 === 5 ? "default" : "outline"} size="sm">
                  H
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Match Status and Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Match Status: {matchStatus}</h3>
              {currentMatch && <p className="text-sm text-gray-600">Match ID: {currentMatch.id}</p>}
            </div>

            {matchStatus === "started" && (
              <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="lg">
                    Finish Match
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Finish Match</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p>Are you sure you want to finish this match?</p>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowFinishDialog(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={finishMatch}>
                        Finish Match
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
