import type { ShapeType, Vec3 } from "../types";
import { DEFAULT_GRID_SIZE } from "../types";

export const SHAPE_TYPES: ShapeType[] = [
  "cube",
  "sphere",
  "diamond",
  "cylinder",
  "torus",
  "pyramid",
  "cross",
  "shell",
];

export const SHAPE_LABELS: Record<ShapeType, string> = {
  cube: "Cube",
  sphere: "Sphere",
  diamond: "Diamond",
  cylinder: "Cylinder",
  torus: "Torus",
  pyramid: "Pyramid",
  cross: "Cross",
  shell: "Shell",
};

export const SHAPE_HINTS: Record<ShapeType, string> = {
  cube: "The complete cryptographic lattice.",
  sphere: "Carves the active voxels into an orbiting sphere silhouette.",
  diamond: "An octahedral diamond mask driven by Manhattan distance.",
  cylinder: "A vertical cylinder through the full Y axis.",
  torus: "A hollow torus ring with a feathered tube edge.",
  pyramid: "A tapered four-sided pyramid rising through the matrix.",
  cross: "A three-axis plus sign formed from three orthogonal slabs.",
  shell: "Hollows the core and keeps the outer cryptographic shell.",
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function shapeMask(
  shape: ShapeType,
  coord: Vec3,
  gridSize = DEFAULT_GRID_SIZE,
): number {
  const half = Math.max((gridSize - 1) / 2, 1);
  const dx = (coord[0] - half) / half;
  const dy = (coord[1] - half) / half;
  const dz = (coord[2] - half) / half;
  const radialXZ = Math.sqrt(dx * dx + dz * dz);

  switch (shape) {
    case "sphere": {
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return 1 - smoothstep(0.975, 1.175, distance);
    }
    case "diamond": {
      const distance = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      return 1 - smoothstep(1.675, 1.95, distance);
    }
    case "cylinder":
      return 1 - smoothstep(0.975, 1.1625, radialXZ);
    case "torus": {
      const tube = Math.sqrt((radialXZ - 0.6375) ** 2 + (dy * 1.1) ** 2);
      return 1 - smoothstep(0.3125, 0.45, tube);
    }
    case "pyramid": {
      const t = coord[1] / Math.max(1, gridSize - 1);
      const allowed = 0.35 + (1 - t) * 0.7875;
      const maxAxis = Math.max(Math.abs(dx), Math.abs(dz));
      return 1 - smoothstep(allowed, allowed + 0.1875, maxAxis);
    }
    case "cross": {
      const minAxis = Math.min(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      return 1 - smoothstep(0.2875, 0.425, minAxis);
    }
    case "shell": {
      const maxAxis = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      return smoothstep(0.525, 0.75, maxAxis);
    }
    case "cube":
    default:
      return 1;
  }
}
