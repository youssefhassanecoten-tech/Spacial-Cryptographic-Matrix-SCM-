import { create } from "zustand";
import type {
  AnimationLayer,
  AnimationType,
  DesignState,
  PayloadKind,
  RevealResult,
  SCMShapePayload,
  SCMMatrix,
  SCMPayloadManifest,
  StudioTab,
} from "../types";
import {
  createAnimationLayer,
  defaultAnimationLayers,
} from "../lib/animation";
import {
  createMatrixFromSeed,
  createNewMatrix,
} from "../lib/scm";
import {
  MAX_TOTAL_PAYLOAD_BYTES,
  createEmptyVault,
  createTextDraft,
  decodeShapeToken,
  draftFromFile,
  draftsFromUnlocked,
  encodeShapeToken,
  matrixFromShape,
  readShapeFromLocation,
  sealVault,
  unlockVault,
  type PayloadDraftItem,
  type SealArtifacts,
} from "../lib/vault";

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
  shape: "cube",
  pattern: "none",
  patternScale: 4,
  patternIntensity: 0.45,
  patternColor: "#f8fafc",
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

export const GUEST_DESIGN: DesignState = {
  ...DEFAULT_DESIGN,
  autoRotate: true,
  showTrajectory: false,
  showGrid: false,
  showAnchors: false,
  contrastGuard: false,
};

export interface SealedStats {
  count: number;
  totalSize: number;
  embeddedSize: number;
  packageSize: number;
  kinds: Record<PayloadKind, number>;
}

export interface SealedVersion {
  token: string;
  shapeToken: string;
  packageBlob: Blob | null;
  sealedAt: string;
}

export interface SealResult {
  ok: boolean;
  error?: string;
  token?: string;
  shapeToken?: string;
  packageBlob?: Blob | null;
}

export interface UnlockResult {
  ok: boolean;
  error?: string;
  needsPackage?: boolean;
  reveal?: RevealResult;
}

export type ToastTone = "info" | "success" | "error";

export interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface StudioState {
  matrix: SCMMatrix;
  token: string;
  shapeToken: string;
  tokenStatus: "idle" | "syncing" | "ready" | "error";
  tokenError: string | null;
  guestMode: boolean;
  guestShape: SCMShapePayload | null;
  design: DesignState;
  layers: AnimationLayer[];
  playing: boolean;
  speed: number;
  timeRef: { current: number };
  activeTab: StudioTab;
  toast: ToastState | null;
  drafts: PayloadDraftItem[];
  sealedStats: SealedStats | null;
  packageBlob: Blob | null;
  sealed: boolean;
  editing: boolean;
  previousVersions: SealedVersion[];
  reveal: RevealResult | null;
  revealPulse: number;
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
  addTextDraft: (text: string) => void;
  addFiles: (files: File[]) => Promise<void>;
  removeDraft: (id: string) => void;
  updateTextDraft: (id: string, text: string) => void;
  clearDrafts: () => void;
  sealPayload: (label?: string) => Promise<SealResult>;
  unlockPayload: (token: string, packageFile?: Blob | null) => Promise<UnlockResult>;
  unlockForEdit: (token: string, packageFile?: Blob | null) => Promise<UnlockResult>;
  newSCM: (label?: string) => Promise<void>;
  bootstrap: () => Promise<void>;
  closeReveal: () => void;
  playAssemble: () => void;
}

function withAssembleLayers(layers: AnimationLayer[]): AnimationLayer[] {
  return layers.map((layer) =>
    layer.type === "layerWave"
      ? {
          ...layer,
          enabled: true,
          delay: 0,
          duration: 2.6,
          repeat: 1,
          easing: "easeOutCubic",
        }
      : layer,
  );
}

function sealedVersionFrom(
  token: string,
  shapeToken: string,
  packageBlob: Blob | null,
): SealedVersion | null {
  if (!token || !shapeToken) {
    return null;
  }
  return {
    token,
    shapeToken,
    packageBlob,
    sealedAt: new Date().toISOString(),
  };
}

function statsFromManifest(manifest: SCMPayloadManifest): SealedStats {
  const kinds: Record<PayloadKind, number> = {
    text: 0,
    image: 0,
    video: 0,
    document: 0,
  };
  for (const item of manifest.items) {
    kinds[item.kind] += 1;
  }
  return {
    count: manifest.items.length,
    totalSize: manifest.totalSize,
    embeddedSize: manifest.embeddedSize,
    packageSize: manifest.packageSize,
    kinds,
  };
}

