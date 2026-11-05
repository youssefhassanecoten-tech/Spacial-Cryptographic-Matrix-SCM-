import type {
  SCMAnchor,
  SCMMatrix,
  SCMTokenPayload,
  Vec3,
} from "../types";
import { GRID_HALF, GRID_SIZE, VOXEL_COUNT } from "../types";
import { hashCell, mulberry32, randomId, randomSeed, seededShuffle } from "./rng";

export function voxelIndex(x: number, y: number, z: number): number {
  return (z * GRID_SIZE + y) * GRID_SIZE + x;
}

export function indexToCoord(index: number): Vec3 {
  const x = index % GRID_SIZE;
  const y = Math.floor(index / GRID_SIZE) % GRID_SIZE;
  const z = Math.floor(index / (GRID_SIZE * GRID_SIZE));
  return [x, y, z];
}

export function isInBounds(coord: Vec3): boolean {
  return coord.every((value) => Number.isInteger(value) && value >= 0 && value < GRID_SIZE);
}

const ANCHOR_CANDIDATES: Vec3[] = [
  [0, 0, 0],
  [8, 0, 0],
  [0, 8, 0],
  [8, 8, 0],
  [0, 0, 8],
  [8, 0, 8],
  [0, 8, 8],
  [8, 8, 8],
  [4, 0, 4],
  [4, 8, 4],
  [0, 4, 4],
  [8, 4, 4],
  [4, 4, 0],
  [4, 4, 8],
  [4, 4, 4],
];

const ANCHOR_LABELS = ["Anchor A", "Anchor B", "Anchor C"];

export function deriveAnchors(seed: number): SCMAnchor[] {
  const shuffled = seededShuffle(ANCHOR_CANDIDATES, seed ^ 0xa5a5a5a5);
  return shuffled.slice(0, 3).map((coord, index) => ({
    id: index,
    label: ANCHOR_LABELS[index],
    coord: [...coord] as Vec3,
  }));
}

