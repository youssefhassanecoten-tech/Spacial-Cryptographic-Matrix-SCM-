import type { ShapeType, Vec3 } from "../types";
import { GRID_HALF } from "../types";

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
  cube: "The complete 9 × 9 × 9 cryptographic lattice.",
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

export function shapeMask(shape: ShapeType, coord: Vec3): number {
  const dx = coord[0] - GRID_HALF;
  const dy = coord[1] - GRID_HALF;
  const dz = coord[2] - GRID_HALF;
  const radialXZ = Math.sqrt(dx * dx + dz * dz);

  switch (shape) {
    case "sphere": {
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return 1 - smoothstep(3.9, 4.7, distance);
    }
    case "diamond": {
      const distance = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      return 1 - smoothstep(6.7, 7.8, distance);
    }
    case "cylinder":
      return 1 - smoothstep(3.9, 4.65, radialXZ);
    case "torus": {
      const tube = Math.sqrt((radialXZ - 2.55) ** 2 + (dy * 1.1) ** 2);
      return 1 - smoothstep(1.25, 1.8, tube);
    }
    case "pyramid": {
      const t = coord[1] / 8;
      const allowed = 1.4 + (1 - t) * 3.15;
      const maxAxis = Math.max(Math.abs(dx), Math.abs(dz));
      return 1 - smoothstep(allowed, allowed + 0.75, maxAxis);
    }
    case "cross": {
      const minAxis = Math.min(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      return 1 - smoothstep(1.15, 1.7, minAxis);
    }
    case "shell": {
      const maxAxis = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      return smoothstep(2.1, 3.0, maxAxis);
    }
    case "cube":
    default:
      return 1;
  }
}