export const useStudio = create<StudioState>((set, get) => ({
  matrix: initialMatrix,
  token: "",
  shapeToken: "",
  tokenStatus: "idle",
  tokenError: null,
  guestMode: false,
  guestShape: null,
  design: DEFAULT_DESIGN,
  layers: defaultAnimationLayers(),
  playing: true,
  speed: 1,
  timeRef: { current: 0 },
  activeTab: "design",
  toast: null,
  drafts: [],
  sealedStats: null,
  packageBlob: null,
  sealed: false,
  editing: false,
  previousVersions: [],
  reveal: null,
  revealPulse: 0,

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
      }, 4200);
    }
  },

  dismissToast: () => set({ toast: null }),

  addTextDraft: (text) => {
    if (get().sealed) {
      get().notify("This SCM is sealed. Unlock Edit Studio to add content.", "error");
      return;
    }
    if (!text) {
      return;
    }
    const existingText = get().drafts.filter((draft) => draft.kind === "text").length;
    const draft = createTextDraft(text, `note-${existingText + 1}.txt`);
    set((state) => ({ drafts: [...state.drafts, draft] }));
  },

  addFiles: async (files) => {
    if (get().sealed) {
      get().notify("This SCM is sealed. Unlock Edit Studio to add content.", "error");
      return;
    }
    if (files.length === 0) {
      return;
    }
    const pending: PayloadDraftItem[] = [];
    let total = get().drafts.reduce((sum, draft) => sum + draft.size, 0);
    for (const file of files) {
      const draft = await draftFromFile(file);
      if (total + draft.size > MAX_TOTAL_PAYLOAD_BYTES) {
        get().notify(
          `Payload would exceed ${Math.round(
            MAX_TOTAL_PAYLOAD_BYTES / (1024 * 1024),
          )} MB. File ${draft.path} was not added.`,
          "error",
        );
        break;
      }
      total += draft.size;
      pending.push(draft);
    }
    if (pending.length > 0) {
      set((state) => ({ drafts: [...state.drafts, ...pending] }));
      get().notify(`${pending.length} item(s) added to the vault draft.`, "success");
    }
  },

  removeDraft: (id) =>
    set((state) => ({
      drafts: state.drafts.filter((draft) => draft.id !== id),
    })),

  updateTextDraft: (id, text) => {
    if (get().sealed) {
      return;
    }
    const bytes = new TextEncoder().encode(text);
    set((state) => ({
      drafts: state.drafts.map((draft) =>
        draft.id === id
          ? { ...draft, bytes, size: bytes.byteLength }
          : draft,
      ),
    }));
  },

  clearDrafts: () => set({ drafts: [] }),

  sealPayload: async (label) => {
    const { drafts, matrix, token, shapeToken, packageBlob } = get();
    if (drafts.length === 0) {
      return { ok: false, error: "Add at least one item before sealing." };
    }
    set({ tokenStatus: "syncing", tokenError: null });
    try {
      const artifacts: SealArtifacts = await sealVault(drafts, label ?? matrix.label);
      const previous = sealedVersionFrom(token, shapeToken, packageBlob);
      get().timeRef.current = 0;
      set({
        matrix: artifacts.matrix,
        token: artifacts.token,
        shapeToken: artifacts.shapeToken,
        tokenStatus: "ready",
        tokenError: null,
        sealedStats: statsFromManifest(artifacts.manifest),
        packageBlob: artifacts.packageBlob,
        sealed: true,
        editing: false,
        drafts: [],
        guestMode: false,
        guestShape: null,
        reveal: null,
        playing: true,
        layers: withAssembleLayers(get().layers),
        previousVersions: previous
          ? [previous, ...get().previousVersions].slice(0, 12)
          : get().previousVersions,
      });
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        window.history.replaceState(null, "", url.toString());
      }
      get().notify(
        `SCM sealed. ${artifacts.manifest.items.length} item(s) encrypted; the matrix reshaped and the token changed.`,
        "success",
      );
      return {
        ok: true,
        token: artifacts.token,
        shapeToken: artifacts.shapeToken,
        packageBlob: artifacts.packageBlob,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to seal this SCM.";
      set({ tokenStatus: "error", tokenError: message });
      get().notify(message, "error");
      return { ok: false, error: message };
    }
  },

  unlockPayload: async (token, packageFile) => {
    const trimmed = token.trim();
    if (!trimmed) {
      return { ok: false, error: "Paste the private SCM ID token first." };
    }
    const { guestShape, shapeToken } = get();
    let expectedShape = guestShape;
    if (!expectedShape && shapeToken) {
      try {
        expectedShape = decodeShapeToken(shapeToken);
      } catch {
        expectedShape = null;
      }
    }
    set({ tokenStatus: "syncing", tokenError: null });
    const result = await unlockVault({
      token: trimmed,
      expectedShape,
      packageInput: packageFile ?? null,
      storedPackage: get().packageBlob,
    });
    if (!result.ok) {
      set({ tokenStatus: "error", tokenError: result.error ?? "Unlock failed." });
      get().notify(result.error ?? "Unlock failed.", "error");
      return { ok: false, error: result.error };
    }
    if (result.needsPackage) {
      set({ tokenStatus: "ready", tokenError: null });
      get().notify(result.error ?? "Load the encrypted package.", "info");
      return { ok: false, needsPackage: true, error: result.error };
    }
    if (!result.shape || !result.manifest || !result.items) {
      set({ tokenStatus: "error", tokenError: "Unlock returned incomplete data." });
      return { ok: false, error: "Unlock returned incomplete data." };
    }
    const matrix = matrixFromShape(result.shape);
    const reveal: RevealResult = {
      manifest: result.manifest,
      items: result.items,
      shape: result.shape,
      packageLoaded: Boolean(result.packageLoaded),
    };
    const nextShapeToken = shapeToken || encodeShapeToken(result.shape);
    set({
      matrix,
      token: trimmed,
      tokenStatus: "ready",
      tokenError: null,
      shapeToken: nextShapeToken,
      guestShape: get().guestMode ? result.shape : get().guestShape,
      sealedStats: statsFromManifest(result.manifest),
      packageBlob: packageFile ?? get().packageBlob,
      sealed: true,
      editing: false,
      reveal,
      revealPulse: get().revealPulse + 1,
      playing: true,
    });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        get().notify(
          `SCM solved. ${result.items?.length ?? 0} item(s) revealed from the matrix.`,
          "success",
        );
      }, 1500);
    }
    return { ok: true, reveal };
  },

  unlockForEdit: async (token, packageFile) => {
    const trimmed = token.trim();
    if (!trimmed) {
      return { ok: false, error: "Paste the private SCM ID token first." };
    }
    const state = get();
    if (state.sealed) {
      const previous = sealedVersionFrom(
        state.token,
        state.shapeToken,
        state.packageBlob,
      );
      if (previous) {
        set({
          previousVersions: [previous, ...state.previousVersions].slice(0, 12),
        });
      }
    }
    const result = await unlockVault({
      token: trimmed,
      packageInput: packageFile ?? null,
      storedPackage: get().packageBlob,
    });
    if (!result.ok) {
      get().notify(result.error ?? "Unable to open Edit Studio.", "error");
      return { ok: false, error: result.error };
    }
    if (result.needsPackage) {
      get().notify(result.error ?? "Load the encrypted package to edit.", "info");
      return { ok: false, needsPackage: true, error: result.error };
    }
    if (!result.manifest) {
      return { ok: false, error: "Token has no payload manifest." };
    }
    const drafts = draftsFromUnlocked(result.manifest, result.files);
    if (drafts.length !== result.manifest.items.length) {
      get().notify("Some encrypted items could not be opened for editing.", "error");
    }
    set({
      matrix: result.shape ? matrixFromShape(result.shape) : get().matrix,
      drafts,
      sealed: false,
      editing: true,
      sealedStats: null,
      packageBlob: null,
      token: "",
      shapeToken: "",
      tokenStatus: "idle",
      tokenError: null,
      reveal: null,
      activeTab: "payload",
      playing: true,
    });
    get().notify(
      "Edit Studio unlocked. The previous token and package remain valid; re-seal to mint a new shape and token.",
      "info",
    );
    return { ok: true };
  },

  newSCM: async (label) => {
    const state = get();
    if (state.sealed) {
      const previous = sealedVersionFrom(
        state.token,
        state.shapeToken,
        state.packageBlob,
      );
      if (previous) {
        set({
          previousVersions: [previous, ...state.previousVersions].slice(0, 12),
        });
      }
    }
    const matrix = createNewMatrix(label?.trim() || "Untitled SCM");
    const empty = await createEmptyVault(matrix);
    get().timeRef.current = 0;
    set({
      matrix,
      token: empty.token,
      shapeToken: empty.shapeToken,
      tokenStatus: "ready",
      tokenError: null,
      sealedStats: null,
      packageBlob: null,
      sealed: false,
      editing: false,
      drafts: [],
      guestMode: false,
      guestShape: null,
      reveal: null,
      playing: true,
      activeTab: "payload",
      layers: withAssembleLayers(get().layers),
    });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      window.history.replaceState(null, "", url.toString());
    }
    get().notify("New SCM created. Add content or unlock a previous version.", "success");
  },

  bootstrap: async () => {
    const shapeParam = readShapeFromLocation();
    if (shapeParam) {
      try {
        const shape = decodeShapeToken(shapeParam);
        const matrix = matrixFromShape(shape);
        get().timeRef.current = 0;
        set({
          matrix,
          shapeToken: shapeParam,
          guestMode: true,
          guestShape: shape,
          token: "",
          tokenStatus: "idle",
          tokenError: null,
          design: GUEST_DESIGN,
          layers: withAssembleLayers(defaultAnimationLayers()),
          playing: true,
          activeTab: "decrypt",
          drafts: [],
          sealedStats: null,
          packageBlob: null,
          sealed: false,
          editing: false,
          reveal: null,
        });
        return;
      } catch {
        get().notify("The SCM shape link is invalid or corrupt.", "error");
      }
    }
    if (get().token) {
      return;
    }
    try {
      const empty = await createEmptyVault(get().matrix);
      set({
        token: empty.token,
        shapeToken: empty.shapeToken,
        tokenStatus: "ready",
        tokenError: null,
        sealedStats: null,
      });
    } catch {
      set({ tokenStatus: "error", tokenError: "Unable to initialize the token engine." });
    }
  },

  closeReveal: () => set({ reveal: null }),

  playAssemble: () => {
    get().timeRef.current = 0;
    set({
      playing: true,
      layers: withAssembleLayers(get().layers),
    });
  },
}));
