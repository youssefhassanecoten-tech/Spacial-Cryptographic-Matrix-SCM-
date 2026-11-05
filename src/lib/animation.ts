import type {
  AnimationLayer,
  AnimationType,
  EasingName,
  SCMMatrix,
  Vec3,
  WaveMode,
} from "../types";
import { GRID_HALF, GRID_SIZE } from "../types";
import { randomId } from "./rng";

export const EASINGS: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
};

export interface LayerPhase {
  phase: number;
  cycle: number;
  done: boolean;
}

export function getLayerPhase(layer: AnimationLayer, time: number): LayerPhase | null {
  if (!layer.enabled) {
    return null;
  }
  const duration = Math.max(0.05, layer.duration);
  if (time < layer.delay) {
    return null;
  }
  const local = time - layer.delay;
  if (layer.repeat > 0) {
    const total = duration * layer.repeat;
    if (local >= total) {
      return { phase: 1, cycle: layer.repeat - 1, done: true };
    }
  }
  const cycle = Math.floor(local / duration);
  return { phase: (local % duration) / duration, cycle, done: false };
}

export interface VoxelLike {
  index: number;
  x: number;
  y: number;
  z: number;
}

export interface VoxelAnimation {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  scale: number;
  glow: number;
}

function distanceFromAnchors(coord: Vec3, anchors: Vec3[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const dx = coord[0] - anchor[0];
    const dy = coord[1] - anchor[1];
    const dz = coord[2] - anchor[2];
    best = Math.min(best, Math.sqrt(dx * dx + dy * dy + dz * dz));
  }
  return best;
}

function waveOffset(
  voxel: VoxelLike,
  mode: WaveMode,
  axis: "x" | "y" | "z",
  anchors: Vec3[],
): number {
  if (mode === "spiral") {
    const maxDistance = Math.sqrt(3) * GRID_SIZE;
    const coord: Vec3 = [voxel.x, voxel.y, voxel.z];
    return distanceFromAnchors(coord, anchors) / maxDistance;
  }
  const value = axis === "x" ? voxel.x : axis === "y" ? voxel.y : voxel.z;
  return value / (GRID_SIZE - 1);
}

export function computeVoxelAnimation(
  voxel: VoxelLike,
  matrix: SCMMatrix,
  layers: AnimationLayer[],
  time: number,
  out: VoxelAnimation,
): VoxelAnimation {
  out.offsetX = 0;
  out.offsetY = 0;
  out.offsetZ = 0;
  out.scale = 1;
  out.glow = 1;

  let anchors3D: Vec3[] | null = null;
  const spatialPhase =
    voxel.x * 0.73 + voxel.y * 1.19 + voxel.z * 1.61 + matrix.seed * 0.00001;

  for (const layer of layers) {
    if (!layer.enabled) {
      continue;
    }
    const phase = getLayerPhase(layer, time);
    if (!phase) {
      continue;
    }
    switch (layer.type) {
      case "explode": {
        const rank = matrix.orderRank[voxel.index] / (matrix.order.length || 1);
        const start = rank * 0.5;
        const local = Math.max(0, Math.min(1, (phase.phase - start) / (1 - start)));
        const factor = Math.sin(Math.PI * local) * layer.intensity;
        const dx = voxel.x - GRID_HALF;
        const dy = voxel.y - GRID_HALF;
        const dz = voxel.z - GRID_HALF;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = length > 0.001 ? dx / length : 0;
        const ny = length > 0.001 ? dy / length : 1;
        const nz = length > 0.001 ? dz / length : 0;
        out.offsetX += nx * factor * 3.4;
        out.offsetY += ny * factor * 3.4;
        out.offsetZ += nz * factor * 3.4;
        break;
      }
      case "layerWave": {
        anchors3D ??= matrix.anchors.map((anchor) => anchor.coord);
        const offset = waveOffset(voxel, layer.mode, layer.axis, anchors3D);
        const start = offset * 0.55;
        const raw = Math.max(0, Math.min(1, (phase.phase - start) / 0.45));
        out.scale *= Math.max(0.0001, EASINGS[layer.easing](raw));
        break;
      }
      case "pulse": {
        const oscillation = Math.sin(phase.phase * Math.PI * 2 + spatialPhase);
        out.scale *= 1 + oscillation * 0.18 * layer.intensity;
        break;
      }
      case "glow": {
        const oscillation = Math.sin(phase.phase * Math.PI * 2);
        out.glow *= 1 + oscillation * 0.85 * layer.intensity;
        break;
      }
      case "scanline": {
        const world = (layer.axis === "x" ? voxel.x : layer.axis === "y" ? voxel.y : voxel.z) - GRID_HALF;
        const sweep = -GRID_HALF + phase.phase * (GRID_SIZE - 1);
        const proximity = Math.max(0, 1 - Math.abs(world - sweep) / 1.1);
        out.glow *= 1 + proximity * 1.6 * layer.intensity;
        break;
      }
      default:
        break;
    }
  }

  out.scale = Math.max(0.0001, out.scale);
  out.glow = Math.max(0.05, out.glow);
  return out;
}

