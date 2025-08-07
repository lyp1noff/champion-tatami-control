"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTatamiStore } from "@/store/tatami";
import Image from "next/image";

export default function ScreenTatami() {
  const { id: tatamiId } = useParams();
  const [isHydrated, setIsHydrated] = useState(false);

  const { status, startTimestamp, pausedElapsed, durationMs, score1, score2, shido1, shido2, currentMatch } =
    useTatamiStore();
  const [localElapsed, setLocalElapsed] = useState(0); // Local timer state

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Watch for store changes using Zustand subscription
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "tatami-storage") {
        const newState = JSON.parse(e.newValue ?? "{}");
        useTatamiStore.setState(newState.state);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Handle timer updates locally on screen
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (status === "running" && startTimestamp) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = pausedElapsed + (now - startTimestamp);
        setLocalElapsed(elapsed); // Update local timer state
      }, 16); // 60fps for smooth timer
    } else {
      setLocalElapsed(pausedElapsed); // Reset local timer when paused
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

  // Use local elapsed time for display
  const remaining = Math.max(0, durationMs - localElapsed);
  const remainingProgress = Math.max(0, Math.min(100, (remaining / durationMs) * 100));

  const renderDots = (count: number) => (
    <div className="flex gap-2 justify-center mt-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-20 h-10 rounded-full border-2 transition-colors duration-200 ${
            i < count ? "bg-red-500 border-red-500" : "border-white/50"
          }`}
        />
      ))}
    </div>
  );

  const getTimerColor = () => {
    if (status === "paused" && remaining > 0) return "text-yellow-400";
    if (remaining <= 10000) return "text-red-500";
    return "text-white";
  };

  return (
    <div className="w-screen h-screen bg-black text-white p-8 flex flex-col relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full bg-gradient-to-r from-blue-500 to-red-500"></div>
      </div>

      {/* Center Logo */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 drop-shadow-[0_0_10px_rgba(0,0,0,1)]">
        <Image
          src="/champ_logo.svg"
          alt="Champion Logo"
          width={0}
          height={0}
          priority
          style={{ width: "320px", height: "auto" }}
        />
      </div>

      {/* Bracket Name - Top Left */}
      <div className="absolute top-8 left-8 text-4xl font-bold text-gray-300 z-10">
        {currentMatch?.bracket_display_name || ""}
      </div>

      {/* Tatami Number - Top Right */}
      <div className="absolute top-8 right-8 text-4xl font-bold text-gray-300 z-10">TATAMI {tatamiId}</div>

      {isHydrated && currentMatch && currentMatch?.status !== "finished" && (
        <>
          {/* Timer Display - Top Center */}
          <div className="absolute top-1/10 left-1/2 transform -translate-x-1/2 text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
            <div className={`text-8xl font-mono tracking-wider font-bold mb-2 ${getTimerColor()}`}>
              {format(remaining)}
            </div>

            {/* Progress Bar */}
            <div className="w-128 h-4 bg-gray-800 rounded-full overflow-hidden mx-auto mb-2">
              <div
                className={`h-full ${remaining < 10000 ? "bg-red-500" : "bg-gray-300"}`}
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

          {/* Score Display - Fighter 1 (25% from left edge) */}
          <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
            <div className="text-[12rem] font-bold text-blue-500 leading-none mb-10">{score2}</div>
            {renderDots(shido2)}
          </div>

          {/* Name Display - Fighter 1 (25% from left edge, lower) */}
          <div className="absolute top-7/8 left-1/4 transform -translate-x-1/2 -translate-y-1/2 text-center z-10">
            <div className="text-5xl max-w-xl break-words leading-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.7)]">
              {currentMatch?.athlete2
                ? `${currentMatch.athlete2.first_name} ${currentMatch.athlete2.last_name} (${currentMatch.athlete2.coaches_last_name})`
                : "FIGHTER 1"}
            </div>
          </div>

          {/* Score Display - Fighter 2 (25% from right edge) */}
          <div className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
            <div className="text-[12rem] font-bold text-red-500 leading-none mb-10">{score1}</div>
            {renderDots(shido1)}
          </div>

          {/* Name Display - Fighter 2 (25% from right edge, lower) */}
          <div className="absolute top-7/8 right-1/4 transform translate-x-1/2 -translate-y-1/2 text-center z-10">
            <div className="text-5xl max-w-xl break-words leading-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.7)]">
              {currentMatch?.athlete1
                ? `${currentMatch.athlete1.first_name} ${currentMatch.athlete1.last_name} (${currentMatch.athlete1.coaches_last_name})`
                : "FIGHTER 2"}
            </div>
          </div>
        </>
      )}

      {/* Debug info */}
      {/* {isHydrated && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 z-20 bg-black/50 p-2 rounded">
          <div>Status: {status}</div>
          <div>Match: {currentMatch?.external_id || "none"}</div>
          <div>
            Scores: {score1} - {score2}
          </div>
          <div>
            Shido: {shido1} - {shido2}
          </div>
          <div>Hydrated: {isHydrated.toString()}</div>
        </div>
      )} */}

      {/* Connection Status */}
      {/* <div className="absolute bottom-4 left-4 text-xs text-gray-500">Connected via BroadcastChannel</div> */}
    </div>
  );
}
