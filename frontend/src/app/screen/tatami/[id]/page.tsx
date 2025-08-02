"use client";

import { useEffect } from "react";
import { useTatamiStore, TatamiState } from "@/store/tatami";
import { onTatamiMessage } from "@/lib/tatami-bus";

export default function ScreenTatami() {
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

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (status === "running" && startTimestamp) {
      interval = setInterval(() => {
        const now = Date.now();
        setState({ elapsed: pausedElapsed + (now - startTimestamp) });
      }, 16);
    } else {
      setState({ elapsed: pausedElapsed });
    }

    return () => {
      if (interval) {
        clearInterval(interval);
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

  // Calculate elapsed time consistently
  const currentElapsed =
    status === "running" && startTimestamp ? pausedElapsed + (Date.now() - startTimestamp) : pausedElapsed;

  const remaining = Math.max(0, durationMs - currentElapsed);
  const remainingProgress = Math.max(0, Math.min(100, (remaining / durationMs) * 100));

  const renderDots = (count: number) => (
    <div className="flex gap-1 justify-center mt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-colors duration-200 ${
            i < count ? "bg-red-500 border-red-500" : "border-white/50"
          }`}
        />
      ))}
    </div>
  );

  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "text-green-400";
      case "paused":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const getTimerColor = () => {
    if (status === "paused" && remaining > 0) return "text-yellow-400";
    if (remaining <= 10000) return "text-red-500";
    return "text-white";
  };

  const getStatusText = () => {
    switch (status) {
      case "running":
        return "FIGHT";
      case "paused":
        return "PAUSED";
      default:
        return "READY";
    }
  };

  return (
    <div className="w-screen h-screen bg-black text-white p-8 flex flex-col justify-between relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full bg-gradient-to-r from-red-500 to-blue-500"></div>
      </div>

      {/* Timer Display */}
      <div className="flex-1 flex flex-col justify-center items-center relative z-10">
        <div className="text-center">
          <div className={`text-8xl font-mono tracking-wider font-bold mb-4 ${getTimerColor()}`}>
            {format(remaining)}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full ${remaining < 10000 ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${remainingProgress}%` }}
            ></div>
          </div>

          {/* Duration Info */}
          <div className="text-lg text-gray-400">
            {Math.floor(durationMs / (60 * 1000))}:
            {String(Math.floor((durationMs % (60 * 1000)) / 1000)).padStart(2, "0")}.
            {String(Math.floor((durationMs % 1000) / 10)).padStart(2, "0")} match
          </div>
        </div>
      </div>

      {/* Score Display */}
      <div className="flex justify-between items-end text-center relative z-10">
        {/* Fighter 1 */}
        <div className="flex-1">
          <div className="text-6xl font-bold text-red-500 mb-2">{score1}</div>
          <div className="text-xl text-gray-300 mb-1">
            {currentMatch?.athlete1
              ? `${currentMatch.athlete1.first_name} ${currentMatch.athlete1.last_name} (${currentMatch.athlete1.coaches_last_name})`
              : "FIGHTER 1"}
          </div>
          {renderDots(shido1)}
        </div>

        {/* VS */}
        <div className="text-2xl text-gray-500 font-bold mx-8 mb-8">VS</div>

        {/* Fighter 2 */}
        <div className="flex-1">
          <div className="text-6xl font-bold text-blue-500 mb-2">{score2}</div>
          <div className="text-xl text-gray-300 mb-1">
            {currentMatch?.athlete2
              ? `${currentMatch.athlete2.first_name} ${currentMatch.athlete2.last_name} (${currentMatch.athlete2.coaches_last_name})`
              : "FIGHTER 2"}
          </div>
          {renderDots(shido2)}
        </div>
      </div>

      {/* Connection Status */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500">Connected via BroadcastChannel</div>
    </div>
  );
}
