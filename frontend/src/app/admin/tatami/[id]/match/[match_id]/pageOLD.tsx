"use client";

import { useEffect, useRef, useState } from "react";
import { TatamiState, useTatamiStore } from "@/store/tatami";
import { sendTatamiMessage, onTatamiMessage } from "@/lib/tatami-bus";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ManageTatami() {
  const {
    status,
    startTimestamp,
    pausedElapsed,
    elapsed,
    durationMs,
    score1,
    score2,
    shido1,
    shido2,
    currentMatch,
    athlete1,
    athlete2,
    setState,
    reset,
    setMatch,
  } = useTatamiStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [matchStatus, setMatchStatus] = useState<"not_started" | "started" | "finished">("not_started");
  const [durationInput, setDurationInput] = useState({ minutes: 1, seconds: 0 });
  const [timeAdjustInput, setTimeAdjustInput] = useState({ minutes: 0, seconds: 0, milliseconds: 0 });
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const [showTimeAdjustDialog, setShowTimeAdjustDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  // Load match configuration from localStorage
  useEffect(() => {
    const matchConfig = localStorage.getItem("match_config");
    if (matchConfig) {
      try {
        const config = JSON.parse(matchConfig);

        // Set duration from config
        const durationMs = config.durationMs || 60000;
        setState({ durationMs });

        // Load match data if we have a matchId
        if (config.matchId) {
          loadMatchData(config.matchId);
        }
      } catch (error) {
        console.error("Error loading match config:", error);
      }
    }
  }, []);

  const loadMatchData = async (matchId: string) => {
    try {
      // Find the match in the bracket matches
      const bracketId = localStorage.getItem("match_config")
        ? JSON.parse(localStorage.getItem("match_config")!).bracketId
        : null;

      if (bracketId) {
        const response = await fetch(`/api/brackets/${bracketId}/matches`);
        const matches = await response.json();
        const bracketMatch = matches.find((m: any) => m.id === matchId);

        if (bracketMatch) {
          setMatch(bracketMatch.match);
        }
      }
    } catch (error) {
      console.error("Error loading match data:", error);
    }
  };

  const start = () => {
    const now = Date.now();
    setState({ status: "running", startTimestamp: now });
    sendTatamiMessage({ type: "start", timestamp: now, pausedElapsed });
    setMatchStatus("started");
  };

  const startMatch = async () => {
    if (!currentMatch) {
      alert("Please select a match first");
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
      alert("Please select a match first");
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
      } else {
        alert("Failed to finish match");
      }
    } catch (error) {
      console.error("Error finishing match:", error);
      alert("Error finishing match");
    }
  };

  const pause = () => {
    if (startTimestamp) {
      const total = pausedElapsed + (Date.now() - startTimestamp);
      setState({ status: "paused", startTimestamp: null, pausedElapsed: total });
      sendTatamiMessage({ type: "pause", pausedElapsed: total });
    }
  };

  const stop = () => {
    reset();
    sendTatamiMessage({ type: "stop" });
  };

  const adjustScore = async (fighter: 1 | 2, delta: number) => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    const key = `score${fighter}` as keyof TatamiState;
    const current = useTatamiStore.getState()[key] as number;
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

  const setShido = (fighter: 1 | 2, value: number) => {
    const key = `shido${fighter}` as keyof TatamiState;
    const newShido = Math.max(0, Math.min(5, value));
    setState({ [key]: newShido });
    sendTatamiMessage({ type: "shido", fighter, shido: newShido });
  };

  const setDuration = (minutes: number, seconds: number = 0) => {
    const newDuration = (minutes * 60 + seconds) * 1000;
    setState({ durationMs: newDuration });
    sendTatamiMessage({
      type: "sync",
      state: {
        status,
        startTimestamp,
        pausedElapsed,
        elapsed,
        durationMs: newDuration,
        score1,
        score2,
        shido1,
        shido2,
      },
    });
  };

  const saveDuration = () => {
    if (durationInput.minutes < 0 || durationInput.seconds < 0 || durationInput.seconds > 59) {
      alert("Invalid duration values");
      return;
    }
    setDuration(durationInput.minutes, durationInput.seconds);
    setShowDurationDialog(false);
  };

  const saveTimeAdjustment = () => {
    if (
      timeAdjustInput.minutes < 0 ||
      timeAdjustInput.seconds < 0 ||
      timeAdjustInput.seconds > 59 ||
      timeAdjustInput.milliseconds < 0 ||
      timeAdjustInput.milliseconds > 99
    ) {
      alert("Invalid time values");
      return;
    }
    adjustRemainingTime(timeAdjustInput.minutes, timeAdjustInput.seconds, timeAdjustInput.milliseconds);
    setShowTimeAdjustDialog(false);
  };

  const adjustRemainingTime = (minutes: number, seconds: number, milliseconds: number) => {
    const newRemaining = (minutes * 60 + seconds) * 1000 + milliseconds * 10;
    const newElapsed = Math.max(0, durationMs - newRemaining);
    setState({ pausedElapsed: newElapsed, elapsed: newElapsed });
    sendTatamiMessage({
      type: "sync",
      state: {
        status,
        startTimestamp,
        pausedElapsed: newElapsed,
        elapsed: newElapsed,
        durationMs,
        score1,
        score2,
        shido1,
        shido2,
      },
    });
  };

  const formatDurationForInput = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
  };

  const formatRemainingForInput = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return { minutes, seconds, milliseconds };
  };

  // Sync full state to other tabs
  const syncState = () => {
    sendTatamiMessage({
      type: "sync",
      state: {
        status,
        startTimestamp,
        pausedElapsed,
        elapsed,
        durationMs,
        score1,
        score2,
        shido1,
        shido2,
      },
    });
  };

  useEffect(() => {
    onTatamiMessage((msg) => {
      if (msg.type === "start") {
        setState({ status: "running", startTimestamp: msg.timestamp, pausedElapsed: msg.pausedElapsed });
      } else if (msg.type === "pause") {
        setState({ status: "paused", startTimestamp: null, pausedElapsed: msg.pausedElapsed });
      } else if (msg.type === "stop") {
        reset();
      } else if (msg.type === "score") {
        const key = `score${msg.fighter}` as keyof TatamiState;
        setState({ [key]: msg.score });
      } else if (msg.type === "shido") {
        const key = `shido${msg.fighter}` as keyof TatamiState;
        setState({ [key]: msg.shido });
      } else if (msg.type === "sync") {
        setState(msg.state);
      }
    });
  }, []);

  // Sync state on mount to ensure screen has the latest data
  useEffect(() => {
    // Small delay to ensure screen page is ready to receive
    const timeoutId = setTimeout(syncState, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (status === "running" && startTimestamp) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = pausedElapsed + (now - startTimestamp);
        setState({ elapsed });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setState({ elapsed: pausedElapsed });
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, startTimestamp, pausedElapsed]);

  const format = (ms: number) => {
    const clamped = Math.max(0, ms);
    const s = Math.floor(clamped / 1000);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    const remMS = Math.floor((clamped % 1000) / 10);
    return `${String(m).padStart(2, "0")}:${String(remS).padStart(2, "0")}.${String(remMS).padStart(2, "0")}`;
  };

  const remaining = Math.max(0, durationMs - elapsed);
  const currentDuration = formatDurationForInput(durationMs);
  const currentRemaining = formatRemainingForInput(remaining);

  // Initialize duration input when component mounts
  useEffect(() => {
    setDurationInput({ minutes: currentDuration.minutes, seconds: currentDuration.seconds });
  }, [currentDuration.minutes, currentDuration.seconds]);

  // Initialize time adjustment input when paused
  useEffect(() => {
    if (status === "paused") {
      setTimeAdjustInput({
        minutes: currentRemaining.minutes,
        seconds: currentRemaining.seconds,
        milliseconds: currentRemaining.milliseconds,
      });
    }
  }, [status, currentRemaining.minutes, currentRemaining.seconds, currentRemaining.milliseconds]);

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tatami Control</h1>
        <Button variant="outline" onClick={() => (window.location.href = "/admin/setup")}>
          Setup New Match
        </Button>
      </div>

      {/* Match Configuration */}
      <div className="border rounded-lg p-4 bg-blue-50">
        <h3 className="text-lg font-semibold mb-2">Current Match</h3>
        {currentMatch ? (
          <div className="space-y-2">
            <div>
              <strong>Athlete 1:</strong> {athlete1 ? `${athlete1.first_name} ${athlete1.last_name}` : "TBD"}
            </div>
            <div>
              <strong>Athlete 2:</strong> {athlete2 ? `${athlete2.first_name} ${athlete2.last_name}` : "TBD"}
            </div>
            <div>
              <strong>Status:</strong> {currentMatch.status}
            </div>
            <div>
              <strong>Match ID:</strong> {currentMatch.id}
            </div>
          </div>
        ) : (
          <div className="text-gray-600">
            No match selected. Please go to{" "}
            <a href="/admin/setup" className="text-blue-600 underline">
              Match Setup
            </a>{" "}
            to select a match.
          </div>
        )}
      </div>

      {/* Timer Display */}
      <div className="text-center">
        <div className="text-6xl font-mono mb-2">{format(remaining)}</div>
        <div className="text-sm text-gray-600">
          Duration: {currentDuration.minutes}:{String(currentDuration.seconds).padStart(2, "0")}
        </div>
      </div>

      {/* Match Controls */}
      <div className="flex justify-center space-x-2">
        <Button
          onClick={startMatch}
          disabled={status === "running" || matchStatus === "started"}
          className="bg-green-600 hover:bg-green-700"
        >
          Start Match
        </Button>
        <Button onClick={pause} variant="secondary" disabled={status !== "running"}>
          Pause
        </Button>
        <Button onClick={start} disabled={status === "running"}>
          Resume
        </Button>
        <Button onClick={syncState} variant="outline">
          Sync
        </Button>
      </div>

      {/* Match Status */}
      <div className="text-center">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            matchStatus === "not_started"
              ? "bg-gray-100 text-gray-800"
              : matchStatus === "started"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {matchStatus === "not_started"
            ? "Not Started"
            : matchStatus === "started"
            ? "Match Started"
            : "Match Finished"}
        </span>

        {matchStatus === "started" && (
          <div className="mt-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Finish Match
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Finish Match</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to finish this match? This action cannot be undone and will send a completion
                    signal to the backend.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="destructive" onClick={finishMatch}>
                    Finish Match
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Fighter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((id) => {
          const athlete = id === 1 ? athlete1 : athlete2;
          const athleteName = athlete ? `${athlete.first_name} ${athlete.last_name}` : `Fighter ${id}`;

          return (
            <div key={id} className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">{athleteName}</h3>

              {/* Score */}
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Score: <span className="font-bold text-lg">{id === 1 ? score1 : score2}</span>
                </p>
                <div className="flex flex-col gap-2">
                  {/* Plus buttons */}
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3].map((v) => (
                      <Button
                        key={v}
                        variant="outline"
                        className="w-10"
                        size="sm"
                        onClick={() => adjustScore(id as 1 | 2, v)}
                      >
                        +{v}
                      </Button>
                    ))}
                  </div>
                  {/* Minus buttons */}
                  <div className="flex gap-2 justify-center">
                    {[-1, -2, -3].map((v) => (
                      <Button
                        key={v}
                        variant="outline"
                        className="w-10"
                        size="sm"
                        onClick={() => adjustScore(id as 1 | 2, v)}
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shido */}
              <div>
                <div className="flex gap-2 flex-wrap justify-center">
                  {[
                    { value: 0, label: "None" },
                    { value: 1, label: "C1" },
                    { value: 2, label: "C2" },
                    { value: 3, label: "C3" },
                    { value: 4, label: "HC" },
                    { value: 5, label: "H" },
                  ].map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={value === (id === 1 ? shido1 : shido2) ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShido(id as 1 | 2, value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Duration Settings */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Duration Settings</h3>
          <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={status !== "idle"}>
                Change Duration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Match Duration</DialogTitle>
                <DialogDescription>
                  Set the total duration for the match. This can only be changed before the match starts.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 justify-center py-4">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={durationInput.minutes}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setDurationInput({ ...durationInput, minutes: value });
                  }}
                  className="w-20 px-3 py-2 border rounded text-center text-lg"
                  placeholder="M"
                />
                <span className="text-lg font-bold">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={durationInput.seconds}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setDurationInput({ ...durationInput, seconds: value });
                  }}
                  className="w-20 px-3 py-2 border rounded text-center text-lg"
                  placeholder="S"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDurationDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveDuration}>Save Duration</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="text-center">
          <div className="text-2xl font-mono">
            {currentDuration.minutes}:{String(currentDuration.seconds).padStart(2, "0")}
          </div>
          <div className="text-sm text-gray-600">Current Duration</div>
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          Duration can only be changed before starting the match
        </div>
      </div>

      {/* Time Adjustment (only when paused) */}
      {status === "paused" && (
        <div className="border rounded-lg p-4 border-yellow-500 bg-yellow-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-yellow-800">Time Adjustment</h3>
            <Dialog open={showTimeAdjustDialog} onOpenChange={setShowTimeAdjustDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-yellow-800 border-yellow-500">
                  Adjust Time
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust Remaining Time</DialogTitle>
                  <DialogDescription>
                    Set the remaining time for the match. This can only be done when the match is paused.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 justify-center py-4">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={timeAdjustInput.minutes}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setTimeAdjustInput({ ...timeAdjustInput, minutes: value });
                    }}
                    className="w-20 px-3 py-2 border rounded text-center text-lg"
                    placeholder="M"
                  />
                  <span className="text-lg font-bold">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={timeAdjustInput.seconds}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setTimeAdjustInput({ ...timeAdjustInput, seconds: value });
                    }}
                    className="w-20 px-3 py-2 border rounded text-center text-lg"
                    placeholder="S"
                  />
                  <span className="text-lg font-bold">.</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={timeAdjustInput.milliseconds}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setTimeAdjustInput({ ...timeAdjustInput, milliseconds: value });
                    }}
                    className="w-20 px-3 py-2 border rounded text-center text-lg"
                    placeholder="MS"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTimeAdjustDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveTimeAdjustment}>Save Time</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="text-center">
            <div className="text-2xl font-mono text-yellow-800">
              {currentRemaining.minutes}:{String(currentRemaining.seconds).padStart(2, "0")}.
              {String(currentRemaining.milliseconds).padStart(2, "0")}
            </div>
            <div className="text-sm text-yellow-700">Current Remaining Time</div>
          </div>
          <div className="mt-2 text-xs text-yellow-600 text-center">Adjust remaining time when paused</div>
        </div>
      )}
    </div>
  );
}
