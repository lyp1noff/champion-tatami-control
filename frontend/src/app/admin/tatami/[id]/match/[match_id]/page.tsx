"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTatamiStore } from "@/store/tatami";

import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { TimerDisplay } from "./components/TimerDisplay";
import { MatchControls } from "./components/MatchControls";
import { FighterControls } from "./components/FighterControls";
import { TimeAdjustment } from "./components/TimeAdjustment";
import { FinishMatchDialog } from "./components/FinishMatchDialog";
//import { StartMatchDialog } from "./components/StartMatchDialog";
import { finishMatch as finishMatchApi, getMatch, startMatch as startMatchApi, updateScores } from "@/lib/api";
import { TimeSetting } from "./components/TimeSetting";
import { createEmptyMatch } from "@/lib/emptyMatch";

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
    senshu,
    swap_status,
    currentMatch,
    setState,
    reset,
    setMatch,
  } = useTatamiStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [timeAdjustInput, setTimeAdjustInput] = useState({ minutes: 0, seconds: 0, milliseconds: 0 });
  const [showTimeAdjustDialog, setShowTimeAdjustDialog] = useState(false);
  const [timeSettingInput, setTimeSettingInput] = useState({ minutes: 1, seconds: 0 });
  const [showTimeSettingDialog, setShowTimeSettingDialog] = useState(false);
  const [localElapsed, setLocalElapsed] = useState(0);

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
    if (!isHydrated) return;

    if (match_id === "empty") {
      setMatch(createEmptyMatch());
    } else {
      loadMatchData(match_id as string);
    }
  }, [match_id, isHydrated, loadMatchData, setMatch]);

  // const startMatch = async () => {
  //   if (!currentMatch) {
  //     alert("Please select a match first");
  //     return;
  //   }
  //
  //   try {
  //     if (match_id !== "empty") {
  //       await startMatchApi(match_id as string);
  //     }
  //     setState({ currentMatch: { ...currentMatch, status: "started" } });
  //   } catch (error) {
  //     console.error("Error starting match:", error);
  //     alert("Error starting match");
  //   }
  // };

  const finishMatch = async (winnerId: number) => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    try {
      if (match_id !== "empty") {
        await finishMatchApi(match_id as string, score1, score2, winnerId);
      }
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

  const beginRun = useCallback(() => {
    const now = Date.now();
    setState({ status: "running", startTimestamp: now });
  }, [setState]);

  const resume = useCallback(() => {
    beginRun();
  }, [beginRun]);

  const start = useCallback(async () => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    if (currentMatch.status === "started") {
      beginRun();
      return;
    }

    try {
      if (match_id !== "empty") {
        await startMatchApi(match_id as string);
      }

      setState({ currentMatch: { ...currentMatch, status: "started" } });
    } catch (error) {
      console.error("Error starting match:", error);
      alert("Error starting match");
      return;
    }

    beginRun();
  }, [currentMatch, match_id, setState, beginRun]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (status === "idle") {
          await start();
        } else if (status === "paused") {
          resume();
        } else {
          pause();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, resume, pause, start]);

  const adjustScore = async (fighter: 1 | 2, delta: number) => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    const current = fighter === 1 ? score1 : score2;
    const newScore = Math.max(0, current + delta);

    try {
      if (match_id !== "empty") {
        await updateScores(match_id as string, fighter === 1 ? newScore : score1, fighter === 2 ? newScore : score2);
      }
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

  const setSenshu = (fighter_or_zero: 0 | 1 | 2) => {
    setState({ senshu: fighter_or_zero });
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

  const saveTimeSetting = () => {
    if (timeSettingInput.minutes < 0 || timeSettingInput.seconds < 0 || timeSettingInput.seconds > 59) {
      alert("Invalid time values");
      return;
    }
    setDurationTime(timeSettingInput.minutes, timeSettingInput.seconds);
    setShowTimeSettingDialog(false);
  };

  const setDurationTime = (minutes: number, seconds: number) => {
    const newDuration = (minutes * 60 + seconds) * 1000;
    setState({ durationMs: newDuration });
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

  const handleTimeSettingInputChange = (field: "minutes" | "seconds", value: number) => {
    setTimeSettingInput((prev) => ({ ...prev, [field]: value }));
  };

  const swap = useCallback(() => {
    setState({ swap_status: !swap_status });
  }, [setState, swap_status]);

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
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={swap}>
            Swap competitors
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = `/admin/tatami/${tatamiId}`)}>
            Setup New Match
          </Button>
        </div>
      </div>

      {/* Match Status */}
      <div className="text-center">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            currentMatch?.status === "not_started"
              ? "bg-gray-100 text-gray-800"
              : currentMatch?.status === "started"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {currentMatch?.status === "not_started"
            ? "Not Started"
            : currentMatch?.status === "started"
              ? "Match Started"
              : "Match Finished"}
        </span>
      </div>
      {currentMatch && currentMatch.status !== "finished" ? (
        <>
          <TimerDisplay remaining={remaining} durationMs={durationMs} />

          <MatchControls status={status} onStart={start} onPause={pause} onResume={resume} />

          <FighterControls
            currentMatch={currentMatch}
            score1={score1}
            score2={score2}
            shido1={shido1}
            shido2={shido2}
            senshu={senshu}
            swap_status={swap_status}
            onAdjustScore={adjustScore}
            onSetShido={setShido}
            onSetSenshu={setSenshu}
          />

          <TimeAdjustment
            status={status}
            timeAdjustInput={timeAdjustInput}
            showTimeAdjustDialog={showTimeAdjustDialog}
            onTimeAdjustInputChange={handleTimeAdjustInputChange}
            onShowTimeAdjustDialogChange={setShowTimeAdjustDialog}
            onSaveTimeAdjustment={saveTimeAdjustment}
          />

          <TimeSetting
            timeSettingInput={timeSettingInput}
            showTimeSettingDialog={showTimeSettingDialog}
            onTimeSettingInputChange={handleTimeSettingInputChange}
            onShowTimeSettingDialogChange={setShowTimeSettingDialog}
            onSaveTimeSetting={saveTimeSetting}
          />

          {currentMatch.status === "started" && (
            <FinishMatchDialog
              currentMatch={currentMatch}
              score1={score1}
              score2={score2}
              swap_status={swap_status}
              onFinishMatch={finishMatch}
            />
          )}
        </>
      ) : (
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
