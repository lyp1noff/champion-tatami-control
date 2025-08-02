"use client";

import { useEffect } from "react";
import { useTatamiStore } from "@/store/tatami";
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
    setState,
    reset
  } = useTatamiStore();

  useEffect(() => {
    onTatamiMessage((msg) => {
      if (msg.type === "start") {
        setState({ status: "running", startTimestamp: msg.timestamp, pausedElapsed: msg.pausedElapsed });
      } else if (msg.type === "pause") {
        setState({ status: "paused", startTimestamp: null, pausedElapsed: msg.pausedElapsed });
      } else if (msg.type === "stop") {
        reset();
      }
    });
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (status === "running" && startTimestamp) {
      interval = setInterval(() => {
        const now = Date.now();
        setState({ elapsed: pausedElapsed + (now - startTimestamp) });
      }, 100);
    } else {
      setState({ elapsed: pausedElapsed });
    }

    return () => interval && clearInterval(interval);
  }, [status, startTimestamp, pausedElapsed]);

  const format = (ms: number) => {
    const clamped = Math.max(0, ms);
    const s = Math.floor(clamped / 1000);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    const remMS = clamped % 1000;
    return `${String(m).padStart(2, "0")}:${String(remS).padStart(2, "0")}.${String(remMS).padStart(3, "0")}`;
  };

  const remaining = Math.max(0, durationMs - elapsed);

  const renderDots = (count: number) => (
    <div className="flex gap-1 justify-center mt-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border ${i < count ? "bg-red-500" : "border-white"}`}
        />
      ))}
    </div>
  );

  return (
    <div className="w-screen h-screen bg-black text-white p-8 flex flex-col justify-between">
      <div className="text-center text-7xl font-mono tracking-wide">{format(remaining)}</div>
      <div className="flex justify-between text-center text-5xl font-bold">
        <div className="flex-1">
          <div className="text-red-500">{score1}</div>
          {renderDots(shido1)}
        </div>
        <div className="flex-1">
          <div className="text-blue-500">{score2}</div>
          {renderDots(shido2)}
        </div>
      </div>
    </div>
  );
}
