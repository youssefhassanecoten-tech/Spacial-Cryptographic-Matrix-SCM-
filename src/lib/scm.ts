import type {
  FillMode,
  SCMPayload,
  SCMPayloadManifest,
  SCMAnchor,
  SCMMatrix,
  SCMTokenPayload,
  Vec3,
} from "../types";
import {
  DEFAULT_GRID_SIZE,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
} from "../types";
import { hashCell, mulberry32, randomId, randomSeed, seededShuffle } from "./rng";

export function normalizeGridSize(value = DEFAULT_GRID_SIZE): number {
  const integer = Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, Math.round(value)));
  return Math.max(
    MIN_GRID_SIZE,
    Math.min(MAX_GRID_SIZE, Math.round(integer / 3) * 3),
  );
}

export function worldSpacing(gridSize: number): number {
  return 8.8 / Math.max(1, gridSize - 0.2);
}

export function voxelIndex(
  x: number,
  y: number,
  z: number,
  gridSize = DEFAULT_GRID_SIZE,
): number {
  return (z * gridSize + y) * gridSize + x;
}

export function indexToCoord(index: number, gridSize = DEFAULT_GRID_SIZE): Vec3 {
  const x = index % gridSize;
  const y = Math.floor(index / gridSize) % gridSize;
  const z = Math.floor(index / (gridSize * gridSize));
  return [x, y, z];
}

export function isInBounds(coord: Vec3, gridSize = DEFAULT_GRID_SIZE): boolean {
  return coord.every(
    (value) => Number.isInteger(value) && value >= 0 && value < gridSize,
  );
}

function anchorCandidates(gridSize: number): Vec3[] {
  const max = gridSize - 1;
  const mid = Math.floor(max / 2);
  const candidates: Vec3[] = [];
  for (const x of [0, max]) {
    for (const y of [0, max]) {
      for (const z of [0, max]) {
        candidates.push([x, y, z]);
      }
    }
  }
  candidates.push([mid, 0, mid], [mid, max, mid]);
  candidates.push([0, mid, mid], [max, mid, mid]);
  candidates.push([mid, mid, 0], [mid, mid, max]);
  candidates.push([mid, mid, mid]);
  return candidates;
}

const ANCHOR_LABELS = ["Anchor A", "Anchor B", "Anchor C"];

export function deriveAnchors(
  seed: number,
  gridSize = DEFAULT_GRID_SIZE,
): SCMAnchor[] {
  const shuffled = seededShuffle(anchorCandidates(gridSize), seed ^ 0xa5a5a5a5);
  return shuffled.slice(0, 3).map((coord, index) => ({
    id: index,
    label: ANCHOR_LABELS[index],
    coord: [...coord] as Vec3,
  }));
}

export function buildAlignmentPath(
  anchors: SCMAnchor[],
  gridSize = DEFAULT_GRID_SIZE,
): number[] {
  if (anchors.length === 0) {
    return [];
  }
  const path: number[] = [];
  const push = (coord: Vec3) => {
    const index = voxelIndex(coord[0], coord[1], coord[2], gridSize);
    if (path[path.length - 1] !== index) {
      path.push(index);
    }
  };

  push(anchors[0].coord);
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const from = anchors[i].coord;
    const to = anchors[i + 1].coord;
    const cursor: Vec3 = [...from] as Vec3;
    for (let axis = 0; axis < 3; axis += 1) {
      while (cursor[axis] !== to[axis]) {
        cursor[axis] += cursor[axis] < to[axis] ? 1 : -1;
        push(cursor);
      }
    }
  }
  return path;
}

function ensureBlockFloor(bits: Uint8Array, seed: number, gridSize: number): void {
  const rng = mulberry32(seed ^ 0x1b56c4e9);
  const blocksPerAxis = Math.floor(gridSize / 3);
  for (let bz = 0; bz < blocksPerAxis; bz += 1) {
    for (let by = 0; by < blocksPerAxis; by += 1) {
      for (let bx = 0; bx < blocksPerAxis; bx += 1) {
        const cells: Vec3[] = [];
        let active = 0;
        for (let z = 0; z < 3; z += 1) {
          for (let y = 0; y < 3; y += 1) {
            for (let x = 0; x < 3; x += 1) {
              const coord: Vec3 = [bx * 3 + x, by * 3 + y, bz * 3 + z];
              const index = voxelIndex(coord[0], coord[1], coord[2], gridSize);
              if (bits[index]) {
                active += 1;
              } else {
                cells.push(coord);
              }
            }
          }
        }
        let guard = 0;
        while (active < 4 && cells.length > 0 && guard < 64) {
          guard += 1;
          const pick = Math.floor(rng() * cells.length);
          const [coord] = cells.splice(pick, 1);
          const index = voxelIndex(coord[0], coord[1], coord[2], gridSize);
          bits[index] = 1;
          active += 1;
        }
      }
    }
  }
}

export interface MatrixFill {
  mode: FillMode;
  count?: number;
}

