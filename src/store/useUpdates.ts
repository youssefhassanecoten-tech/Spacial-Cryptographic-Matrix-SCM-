import { create } from "zustand";
import {
  APP_VERSION,
  fetchUpdateManifest,
  getAppPlatform,
  getUpdateKind,
  type AppPlatform,
  type UpdateKind,
  type UpdateManifest,
} from "../lib/updates";

interface UpdateState {
  currentVersion: string;
  platform: AppPlatform;
  manifest: UpdateManifest | null;
  kind: UpdateKind;
  checking: boolean;
  error: string | null;
  dismissed: boolean;
  lastChecked: number;
  check: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdates = create<UpdateState>((set, get) => ({
  currentVersion: APP_VERSION,
  platform: getAppPlatform(),
  manifest: null,
  kind: "none",
  checking: false,
  error: null,
  dismissed: false,
  lastChecked: 0,

  check: async () => {
    if (get().checking) {
      return;
    }
    set({ checking: true, error: null });
    try {
      const manifest = await fetchUpdateManifest();
      const kind = getUpdateKind(APP_VERSION, manifest.version);
      set({
        manifest,
        kind,
        checking: false,
        lastChecked: Date.now(),
        dismissed: false,
      });
    } catch (error) {
      set({
        checking: false,
        error:
          error instanceof Error ? error.message : "Unable to check for updates.",
        lastChecked: Date.now(),
      });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));
