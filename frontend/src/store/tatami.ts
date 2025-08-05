import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ExternalMatch } from "@/lib/interfaces";

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
  currentMatch: ExternalMatch | null;
  setState: (partial: Partial<TatamiState>) => void;
  reset: () => void;
  setMatch: (match: ExternalMatch) => void;
  start: () => void;
  pause: () => void;
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
        }),

      setMatch: (match: ExternalMatch) =>
        set((state) => {
          const isSameMatch = state.currentMatch?.external_id === match.external_id;
          return isSameMatch
            ? {
                ...state,
              }
            : {
                currentMatch: match,
                status: "idle",
                startTimestamp: null,
                pausedElapsed: 0,
                elapsed: 0,
                durationMs: 60 * 1000,
                score1: 0,
                score2: 0,
                shido1: 0,
                shido2: 0,
              };
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
      }),
    }
  )
);
