import { create } from "zustand";
import type {
  AnimationLayer,
  AnimationType,
  DesignState,
  SCMMatrix,
  StudioTab,
} from "../types";
import { VOXEL_COUNT } from "../types";
import {
  createAnimationLayer,
  defaultAnimationLayers,
} from "../lib/animation";
import {
  buildShareLink,
  decryptToken,
  describeTokenError,
  encryptPayload,
  readTokenFromLocation,
} from "../lib/crypto";
import {
  createMatrixFromSeed,
  createNewMatrix,
  matrixFromPayload,
  matrixToPayload,
} from "../lib/scm";

const GENESIS_SEED = 0x5c4d1a7b;
const GENESIS_ID = "scm_genesis_0001";
const GENESIS_LABEL = "Genesis Lattice";
const GENESIS_CREATED_AT = "2026-01-01T00:00:00.000Z";

const initialMatrix = createMatrixFromSeed(GENESIS_SEED, {
  id: GENESIS_ID,
  label: GENESIS_LABEL,
  createdAt: GENESIS_CREATED_AT,
});

export const DEFAULT_DESIGN: DesignState = {
  geometry: "classic",
  material: "neon",
  gradient: "linear",
  colorBase: "#22d3ee",
  colorA: "#22d3ee",
  colorB: "#818cf8",
  colorC: "#fb7185",
  roughness: 0.38,
  metalness: 0.22,
  opacity: 1,
  glow: 0.55,
  showGrid: false,
  showAnchors: false,
  showTrajectory: true,
  contrastGuard: false,
  autoRotate: false,
};

export type ToastTone = "info" | "success" | "error";

export interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface StudioState {
  matrix: SCMMatrix;
  token: string;
  tokenStatus: "syncing" | "ready" | "error";
  tokenError: string | null;
  design: DesignState;
  layers: AnimationLayer[];
  playing: boolean;
  speed: number;
  timeRef: { current: number };
  activeTab: StudioTab;
  toast: ToastState | null;
  setDesign: (patch: Partial<DesignState>) => void;
  setLayer: (id: string, patch: Partial<AnimationLayer>) => void;
  toggleLayer: (id: string) => void;
  moveLayer: (id: string, offset: number) => void;
  reorderLayers: (from: number, to: number) => void;
  addLayer: (type: AnimationType) => void;
  removeLayer: (id: string) => void;
  resetLayers: () => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  restartTimeline: () => void;
  setSpeed: (speed: number) => void;
  setTab: (tab: StudioTab) => void;
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
  syncCurrentToken: () => Promise<void>;
  generateNewToken: (label?: string) => Promise<void>;
  loadToken: (token: string) => Promise<boolean>;
  bootstrap: () => Promise<void>;
  playAssemble: () => void;
}

function withAssembleLayers(layers: AnimationLayer[]): AnimationLayer[] {
  return layers.map((layer) =>
    layer.type === "layerWave"
      ? { ...layer, enabled: true, delay: 0, duration: 2.6, repeat: 1, easing: "easeOutCubic" }
      : layer,
  );
}

export const useStudio = create<StudioState>((set, get) => ({
  matrix: initialMatrix,
  token: "",
  tokenStatus: "syncing",
  tokenError: null,
  design: DEFAULT_DESIGN,
  layers: defaultAnimationLayers(),
  playing: true,
  speed: 1,
  timeRef: { current: 0 },
  activeTab: "design",
  toast: null,

  setDesign: (patch) =>
    set((state) => ({ design: { ...state.design, ...patch } })),

  setLayer: (id, patch) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, ...patch } : layer,
      ),
    })),

  toggleLayer: (id) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, enabled: !layer.enabled } : layer,
      ),
    })),

  moveLayer: (id, offset) =>
    set((state) => {
      const index = state.layers.findIndex((layer) => layer.id === id);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= state.layers.length) {
        return state;
      }
      const layers = state.layers.slice();
      const [layer] = layers.splice(index, 1);
      layers.splice(target, 0, layer);
      return { layers };
    }),

  reorderLayers: (from, to) =>
    set((state) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= state.layers.length ||
        to >= state.layers.length
      ) {
        return state;
      }
      const layers = state.layers.slice();
      const [layer] = layers.splice(from, 1);
      layers.splice(to, 0, layer);
      return { layers };
    }),

  addLayer: (type) =>
    set((state) => ({
      layers: [...state.layers, createAnimationLayer(type)],
    })),

  removeLayer: (id) =>
    set((state) => ({
      layers: state.layers.filter((layer) => layer.id !== id),
    })),

  resetLayers: () => set({ layers: defaultAnimationLayers() }),

  setPlaying: (playing) => set({ playing }),

  togglePlaying: () => set((state) => ({ playing: !state.playing })),

  restartTimeline: () => {
    get().timeRef.current = 0;
    set({ playing: true });
  },

  setSpeed: (speed) => set({ speed: Math.min(3, Math.max(0.1, speed)) }),

  setTab: (tab) => set({ activeTab: tab }),

  notify: (message, tone = "info") => {
    const id = Date.now();
    set({ toast: { id, message, tone } });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (get().toast?.id === id) {
          set({ toast: null });
        }
      }, 3600);
    }
  },

  dismissToast: () => set({ toast: null }),

  syncCurrentToken: async () => {
    const { matrix } = get();
    set({ tokenStatus: "syncing", tokenError: null });
    try {
      const token = await encryptPayload(matrixToPayload(matrix));
      set({ token, tokenStatus: "ready", tokenError: null });
    } catch (error) {
      set({
        tokenStatus: "error",
        tokenError: describeTokenError(error),
      });
    }
  },

  generateNewToken: async (label) => {
    const matrix = createNewMatrix(label?.trim() || "Untitled Lattice");
    set({ matrix, tokenStatus: "syncing", tokenError: null });
    get().timeRef.current = 0;
    try {
      const token = await encryptPayload(matrixToPayload(matrix));
      set({
        token,
        tokenStatus: "ready",
        tokenError: null,
        playing: true,
        layers: withAssembleLayers(get().layers),
      });
      get().notify("New SCM token generated and sealed.", "success");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", buildShareLink(token));
      }
    } catch (error) {
      set({ tokenStatus: "error", tokenError: describeTokenError(error) });
      get().notify("Token encryption failed.", "error");
    }
  },

  loadToken: async (token) => {
    const trimmed = token.trim();
    if (!trimmed) {
      get().notify("Paste an SCM1 token first.", "error");
      return false;
    }
    set({ tokenStatus: "syncing", tokenError: null });
    try {
      const payload = await decryptToken(trimmed);
      const matrix = matrixFromPayload(payload);
      get().timeRef.current = 0;
      set({
        matrix,
        token: trimmed,
        tokenStatus: "ready",
        tokenError: null,
        playing: true,
        layers: withAssembleLayers(get().layers),
      });
      get().notify(`Decrypted ${matrix.label} · ${matrix.activeCount}/${VOXEL_COUNT} active voxels.`, "success");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", buildShareLink(trimmed));
      }
      return true;
    } catch (error) {
      const message = describeTokenError(error);
      set({ tokenStatus: "error", tokenError: message });
      get().notify(message, "error");
      return false;
    }
  },

  bootstrap: async () => {
    const fromUrl = readTokenFromLocation();
    if (fromUrl) {
      await get().loadToken(fromUrl);
      return;
    }
    if (get().token) {
      return;
    }
    await get().syncCurrentToken();
  },

  playAssemble: () => {
    get().timeRef.current = 0;
    set({
      playing: true,
      layers: withAssembleLayers(get().layers),
    });
  },
}));
