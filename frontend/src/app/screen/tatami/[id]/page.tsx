"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTatamiStore } from "@/store/tatami";
import Image from "next/image";

export default function ScreenTatami() {
  const { id: tatamiId } = useParams();
  const [isHydrated, setIsHydrated] = useState(false);

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
  } = useTatamiStore();
  const [localElapsed, setLocalElapsed] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const [hasPlayedBeep, setHasPlayedBeep] = useState(false);

  useEffect(() => {
    if (status !== "running") {
      setHasPlayedBeep(false);
      return;
    }

    if (Math.floor((durationMs - localElapsed) / 100) === 150 && !hasPlayedBeep) {
      const beep = new Audio("/beep.mp3");
      beep.play().catch(() => {});
      setHasPlayedBeep(true);
    }
  }, [localElapsed, durationMs, status, hasPlayedBeep]);

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

  useEffect(() => {
    const updateScale = () => {
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Handle timer updates locally on screen
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (status === "running" && startTimestamp) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = pausedElapsed + (now - startTimestamp);
        setLocalElapsed(elapsed);
      }, 16);
    } else {
      setLocalElapsed(pausedElapsed);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, startTimestamp, pausedElapsed]);

  const formatPartsArray = (ms: number): string[] => {
    const clamped = Math.max(0, ms);
    const totalSeconds = Math.floor(clamped / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(1, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    const centiseconds = String(Math.floor((clamped % 1000) / 10)).padStart(2, "0");

    return [...minutes, ":", ...seconds, ".", ...centiseconds];
  };

  // Use local elapsed time for display
  const remaining = Math.max(0, durationMs - localElapsed);

  const renderDots = (count: number) => {
    const labels = ["C1", "C2", "C3", "HC", "H"];

    return (
      <div className="flex gap-3 justify-center mt-16">
        {labels.map((label, i) => {
          const isActive = i < count;

          // const isLast = i === labels.length - 1;
          // const bgClass = isActive
          //   ? isLast
          //     ? "bg-red-500 border-red-500 text-black"
          //     : "bg-[var(--champion-yellow)] border-[var(--champion-yellow)] text-black"
          //   : "border-white/50 text-white/50";

          const bgClass = isActive
            ? "bg-[var(--champion-yellow)] border-[var(--champion-yellow)] text-black"
            : "border-white/50 text-white/50";

          return (
            <div
              key={i}
              className={`w-26 h-24 rounded-xl border-2 flex items-center justify-center font-semibold text-6xl transition-colors duration-200 ${bgClass}`}
            >
              {label}
            </div>
          );
        })}
      </div>
    );
  };

  const getTimerColor = () => {
    if (status === "paused" && remaining > 0) return "text-[var(--champion-yellow)]";
    if (remaining <= 15000) return "text-red-500";
    return "text-white";
  };

  const chars = formatPartsArray(remaining);

  const leftFighter = swap_status
    ? {
        score: score1,
        shido: shido1,
        senshuActive: senshu === 1,
        athlete: currentMatch?.athlete1,
        colorClass: "text-red-500",
      }
    : {
        score: score2,
        shido: shido2,
        senshuActive: senshu === 2,
        athlete: currentMatch?.athlete2,
        colorClass: "text-blue-500",
      };

  const rightFighter = swap_status
    ? {
        score: score2,
        shido: shido2,
        senshuActive: senshu === 2,
        athlete: currentMatch?.athlete2,
        colorClass: "text-blue-500",
      }
    : {
        score: score1,
        shido: shido1,
        senshuActive: senshu === 1,
        athlete: currentMatch?.athlete1,
        colorClass: "text-red-500",
      };

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col relative overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          width: "1920px",
          height: "1080px",
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-15">
          <div
            className={`w-full h-full bg-gradient-to-r ${
              swap_status ? "from-red-500 to-blue-500" : "from-blue-500 to-red-500"
            }`}
          ></div>
        </div>

        {/* Center Logo */}
        <div className="absolute flex bottom-1/20 left-1/2 transform -translate-x-1/2 z-10 opacity-10 drop-shadow-[0_0_10px_rgba(0,0,0,1)]">
          <div className="px-8 flex flex-col items-center">
            <span className="text-xl font-semibold text-[var(--champion-yellow)] text-center pb-2">
              ЦФСН {'"'}ІППОН{'"'}
              <br />
              ВІДДІЛЕННЯ КАРАТЕ
            </span>
            <Image
              src="/champ_logo.svg"
              alt="Champion Logo"
              width={0}
              height={0}
              priority
              style={{ width: "160px", height: "auto" }}
            />
          </div>
          <Image
            src="/champ_ippon.png"
            alt="Champion Ippon Logo"
            width={240}
            height={240}
            priority
            className="object-contain"
            // style={{ width: "160px", height: "auto" }}
          />
        </div>

        {/* Bracket Name - Top Left */}
        <div className="absolute top-8 left-8 text-5xl font-bold text-gray-300 z-10">
          {currentMatch?.bracket_display_name || ""}
        </div>

        {/* Tatami Number - Top Right */}
        <div className="absolute top-8 right-8 text-5xl font-bold text-gray-300 z-10">TATAMI {tatamiId}</div>

        {isHydrated && currentMatch && currentMatch?.status !== "finished" && (
          <>
            {/* Timer Display - Top Center */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
              <div className={`text-[14rem] font-mono tracking-tight font-bold ${getTimerColor()}`}>
                {chars.map((ch, i) => {
                  const isCenti = i >= chars.length - 2;
                  return (
                    <span
                      key={i}
                      className={ch === ":" || ch === "." ? "mx-[-30px]" : isCenti ? "text-[8rem]" : "px-0"}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>

              {/* Progress Bar */}
              {/* <div className="w-128 h-4 bg-gray-800 rounded-full overflow-hidden mx-auto mb-2">
                <div
                  className={`h-full ${remaining < 15000 ? "bg-red-500" : "bg-gray-300"}`}
                  style={{ width: `${remainingProgress}%` }}
                ></div>
              </div> */}

              {/* Duration Info */}
              {/* <div className="text-lg text-gray-400">
              {Math.floor(durationMs / (60 * 1000))}:
              {String(Math.floor((durationMs % (60 * 1000)) / 1000)).padStart(2, "0")}.
              {String(Math.floor((durationMs % 1000) / 10)).padStart(2, "0")} match
            </div> */}
            </div>

            {/* Left Fighter Score */}
            <div className="absolute top-1/2 left-1/6 transform -translate-x-1/2 -translate-y-1/2 text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
              <div className={`text-[20rem] font-bold leading-none ${leftFighter.colorClass}`}>{leftFighter.score}</div>
              {renderDots(leftFighter.shido)}
            </div>

            {/* Seshu - Left Fighter */}
            <div className="absolute top-1/4 left-30 transform text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors duration-200 ${leftFighter.senshuActive ? "bg-green-500" : ""}`}
              ></div>
            </div>

            {/* Name Display - Left Fighter (25% from left edge, lower) */}
            <div className="absolute top-7/8 left-1/6 transform -translate-x-1/2 -translate-y-1/2 text-center z-10">
              <div className="text-5xl max-w-xl break-words leading-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.7)]">
                {leftFighter?.athlete
                  ? `${leftFighter.athlete.last_name} ${leftFighter.athlete.first_name}${
                      leftFighter.athlete.coaches_last_name && leftFighter.athlete.coaches_last_name.length > 0
                        ? ` (${leftFighter.athlete.coaches_last_name})`
                        : ""
                    }`
                  : "Left Fighter"}
              </div>
            </div>

            {/* Right Fighter Score */}
            <div className="absolute top-1/2 right-1/6 transform translate-x-1/2 -translate-y-1/2 text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
              <div className={`text-[20rem] font-bold leading-none ${rightFighter.colorClass}`}>
                {rightFighter.score}
              </div>
              {renderDots(rightFighter.shido)}
            </div>

            {/* Seshu - Right Fighter */}
            <div className="absolute top-1/4 right-30 transform text-center drop-shadow-[0_0_10px_rgba(0,0,0,0.7)] z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors duration-200 ${rightFighter.senshuActive ? "bg-green-500" : ""}`}
              ></div>
            </div>

            {/* Name Display - Right Fighter (25% from right edge, lower) */}
            <div className="absolute top-7/8 right-1/6 transform translate-x-1/2 -translate-y-1/2 text-center z-10">
              <div className="text-5xl max-w-xl break-words leading-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.7)]">
                {rightFighter?.athlete
                  ? `${rightFighter.athlete.last_name} ${rightFighter.athlete.first_name}${
                      rightFighter.athlete.coaches_last_name && rightFighter.athlete.coaches_last_name.length > 0
                        ? ` (${rightFighter.athlete.coaches_last_name})`
                        : ""
                    }`
                  : "Left Fighter"}
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
    </div>
  );
}
