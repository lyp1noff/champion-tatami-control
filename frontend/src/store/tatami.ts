import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Match, Athlete } from "@/lib/api";

export type TatamiState = {
  status: "idle" | "running" | "paused";
  startTimestamp: number | null;
  pausedElapsed: number;
  elapsed: number;
  durationMs: number;
  score1: number;
  score2: number;
  shido1: number;
  shido2: number;
  currentMatch: Match | null;
  athlete1: Athlete | null;
  athlete2: Athlete | null;
  setState: (partial: Partial<TatamiState>) => void;
  reset: () => void;
  setMatch: (match: Match) => void;
  start: () => void;
  pause: () => void;
  stop: () => void;
  setDuration: (durationMs: number) => void;
  get remaining(): number;
};

export const useTatamiStore = create<TatamiState>()(
  persist(
    (set) => ({
      status: "idle",
      startTimestamp: null,
      pausedElapsed: 0,
      elapsed: 0,
      durationMs: 60 * 1000, // 1 minute default
      score1: 0,
      score2: 0,
      shido1: 0,
      shido2: 0,
      currentMatch: null,
      athlete1: null,
      athlete2: null,

      setState: (partial) => set(partial),

      reset: () =>
        set({
          status: "idle",
          startTimestamp: null,
          pausedElapsed: 0,
          elapsed: 0,
          durationMs: 60 * 1000,
          score1: 0,
          score2: 0,
          shido1: 0,
          shido2: 0,
          currentMatch: null,
          athlete1: null,
          athlete2: null,
        }),

      setMatch: (match: Match) =>
        set({
          currentMatch: match,
          athlete1: match.athlete1 || null,
          athlete2: match.athlete2 || null,
          score1: match.score_athlete1 || 0,
          score2: match.score_athlete2 || 0,
          shido1: 0,
          shido2: 0,
        }),

      start: () =>
        set((state) => ({
          status: "running",
          startTimestamp: Date.now(),
          pausedElapsed: state.elapsed,
        })),

      pause: () =>
        set((state) => ({
          status: "paused",
          elapsed: state.startTimestamp ? Date.now() - state.startTimestamp + state.pausedElapsed : state.elapsed,
          startTimestamp: null,
        })),

      stop: () =>
        set({
          status: "idle",
          startTimestamp: null,
          pausedElapsed: 0,
          elapsed: 0,
        }),

      setDuration: (durationMs: number) =>
        set({
          durationMs,
        }),

      get remaining() {
        return Math.max(0, this.durationMs - this.elapsed);
      },
    }),
    {
      name: "tatami-storage",
      partialize: (state) => ({
        status: state.status,
        startTimestamp: state.startTimestamp,
        pausedElapsed: state.pausedElapsed,
        elapsed: state.elapsed,
        durationMs: state.durationMs,
        score1: state.score1,
        score2: state.score2,
        shido1: state.shido1,
        shido2: state.shido2,
        currentMatch: state.currentMatch,
        athlete1: state.athlete1,
        athlete2: state.athlete2,
      }),
    }
  )
);
