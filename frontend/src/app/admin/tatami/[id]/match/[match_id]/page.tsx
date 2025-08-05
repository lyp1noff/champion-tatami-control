"use client";

import { useEffect, useRef, useState } from "react";
import { TatamiState, useTatamiStore } from "@/store/tatami";
import { sendTatamiMessage, onTatamiMessage } from "@/lib/tatami-bus";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { matchApi } from "@/lib/api";
import { MatchInfo } from "./components/MatchInfo";
import { TimerDisplay } from "./components/TimerDisplay";
import { MatchControls } from "./components/MatchControls";
import { FighterControls } from "./components/FighterControls";
import { TimeAdjustment } from "./components/TimeAdjustment";

export default function ManageTatami() {
  const { id: tatamiId, match_id } = useParams();
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
    setState,
    reset,
  } = useTatamiStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [timeAdjustInput, setTimeAdjustInput] = useState({ minutes: 0, seconds: 0, milliseconds: 0 });
  const [showTimeAdjustDialog, setShowTimeAdjustDialog] = useState(false);

  useEffect(() => {
    loadMatchData(match_id as string);
  }, [match_id]);

  const loadMatchData = async (matchId: string) => {
    try {
      const match = await matchApi.getMatch(matchId);
      setState({
        currentMatch: match,
        // Only set scores if they exist in the match data, otherwise preserve current values
        score1: match.score_athlete1 ?? score1,
        score2: match.score_athlete2 ?? score2,
        // Don't reset shido values - preserve existing ones
        shido1: shido1,
        shido2: shido2,
      });
    } catch (error) {
      console.error("Error loading match data:", error);
    }
  };

  const start = () => {
    const now = Date.now();
    setState({ status: "running", startTimestamp: now });
    sendTatamiMessage({ type: "start", timestamp: now, pausedElapsed });
  };

  const startMatch = async () => {
    if (!currentMatch) {
      alert("Please select a match first");
      return;
    }

    try {
      await matchApi.startMatch(match_id as string);
      start();
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
        winnerId = currentMatch.athlete1?.id || 0;
      } else if (score2 > score1) {
        winnerId = currentMatch.athlete2?.id || 0;
      }

      await matchApi.finishMatch(match_id as string, score1, score2, winnerId);
      stop();
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
      await matchApi.updateScores(
        match_id as string,
        fighter === 1 ? newScore : score1,
        fighter === 2 ? newScore : score2
      );
      // Update only the score in the store
      setState({ [key]: newScore });
      sendTatamiMessage({ type: "score", fighter, score: newScore });
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
        currentMatch,
      },
    });
  };

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
        currentMatch,
      },
    });
  };

  const remaining = Math.max(0, durationMs - elapsed);
  const currentRemaining = formatRemainingForInput(remaining);

  useEffect(() => {
    if (status === "running" && startTimestamp) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = pausedElapsed + (now - startTimestamp);
        setState({ elapsed });

        if (elapsed >= durationMs) {
          pause();
        }
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setState({ elapsed: pausedElapsed });
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
  ]);

  const handleTimeAdjustInputChange = (field: "minutes" | "seconds" | "milliseconds", value: number) => {
    setTimeAdjustInput((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tatami Control</h1>
        <Button variant="outline" onClick={() => (window.location.href = `/admin/tatami/${tatamiId}`)}>
          Setup New Match
        </Button>
      </div>

      <MatchInfo currentMatch={currentMatch} matchId={match_id as string} />

      <TimerDisplay remaining={remaining} durationMs={durationMs} />

      <MatchControls
        status={status}
        currentMatch={currentMatch}
        onStartMatch={startMatch}
        onPause={pause}
        onResume={start}
        onSync={syncState}
        onFinishMatch={finishMatch}
      />

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
        currentRemaining={currentRemaining}
        onTimeAdjustInputChange={handleTimeAdjustInputChange}
        onShowTimeAdjustDialogChange={setShowTimeAdjustDialog}
        onSaveTimeAdjustment={saveTimeAdjustment}
      />
    </div>
  );
}
