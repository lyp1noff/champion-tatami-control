"use client";

import { useEffect, useRef } from "react";
import { TatamiState, useTatamiStore } from "@/store/tatami";
import { sendTatamiMessage, onTatamiMessage } from "@/lib/tatami-bus";
import { Button } from "@/components/ui/button";

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
    setState,
    reset,
  } = useTatamiStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    const now = Date.now();
    setState({ status: "running", startTimestamp: now });
    sendTatamiMessage({ type: "start", timestamp: now, pausedElapsed });
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

  const adjustScore = (fighter: 1 | 2, delta: number) => {
    const key = `score${fighter}` as keyof TatamiState;
    const current = useTatamiStore.getState()[key] as number;
    setState({ [key]: Math.max(0, current + delta) });
  };

  const setShido = (fighter: 1 | 2, value: number) => {
    const key = `shido${fighter}` as keyof TatamiState;
    setState({ [key]: Math.max(0, Math.min(5, value)) });
  };

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
    const remMS = clamped % 1000;
    return `${String(m).padStart(2, "0")}:${String(remS).padStart(2, "0")}.${String(remMS).padStart(3, "0")}`;
  };

  const remaining = Math.max(0, durationMs - elapsed);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Tatami Control</h1>
      <div className="text-4xl font-mono">{format(remaining)}</div>
      <div className="space-x-2">
        <Button onClick={start}>Start</Button>
        <Button onClick={pause} variant="secondary">Pause</Button>
        <Button onClick={stop} variant="destructive">Stop</Button>
      </div>
      <div className="grid grid-cols-2 gap-6 mt-6">
        {[1, 2].map((id) => (
          <div key={id}>
            <p className="font-semibold">Fighter {id}</p>
            <p>Score: {id === 1 ? score1 : score2}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              {[-3, -2, -1, 1, 2, 3].map((v) => (
                <Button key={v} variant="outline" onClick={() => adjustScore(id as 1 | 2, v)}>
                  {v > 0 ? `+${v}` : v}
                </Button>
              ))}
            </div>
            <p className="mt-2">Shido: {id === 1 ? shido1 : shido2}</p>
            <div className="flex gap-2 mt-1">
              {[0, 1, 2, 3, 4, 5].map((v) => (
                <Button key={v} variant={v === (id === 1 ? shido1 : shido2) ? "default" : "outline"} onClick={() => setShido(id as 1 | 2, v)}>
                  {v}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}