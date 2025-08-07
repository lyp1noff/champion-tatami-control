"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTatamiStore } from "@/store/tatami";

import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { TimerDisplay } from "./components/TimerDisplay";
import { MatchControls } from "./components/MatchControls";
import { FighterControls } from "./components/FighterControls";
import { TimeAdjustment } from "./components/TimeAdjustment";
import { FinishMatchDialog } from "./components/FinishMatchDialog";
import { StartMatchDialog } from "./components/StartMatchDialog";
import { getMatch, startMatch as startMatchApi, finishMatch as finishMatchApi, updateScores } from "@/lib/api";

export default function ManageTatami() {
  const { id: tatamiId, match_id } = useParams();
  const {
    status,
    startTimestamp,
    pausedElapsed,
    durationMs,
    score1,
    score2,
    shido1,
    shido2,
    currentMatch,
    setState,
    reset,
    setMatch,
  } = useTatamiStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [timeAdjustInput, setTimeAdjustInput] = useState({ minutes: 0, seconds: 0, milliseconds: 0 });
  const [showTimeAdjustDialog, setShowTimeAdjustDialog] = useState(false);
  const [localElapsed, setLocalElapsed] = useState(0); // Local timer state

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const loadMatchData = useCallback(
    async (matchId: string) => {
      try {
        const match = await getMatch(matchId);
        setMatch(match);
      } catch (error) {
        console.error("Error loading match data:", error);
      }
    },
    [setMatch],
  );

  useEffect(() => {
    if (isHydrated) {
      loadMatchData(match_id as string);
    }
  }, [match_id, isHydrated, loadMatchData]);

  const startMatch = async () => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    try {
      await startMatchApi(match_id as string);
      setState({ currentMatch: { ...currentMatch, status: "started" } });
    } catch (error) {
      console.error("Error starting match:", error);
      alert("Error starting match");
    }
  };

  const finishMatch = async (winnerId: number) => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    try {
      await finishMatchApi(match_id as string, score1, score2, winnerId);
      reset();
    } catch (error) {
      console.error("Error finishing match:", error);
      alert("Error finishing match");
    }
  };

  const pause = useCallback(() => {
    if (startTimestamp) {
      const total = pausedElapsed + (Date.now() - startTimestamp);
      setState({ status: "paused", startTimestamp: null, pausedElapsed: total });
    }
  }, [startTimestamp, pausedElapsed, setState]);

  const resume = () => {
    const now = Date.now();
    setState({ status: "running", startTimestamp: now });
  };

  const adjustScore = async (fighter: 1 | 2, delta: number) => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    const current = fighter === 1 ? score1 : score2;
    const newScore = Math.max(0, current + delta);

    try {
      await updateScores(match_id as string, fighter === 1 ? newScore : score1, fighter === 2 ? newScore : score2);
      // Update only the score in the store
      setState({ [`score${fighter}`]: newScore });
    } catch (error) {
      console.error("Error updating score:", error);
      alert("Error updating score");
    }
  };

  const setShido = (fighter: 1 | 2, value: number) => {
    const newShido = Math.max(0, Math.min(5, value));
    setState({ [`shido${fighter}`]: newShido });
  };

  const formatRemainingForInput = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return { minutes, seconds, milliseconds };
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
    setState({ pausedElapsed: newElapsed });
  };

  const remaining = Math.max(0, durationMs - localElapsed);
  const currentRemaining = formatRemainingForInput(remaining);

  useEffect(() => {
    if (status === "running" && startTimestamp) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = pausedElapsed + (now - startTimestamp);
        setLocalElapsed(elapsed);

        if (elapsed >= durationMs) {
          pause();
        }
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLocalElapsed(pausedElapsed);
    }

    if (status === "paused") {
      setTimeAdjustInput({
        minutes: currentRemaining.minutes,
        seconds: currentRemaining.seconds,
        milliseconds: currentRemaining.milliseconds,
      });
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    status,
    startTimestamp,
    pausedElapsed,
    currentRemaining.minutes,
    currentRemaining.seconds,
    currentRemaining.milliseconds,
    durationMs,
    pause,
  ]);

  const handleTimeAdjustInputChange = (field: "minutes" | "seconds" | "milliseconds", value: number) => {
    setTimeAdjustInput((prev) => ({ ...prev, [field]: value }));
  };

  if (!isHydrated) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tatami Control</h1>
        <Button variant="outline" onClick={() => (window.location.href = `/admin/tatami/${tatamiId}`)}>
          Setup New Match
        </Button>
      </div>

      {/* Match Status */}
      <div className="text-center">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            currentMatch?.status === "not_started"
              ? "bg-gray-100 text-gray-800"
              : currentMatch?.status === "in_progress"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {currentMatch?.status === "not_started"
            ? "Not Started"
            : currentMatch?.status === "in_progress" || currentMatch?.status === "started"
              ? "Match Started"
              : "Match Finished"}
        </span>
      </div>

      {currentMatch?.status === "not_started" && (
        <StartMatchDialog currentMatch={currentMatch} status={status} onStartMatch={startMatch} />
      )}
      {(currentMatch?.status === "started" || currentMatch?.status === "in_progress") && (
        <>
          <TimerDisplay remaining={remaining} durationMs={durationMs} />

          <MatchControls status={status} onPause={pause} onResume={resume} />

          <FighterControls
            currentMatch={currentMatch}
            score1={score1}
            score2={score2}
            shido1={shido1}
            shido2={shido2}
            onAdjustScore={adjustScore}
            onSetShido={setShido}
          />

          <TimeAdjustment
            status={status}
            timeAdjustInput={timeAdjustInput}
            showTimeAdjustDialog={showTimeAdjustDialog}
            onTimeAdjustInputChange={handleTimeAdjustInputChange}
            onShowTimeAdjustDialogChange={setShowTimeAdjustDialog}
            onSaveTimeAdjustment={saveTimeAdjustment}
          />

          <FinishMatchDialog currentMatch={currentMatch} score1={score1} score2={score2} onFinishMatch={finishMatch} />
        </>
      )}

      {(!currentMatch || currentMatch?.status === "finished") && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <div className="text-gray-600">
            No match selected. Please go to{" "}
            <a href={`/admin/tatami/${tatamiId}`} className="text-blue-600 underline">
              Match Setup
            </a>{" "}
            to select a match.
          </div>
        </div>
      )}
    </div>
  );
}
