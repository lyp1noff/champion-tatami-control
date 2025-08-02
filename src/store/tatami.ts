
import { create } from "zustand";

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
  setState: (partial: Partial<TatamiState>) => void;
  reset: () => void;
};

export const useTatamiStore = create<TatamiState>((set) => ({
  status: "idle",
  startTimestamp: null,
  pausedElapsed: 0,
  elapsed: 0,
  durationMs: 60 * 1000,
  score1: 0,
  score2: 0,
  shido1: 0,
  shido2: 0,

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
    }),
}));