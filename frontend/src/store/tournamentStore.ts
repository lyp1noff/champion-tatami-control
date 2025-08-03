import { create } from "zustand";
import { persist } from "zustand/middleware";

type TournamentStore = {
  selectedTournament: string | null;
  setSelectedTournament: (id: string) => void;
};

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (set) => ({
      selectedTournament: null,
      setSelectedTournament: (id) => set({ selectedTournament: id }),
    }),
    {
      name: "tournament-storage",
      partialize: (state) => ({
        selectedTournament: state.selectedTournament,
      }),
    }
  )
);
