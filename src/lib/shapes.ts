import type { ShapeType, Vec3 } from "../types";
import { DEFAULT_GRID_SIZE } from "../types";

export const SHAPE_TYPES: ShapeType[] = [
  "cube",
  "pyramid",
  "cross",
  "shell",
  "diamond",
  "octahedron",
  "icosahedron",
  "dodecahedron",
  "hexPrism",
  "ziggurat",
  "obelisk",
  "star",
  "crystal",
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
  octahedron: "Octa",
  icosahedron: "Icosa",
  dodecahedron: "Dodeca",
  hexPrism: "Hex prism",
  ziggurat: "Ziggurat",
  obelisk: "Obelisk",
  star: "Star",
  crystal: "Crystal",
};

export const SHAPE_HINTS: Record<ShapeType, string> = {
  cube: "The complete cryptographic lattice.",
  sphere: "Legacy curved sphere mask, kept for older saved designs.",
  diamond: "An elongated octahedral diamond driven by Manhattan distance.",
  cylinder: "Legacy curved cylinder mask, kept for older saved designs.",
  torus: "Legacy curved torus mask, kept for older saved designs.",
  pyramid: "A tapered four-sided pyramid rising through the matrix.",
  cross: "A three-axis plus sign formed from three orthogonal slabs.",
  shell: "Hollows the core and keeps the outer cryptographic shell.",
  octahedron: "A sharp eight-faced solid with a flat facet at every angle.",
  icosahedron: "Twenty triangular faces for a dense, angular crystal silhouette.",
  dodecahedron: "Twelve pentagonal faces with broad planes for face glyphs.",
  hexPrism: "A six-sided column with flat vertical faces from base to top.",
  ziggurat: "Stepped terraces that recede toward the summit.",
  obelisk: "A tall rectangular shaft with a narrow flat-topped crown.",
  star: "A five-point star fort extruded through the full Y axis.",
  crystal: "A hexagonal bipyramid crystal with tapered point groups.",
};

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

type Normal = [number, number, number];

function normalized([x, y, z]: Normal): Normal {
  const length = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / length, y / length, z / length];
}

const ICOSA_VERTEX_NORMALS: Normal[] = [
  [0, 1, PHI],
  [0, 1, -PHI],
  [0, -1, PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [1, -PHI, 0],
  [-1, PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, 1],
  [-PHI, 0, -1],
].map((normal) => normalized(normal as Normal));

const DODECA_VERTEX_NORMALS: Normal[] = [
  [0, INV_PHI, PHI],
  [0, INV_PHI, -PHI],
  [0, -INV_PHI, PHI],
  [0, -INV_PHI, -PHI],
  [INV_PHI, PHI, 0],
  [INV_PHI, -PHI, 0],
  [-INV_PHI, PHI, 0],
  [-INV_PHI, -PHI, 0],
  [PHI, 0, INV_PHI],
  [PHI, 0, -INV_PHI],
  [-PHI, 0, INV_PHI],
  [-PHI, 0, -INV_PHI],
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [1, -1, -1],
  [-1, 1, 1],
  [-1, 1, -1],
  [-1, -1, 1],
  [-1, -1, -1],
].map((normal) => normalized(normal as Normal));

function facetDistance(
  dx: number,
  dy: number,
  dz: number,
  normals: Normal[],
): number {
  let distance = 0;
  for (const [nx, ny, nz] of normals) {
    distance = Math.max(distance, Math.abs(dx * nx + dy * ny + dz * nz));
  }
  return distance;
}

function axialHexDistance(x: number, z: number): number {
  const q = (2 / 3) * x;
  const r = (-1 / 3) * x + (Math.sqrt(3) / 3) * z;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
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
  const maxAxis = Math.max(Math.abs(dx), Math.abs(dz));

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
      return 1 - smoothstep(allowed, allowed + 0.1875, maxAxis);
    }
    case "cross": {
      const minAxis = Math.min(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      return 1 - smoothstep(0.2875, 0.425, minAxis);
    }
    case "shell": {
      const maxCorner = Math.max(
        Math.abs(dx),
        Math.abs(dy),
        Math.abs(dz),
      );
      return smoothstep(0.525, 0.75, maxCorner);
    }
    case "octahedron": {
      const distance = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      return 1 - smoothstep(0.94, 1.08, distance);
    }
    case "icosahedron": {
      const distance = facetDistance(dx, dy, dz, DODECA_VERTEX_NORMALS);
      return 1 - smoothstep(0.83, 0.95, distance);
    }
    case "dodecahedron": {
      const distance = facetDistance(dx, dy, dz, ICOSA_VERTEX_NORMALS);
      return 1 - smoothstep(0.79, 0.93, distance);
    }
    case "hexPrism": {
      const hex = axialHexDistance(dx, dz);
      return 1 - smoothstep(0.9, 1.02, hex);
    }
    case "ziggurat": {
      const t = (dy + 1) / 2;
      const step = Math.floor(t * 5) / 5;
      const allowed = 0.92 - step * 0.16;
      return 1 - smoothstep(allowed, allowed + 0.08, maxAxis);
    }
    case "obelisk": {
      const t = (dy + 1) / 2;
      const allowed = t < 0.78 ? 0.58 : 0.58 - ((t - 0.78) / 0.22) * 0.42;
      return 1 - smoothstep(allowed, allowed + 0.06, maxAxis);
    }
    case "star": {
      const angle = Math.atan2(dz, dx);
      const points = 0.5 + 0.5 * Math.abs(Math.cos(2.5 * angle));
      const allowed = 0.42 + points * 0.42;
      const body = 1 - smoothstep(allowed - 0.08, allowed + 0.04, radialXZ);
      const height = 1 - smoothstep(0.82, 0.98, Math.abs(dy));
      return body * height;
    }
    case "crystal": {
      const hex = axialHexDistance(dx, dz);
      const allowed = 0.9 - Math.abs(dy) * 0.74;
      return 1 - smoothstep(allowed - 0.06, allowed + 0.06, hex);
    }
    case "cube":
    default:
      return 1;
  }
}