export interface ScanlineState {
  active: boolean;
  progress: number;
  axis: "x" | "y" | "z";
}

export function getScanlineState(layers: AnimationLayer[], time: number): ScanlineState {
  const layer = layers.find((entry) => entry.type === "scanline" && entry.enabled);
  if (!layer) {
    return { active: false, progress: 0, axis: "z" };
  }
  const phase = getLayerPhase(layer, time);
  if (!phase) {
    return { active: false, progress: 0, axis: layer.axis };
  }
  return { active: !phase.done, progress: phase.phase, axis: layer.axis };
}

export function hasMotion(layers: AnimationLayer[]): boolean {
  return layers.some((layer) => layer.enabled);
}

const LAYER_DEFAULTS: Record<AnimationType, Omit<AnimationLayer, "id">> = {
  explode: {
    type: "explode",
    name: "Explode / Assemble",
    enabled: false,
    delay: 0,
    duration: 2.6,
    easing: "easeInOutCubic",
    repeat: 1,
    intensity: 0.85,
    axis: "z",
    mode: "slice",
  },
  layerWave: {
    type: "layerWave",
    name: "Layer Wave",
    enabled: false,
    delay: 0.15,
    duration: 2.8,
    easing: "easeOutCubic",
    repeat: 1,
    intensity: 0.8,
    axis: "z",
    mode: "slice",
  },
  pulse: {
    type: "pulse",
    name: "Pulse",
    enabled: true,
    delay: 0,
    duration: 2.4,
    easing: "sine",
    repeat: 0,
    intensity: 0.4,
    axis: "y",
    mode: "slice",
  },
  glow: {
    type: "glow",
    name: "Glow / Breathe",
    enabled: true,
    delay: 0,
    duration: 3.2,
    easing: "sine",
    repeat: 0,
    intensity: 0.45,
    axis: "y",
    mode: "slice",
  },
  scanline: {
    type: "scanline",
    name: "Scanline Matrix",
    enabled: false,
    delay: 0.3,
    duration: 4.2,
    easing: "linear",
    repeat: 0,
    intensity: 0.9,
    axis: "z",
    mode: "slice",
  },
};

export function createAnimationLayer(type: AnimationType): AnimationLayer {
  return { id: randomId("layer"), ...LAYER_DEFAULTS[type] };
}

export function defaultAnimationLayers(): AnimationLayer[] {
  return [
    createAnimationLayer("explode"),
    createAnimationLayer("layerWave"),
    createAnimationLayer("pulse"),
    createAnimationLayer("glow"),
    createAnimationLayer("scanline"),
  ];
}

export const ANIMATION_TYPES: AnimationType[] = [
  "explode",
  "layerWave",
  "pulse",
  "glow",
  "scanline",
];

export const EASING_LABELS: Record<EasingName, string> = {
  linear: "Linear",
  easeInQuad: "Ease In",
  easeOutCubic: "Ease Out",
  easeInOutCubic: "Ease In Out",
  sine: "Sine",
  backOut: "Back Out",
};

export const EASING_NAMES: EasingName[] = [
  "linear",
  "easeInQuad",
  "easeOutCubic",
  "easeInOutCubic",
  "sine",
  "backOut",
];
