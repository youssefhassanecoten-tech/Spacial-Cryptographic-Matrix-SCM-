import { create } from "zustand";

interface TutorialState {
  open: boolean;
  replayAll: boolean;
  show: (replayAll?: boolean) => void;
  hide: () => void;
}

export const useTutorial = create<TutorialState>((set) => ({
  open: false,
  replayAll: false,
  show: (replayAll = false) => set({ open: true, replayAll }),
  hide: () => set({ open: false, replayAll: false }),
}));