export function buildAlignmentPath(anchors: SCMAnchor[]): number[] {
  if (anchors.length === 0) {
    return [];
  }
  const path: number[] = [];
  const push = (coord: Vec3) => {
    const index = voxelIndex(coord[0], coord[1], coord[2]);
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

function ensureBlockFloor(bits: Uint8Array, seed: number): void {
  const rng = mulberry32(seed ^ 0x1b56c4e9);
  for (let bz = 0; bz < 3; bz += 1) {
    for (let by = 0; by < 3; by += 1) {
      for (let bx = 0; bx < 3; bx += 1) {
        const cells: Vec3[] = [];
        let active = 0;
        for (let z = 0; z < 3; z += 1) {
          for (let y = 0; y < 3; y += 1) {
            for (let x = 0; x < 3; x += 1) {
              const coord: Vec3 = [bx * 3 + x, by * 3 + y, bz * 3 + z];
              const index = voxelIndex(coord[0], coord[1], coord[2]);
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
          const index = voxelIndex(coord[0], coord[1], coord[2]);
          bits[index] = 1;
          active += 1;
        }
      }
    }
  }
}

export function createMatrixFromSeed(
  seed: number,
  meta: { id: string; label: string; createdAt: string },
  anchorsInput?: Vec3[],
): SCMMatrix {
  const normalizedSeed = seed >>> 0;
  const anchors: SCMAnchor[] = anchorsInput
    ? anchorsInput.map((coord, index) => ({
        id: index,
        label: ANCHOR_LABELS[index] ?? `Anchor ${index + 1}`,
        coord: [...coord] as Vec3,
      }))
    : deriveAnchors(normalizedSeed);

  const bits = new Uint8Array(VOXEL_COUNT);
  const rng = mulberry32(normalizedSeed ^ 0x9e3779b9);
  for (let z = 0; z < GRID_SIZE; z += 1) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const dx = x - GRID_HALF;
        const dy = y - GRID_HALF;
        const dz = z - GRID_HALF;
        const distanceNorm =
          Math.sqrt(dx * dx + dy * dy + dz * dz) / (Math.sqrt(3) * GRID_HALF);
        const probability = 0.27 + distanceNorm * 0.13;
        if (rng() < probability) {
          bits[voxelIndex(x, y, z)] = 1;
        }
      }
    }
  }

  for (let bz = 0; bz < 3; bz += 1) {
    for (let by = 0; by < 3; by += 1) {
      for (let bx = 0; bx < 3; bx += 1) {
        bits[voxelIndex(bx * 3 + 1, by * 3 + 1, bz * 3 + 1)] = 1;
      }
    }
  }

  ensureBlockFloor(bits, normalizedSeed);

  for (const anchor of anchors) {
    if (isInBounds(anchor.coord)) {
      bits[voxelIndex(anchor.coord[0], anchor.coord[1], anchor.coord[2])] = 1;
    }
  }

  const path = buildAlignmentPath(anchors);
  for (const index of path) {
    bits[index] = 1;
  }

  const indices = Array.from({ length: VOXEL_COUNT }, (_, index) => index);
  const order = seededShuffle(indices, normalizedSeed ^ 0x51ed270b);
  const orderRank = new Uint16Array(VOXEL_COUNT);
  order.forEach((index, rank) => {
    orderRank[index] = rank;
  });

  let activeCount = 0;
  for (let i = 0; i < bits.length; i += 1) {
    activeCount += bits[i];
  }

  return {
    id: meta.id,
    seed: normalizedSeed,
    label: meta.label,
    createdAt: meta.createdAt,
    bits,
    anchors,
    path,
    order,
    orderRank,
    activeCount,
  };
}

export function createNewMatrix(label = "Untitled Lattice"): SCMMatrix {
  const seed = randomSeed();
  return createMatrixFromSeed(seed, {
    id: randomId(),
    label,
    createdAt: new Date().toISOString(),
  });
}

export function matrixToPayload(matrix: SCMMatrix): SCMTokenPayload {
  return {
    v: 1,
    id: matrix.id,
    seed: matrix.seed,
    label: matrix.label,
    createdAt: matrix.createdAt,
    anchors: matrix.anchors.map((anchor) => [...anchor.coord] as Vec3),
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
  );
}

export function coordToWorld(coord: Vec3, spacing = 1): Vec3 {
  return [
    (coord[0] - GRID_HALF) * spacing,
    (coord[1] - GRID_HALF) * spacing,
    (coord[2] - GRID_HALF) * spacing,
  ];
}

export function anchorPhysicalCenters(matrix: SCMMatrix, spacing = 1): Vec3[] {
  return matrix.anchors.map((anchor) => coordToWorld(anchor.coord, spacing));
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
  return stableHash([matrix.seed, ...Array.from(matrix.bits)]);
}

export function alignmentSignature(matrix: SCMMatrix): string {
  return stableHash([
    matrix.id,
    matrix.seed,
    ...matrix.anchors.flatMap((anchor) => anchor.coord),
    ...matrix.path,
  ]);
}

export function executionSignature(matrix: SCMMatrix): string {
  return stableHash([...matrix.order]);
}

export function anchorCenterSignature(matrix: SCMMatrix, spacing = 1): string {
  return stableHash(anchorPhysicalCenters(matrix, spacing).flat());
}

export function matrixSignature(matrix: SCMMatrix): string {
  return stableHash([
    bitstreamSignature(matrix),
    alignmentSignature(matrix),
    executionSignature(matrix),
  ]);
}

export function neighborCount(matrix: SCMMatrix, coord: Vec3): number {
  let count = 0;
  const [x, y, z] = coord;
  if (x > 0 && matrix.bits[voxelIndex(x - 1, y, z)]) count += 1;
  if (x < GRID_SIZE - 1 && matrix.bits[voxelIndex(x + 1, y, z)]) count += 1;
  if (y > 0 && matrix.bits[voxelIndex(x, y - 1, z)]) count += 1;
  if (y < GRID_SIZE - 1 && matrix.bits[voxelIndex(x, y + 1, z)]) count += 1;
  if (z > 0 && matrix.bits[voxelIndex(x, y, z - 1)]) count += 1;
  if (z < GRID_SIZE - 1 && matrix.bits[voxelIndex(x, y, z + 1)]) count += 1;
  return count;
}

export function contrastScores(matrix: SCMMatrix): Float32Array {
  const scores = new Float32Array(VOXEL_COUNT);
  for (let index = 0; index < VOXEL_COUNT; index += 1) {
    if (!matrix.bits[index]) {
      scores[index] = 1;
      continue;
    }
    const coord = indexToCoord(index);
    const exposed = 6 - neighborCount(matrix, coord);
    const jitter = (hashCell(matrix.seed, coord[0], coord[1], coord[2]) / 0xffffffff) * 0.12;
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
    ...matrix.anchors.flatMap((anchor) => anchor.coord),
  ]);
}
