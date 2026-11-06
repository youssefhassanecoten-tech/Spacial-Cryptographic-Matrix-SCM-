import type { DesignState, Vec3 } from "../types";
import { DEFAULT_GRID_SIZE } from "../types";


export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  const numeric = Number.parseInt(value, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b]
    .map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const aa = hexToRgb(a);
  const bb = hexToRgb(b);
  const amount = clamp(t, 0, 1);
  return rgbToHex({
    r: aa.r + (bb.r - aa.r) * amount,
    g: aa.g + (bb.g - aa.g) * amount,
    b: aa.b + (bb.b - aa.b) * amount,
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function threeStopGradient(a: string, b: string, c: string, t: number): string {
  const amount = clamp(t, 0, 1);
  return amount < 0.5 ? mixHex(a, b, amount * 2) : mixHex(b, c, (amount - 0.5) * 2);
}

export function sampleGradient(
  design: DesignState,
  coord: Vec3,
  gridSize = DEFAULT_GRID_SIZE,
): string {
  const [x, y, z] = coord;
  if (design.gradient === "none") {
    return design.colorBase;
  }
  if (design.gradient === "linear") {
    return threeStopGradient(
      design.colorA,
      design.colorB,
      design.colorC,
      z / Math.max(1, gridSize - 1),
    );
  }
  const half = (gridSize - 1) / 2;
  const dx = x - half;
  const dy = y - half;
  const dz = z - half;
  const maxDistance = Math.sqrt(3) * Math.max(half, 1);
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) / maxDistance;
  return threeStopGradient(design.colorA, design.colorB, design.colorC, distance);
}

export function sampleContrastRgb(score: number): RGB {
  if (score < 0.34) {
    return { r: 248, g: 113, b: 113 };
  }
  if (score < 0.5) {
    return { r: 251, g: 191, b: 36 };
  }
  if (score < 0.67) {
    return { r: 45, g: 212, b: 191 };
  }
  return { r: 34, g: 211, b: 238 };
}
