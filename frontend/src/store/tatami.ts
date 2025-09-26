import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ExternalMatch } from "@/lib/interfaces";

export type TatamiState = {
  status: "idle" | "running" | "paused";
  startTimestamp: number | null;
  pausedElapsed: number;
  durationMs: number;
  score1: number;
  score2: number;
  shido1: number;
  shido2: number;
  senshu: number;
  swap_status: boolean;
  currentMatch: ExternalMatch | null;
  setState: (partial: Partial<TatamiState>) => void;
  reset: () => void;
  setMatch: (match: ExternalMatch) => void;
  setDuration: (durationMs: number) => void;
};

export const useTatamiStore = create<TatamiState>()(
  persist(
    (set) => ({
      status: "idle",
      startTimestamp: null,
      pausedElapsed: 0,
      durationMs: 60 * 1000, // 1 minute default
      score1: 0,
      score2: 0,
      shido1: 0,
      shido2: 0,
      senshu: 0,
      swap_status: false,
      currentMatch: null,

      setState: (partial) => set(partial),

      reset: () =>
        set((state) => ({
          status: "idle",
          startTimestamp: null,
          pausedElapsed: 0,
          durationMs: 60 * 1000,
          score1: 0,
          score2: 0,
          shido1: 0,
          shido2: 0,
          senshu: 0,
          swap_status: state.swap_status,
          currentMatch: null,
        })),

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
                durationMs: 60 * 1000,
                score1: 0,
                score2: 0,
                shido1: 0,
                shido2: 0,
                senshu: 0,
                swap_status: state.swap_status,
              };
        }),

      setDuration: (durationMs: number) =>
        set({
          durationMs,
        }),
    }),
    {
      name: "tatami-storage",
      partialize: (state) => ({
        status: state.status,
        startTimestamp: state.startTimestamp,
        pausedElapsed: state.pausedElapsed,
        durationMs: state.durationMs,
        score1: state.score1,
        score2: state.score2,
        shido1: state.shido1,
        shido2: state.shido2,
        senshu: state.senshu,
        swap_status: state.swap_status,
        currentMatch: state.currentMatch,
      }),
    },
  ),
);