export function createMatrixFromSeed(
  seed: number,
  meta: { id: string; label: string; createdAt: string },
  anchorsInput?: Vec3[],
  gridSizeInput = DEFAULT_GRID_SIZE,
  fillInput?: MatrixFill,
): SCMMatrix {
  const normalizedSeed = seed >>> 0;
  const gridSize = normalizeGridSize(gridSizeInput);
  const voxelCount = gridSize ** 3;
  const half = (gridSize - 1) / 2;
  const anchors: SCMAnchor[] = anchorsInput
    ? anchorsInput.map((coord, index) => ({
        id: index,
        label: ANCHOR_LABELS[index] ?? `Anchor ${index + 1}`,
        coord: [...coord] as Vec3,
      }))
    : deriveAnchors(normalizedSeed, gridSize);

  const bits = new Uint8Array(voxelCount);
  if (fillInput?.mode === "full") {
    bits.fill(1);
  } else if (!fillInput) {
    const rng = mulberry32(normalizedSeed ^ 0x9e3779b9);
    for (let z = 0; z < gridSize; z += 1) {
      for (let y = 0; y < gridSize; y += 1) {
        for (let x = 0; x < gridSize; x += 1) {
          const dx = x - half;
          const dy = y - half;
          const dz = z - half;
          const distanceNorm =
            Math.sqrt(dx * dx + dy * dy + dz * dz) /
            (Math.sqrt(3) * Math.max(half, 1));
          const probability = 0.27 + distanceNorm * 0.13;
          if (rng() < probability) {
            bits[voxelIndex(x, y, z, gridSize)] = 1;
          }
        }
      }
    }

    const blocksPerAxis = Math.floor(gridSize / 3);
    for (let bz = 0; bz < blocksPerAxis; bz += 1) {
      for (let by = 0; by < blocksPerAxis; by += 1) {
        for (let bx = 0; bx < blocksPerAxis; bx += 1) {
          bits[voxelIndex(bx * 3 + 1, by * 3 + 1, bz * 3 + 1, gridSize)] = 1;
        }
      }
    }

    ensureBlockFloor(bits, normalizedSeed, gridSize);
  }

  const indices = Array.from({ length: voxelCount }, (_, index) => index);
  const order = seededShuffle(indices, normalizedSeed ^ 0x51ed270b);
  const orderRank = new Uint16Array(voxelCount);
  order.forEach((index, rank) => {
    orderRank[index] = rank;
  });

  for (const anchor of anchors) {
    if (isInBounds(anchor.coord, gridSize)) {
      bits[voxelIndex(anchor.coord[0], anchor.coord[1], anchor.coord[2], gridSize)] = 1;
    }
  }

  const path = buildAlignmentPath(anchors, gridSize);
  for (const index of path) {
    bits[index] = 1;
  }

  if (fillInput?.mode === "data") {
    const target = Math.min(
      voxelCount,
      Math.max(1, Math.round(fillInput.count ?? 1)),
    );
    let active = 0;
    for (let i = 0; i < bits.length; i += 1) {
      active += bits[i];
    }
    for (const index of order) {
      if (active >= target) {
        break;
      }
      if (!bits[index]) {
        bits[index] = 1;
        active += 1;
      }
    }
  }

  let activeCount = 0;
  for (let i = 0; i < bits.length; i += 1) {
    activeCount += bits[i];
  }

  return {
    id: meta.id,
    seed: normalizedSeed,
    label: meta.label,
    createdAt: meta.createdAt,
    gridSize,
    voxelCount,
    bits,
    anchors,
    path,
    order,
    orderRank,
    activeCount,
    ...(fillInput ? { fill: fillInput.mode } : {}),
    ...(fillInput?.mode === "data" ? { fillCount: activeCount } : {}),
  };
}

export function createBlankMatrix(
  label = "Untitled SCM",
  gridSizeInput = DEFAULT_GRID_SIZE,
): SCMMatrix {
  const gridSize = normalizeGridSize(gridSizeInput);
  const voxelCount = gridSize ** 3;
  const order = Array.from({ length: voxelCount }, (_, index) => index);
  const orderRank = new Uint16Array(voxelCount);
  return {
    id: "scm_blank",
    seed: 0,
    label,
    createdAt: new Date(0).toISOString(),
    gridSize,
    voxelCount,
    bits: new Uint8Array(voxelCount),
    anchors: [],
    path: [],
    order,
    orderRank,
    activeCount: 0,
  };
}

export function createNewMatrix(
  label = "Untitled Lattice",
  gridSize = DEFAULT_GRID_SIZE,
  fill?: MatrixFill,
): SCMMatrix {
  const seed = randomSeed();
  return createMatrixFromSeed(
    seed,
    {
      id: randomId(),
      label,
      createdAt: new Date().toISOString(),
    },
    undefined,
    gridSize,
    fill,
  );
}

export function matrixToPayload(
  matrix: SCMMatrix,
  payload?: SCMPayload | null,
  extra?: {
    shapeId?: string;
    salt?: string;
    contentRoot?: string;
    manifest?: SCMPayloadManifest;
  },
): SCMTokenPayload {
  return {
    v: 1,
    id: matrix.id,
    seed: matrix.seed,
    label: matrix.label,
    createdAt: matrix.createdAt,
    gridSize: matrix.gridSize,
    anchors: matrix.anchors.map((anchor) => [...anchor.coord] as Vec3),
    ...(matrix.fill ? { fill: matrix.fill } : {}),
    ...(matrix.fill === "data" && matrix.fillCount !== undefined
      ? { fillCount: matrix.fillCount }
      : {}),
    ...(payload ? { payload } : {}),
    ...(extra?.shapeId ? { shapeId: extra.shapeId } : {}),
    ...(extra?.salt ? { salt: extra.salt } : {}),
    ...(extra?.contentRoot ? { contentRoot: extra.contentRoot } : {}),
    ...(extra?.manifest ? { manifest: extra.manifest } : {}),
  };
}

export function matrixFromPayload(payload: SCMTokenPayload): SCMMatrix {
  return createMatrixFromSeed(
    payload.seed,
    {
      id: payload.id,
      label: payload.label,
      createdAt: payload.createdAt,
    },
    payload.anchors,
    payload.gridSize ?? DEFAULT_GRID_SIZE,
    payload.fill
      ? { mode: payload.fill, count: payload.fillCount }
      : undefined,
  );
}

export function coordToWorld(
  coord: Vec3,
  gridSize = DEFAULT_GRID_SIZE,
  spacing = worldSpacing(gridSize),
): Vec3 {
  const half = (normalizeGridSize(gridSize) - 1) / 2;
  return [
    (coord[0] - half) * spacing,
    (coord[1] - half) * spacing,
    (coord[2] - half) * spacing,
  ];
}

export function anchorPhysicalCenters(
  matrix: SCMMatrix,
  spacing = worldSpacing(matrix.gridSize),
): Vec3[] {
  return matrix.anchors.map((anchor) =>
    coordToWorld(anchor.coord, matrix.gridSize, spacing),
  );
}

export function stableHash(values: Array<number | string>): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (const value of values) {
    if (typeof value === "number") {
      h1 ^= value | 0;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= (value | 0) + 0x9e37;
      h2 = Math.imul(h2 ^ (h2 >>> 13), 0x85ebca6b);
    } else {
      for (let i = 0; i < value.length; i += 1) {
        h1 ^= value.charCodeAt(i);
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= value.charCodeAt(i) + i;
        h2 = Math.imul(h2 ^ (h2 >>> 11), 0x27d4eb2f);
      }
    }
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function bitstreamSignature(matrix: SCMMatrix): string {
  return stableHash([matrix.seed, matrix.gridSize, ...Array.from(matrix.bits)]);
}

export function alignmentSignature(matrix: SCMMatrix): string {
  return stableHash([
    matrix.id,
    matrix.seed,
    matrix.gridSize,
    ...matrix.anchors.flatMap((anchor) => anchor.coord),
    ...matrix.path,
  ]);
}

export function executionSignature(matrix: SCMMatrix): string {
  return stableHash([matrix.gridSize, ...matrix.order]);
}

export function anchorCenterSignature(matrix: SCMMatrix, spacing = 1): string {
  return stableHash(anchorPhysicalCenters(matrix, spacing).flat());
}

export function matrixSignature(matrix: SCMMatrix): string {
  return stableHash([
    matrix.gridSize,
    bitstreamSignature(matrix),
    alignmentSignature(matrix),
    executionSignature(matrix),
  ]);
}

export function neighborCount(matrix: SCMMatrix, coord: Vec3): number {
  let count = 0;
  const [x, y, z] = coord;
  const gridSize = matrix.gridSize;
  if (x > 0 && matrix.bits[voxelIndex(x - 1, y, z, gridSize)]) count += 1;
  if (x < gridSize - 1 && matrix.bits[voxelIndex(x + 1, y, z, gridSize)]) count += 1;
  if (y > 0 && matrix.bits[voxelIndex(x, y - 1, z, gridSize)]) count += 1;
  if (y < gridSize - 1 && matrix.bits[voxelIndex(x, y + 1, z, gridSize)]) count += 1;
  if (z > 0 && matrix.bits[voxelIndex(x, y, z - 1, gridSize)]) count += 1;
  if (z < gridSize - 1 && matrix.bits[voxelIndex(x, y, z + 1, gridSize)]) count += 1;
  return count;
}

export function contrastScores(matrix: SCMMatrix): Float32Array {
  const scores = new Float32Array(matrix.voxelCount);
  for (let index = 0; index < matrix.voxelCount; index += 1) {
    if (!matrix.bits[index]) {
      scores[index] = 1;
      continue;
    }
    const coord = indexToCoord(index, matrix.gridSize);
    const exposed = 6 - neighborCount(matrix, coord);
    const jitter =
      (hashCell(matrix.seed, coord[0], coord[1], coord[2]) / 0xffffffff) * 0.12;
    scores[index] = Math.min(1, exposed / 6 + jitter);
  }
  return scores;
}

export function matrixChecksum(matrix: SCMMatrix): string {
  return stableHash([
    matrix.id,
    matrix.seed,
    matrix.label,
    matrix.createdAt,
    matrix.gridSize,
    ...matrix.anchors.flatMap((anchor) => anchor.coord),
  ]);
}
