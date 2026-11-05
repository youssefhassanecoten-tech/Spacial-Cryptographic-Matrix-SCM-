import type {
  SCMMatrix,
  TrajectoryPoint2D,
  TrajectoryResult,
  Vec3,
} from "../types";
import { coordToWorld, indexToCoord, stableHash } from "./scm";

type Vector = [number, number, number];

function subtract(a: Vector, b: Vector): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(a: Vector): number {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Vector): Vector {
  const len = length(a);
  return len > 1e-9 ? [a[0] / len, a[1] / len, a[2] / len] : [0, 0, 1];
}

function projectPoints(points: Vector[], anchors: Vector[]): TrajectoryPoint2D[] {
  const a0 = anchors[0] ?? ([0, 0, 0] as Vector);
  const a1 = anchors[1] ?? ([1, 0, 0] as Vector);
  const a2 = anchors[2] ?? ([0, 1, 0] as Vector);
  const u = normalize(subtract(a1, a0));
  let normal = cross(subtract(a1, a0), subtract(a2, a0));
  if (length(normal) < 1e-6) {
    const fallback = Math.abs(u[1]) > 0.9 ? ([1, 0, 0] as Vector) : ([0, 1, 0] as Vector);
    normal = cross(u, fallback);
  }
  normal = normalize(normal);
  const v = normalize(cross(normal, u));
  const origin = anchors.length
    ? ([
        anchors.reduce((sum, point) => sum + point[0], 0) / anchors.length,
        anchors.reduce((sum, point) => sum + point[1], 0) / anchors.length,
        anchors.reduce((sum, point) => sum + point[2], 0) / anchors.length,
      ] as Vector)
    : ([0, 0, 0] as Vector);

  const raw = points.map((point) => {
    const relative = subtract(point, origin);
    return { x: dot(relative, u), y: dot(relative, v) };
  });

  const all = [...raw, ...anchors.map((point) => {
    const relative = subtract(point, origin);
    return { x: dot(relative, u), y: dot(relative, v) };
  })];

  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const minY = Math.min(...all.map((point) => point.y));
  const maxY = Math.max(...all.map((point) => point.y));
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const padding = 0.06;
  const scale = (1 - padding * 2) / Math.max(width, height);
  const offsetX = (1 - width * scale) / 2 - minX * scale;
  const offsetY = (1 - height * scale) / 2 - minY * scale;

  return raw.map((point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  }));
}

export function flattenToConstellation(
  points3D: Vec3[],
  anchorPoints: Vec3[],
): TrajectoryPoint2D[] {
  return projectPoints(points3D as Vector[], anchorPoints as Vector[]);
}

export function buildTrajectory(matrix: SCMMatrix): TrajectoryResult {
  const coords = matrix.path.map(indexToCoord);
  const points3D = coords.map((coord) => coordToWorld(coord));
  const anchorPoints3D = matrix.anchors.map((anchor) => coordToWorld(anchor.coord));
  const segments: Array<[Vec3, Vec3]> = [];
  for (let i = 0; i < points3D.length - 1; i += 1) {
    segments.push([points3D[i], points3D[i + 1]]);
  }
  const allPoints = [...points3D, ...anchorPoints3D] as Vector[];
  const constellation = projectPoints(points3D as Vector[], allPoints);
  const constellationAnchors = projectPoints(anchorPoints3D as Vector[], allPoints);
  const signature = stableHash([
    matrix.id,
    ...coords.flat(),
    ...matrix.anchors.flatMap((anchor) => anchor.coord),
  ]);
  const constellationSignature = stableHash(
    constellation.flatMap((point) => [
      Math.round(point.x * 10000),
      Math.round(point.y * 10000),
    ]),
  );
  return {
    points3D,
    segments,
    anchorPoints3D,
    constellation,
    constellationAnchors,
    signature,
    constellationSignature,
  };
}

export function manhattanAdjacent(a: Vec3, b: Vec3): boolean {
  return (
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1
  );
}

export interface TrajectoryChecks {
  allPathBitsActive: boolean;
  connectedSegments: boolean;
  anchorsPresent: boolean;
  constellationInBounds: boolean;
  pointCount: number;
  segmentCount: number;
  anchorCount: number;
}

export function validateTrajectory(
  matrix: SCMMatrix,
  trajectory: TrajectoryResult,
): TrajectoryChecks {
  const coords = matrix.path.map(indexToCoord);
  const allPathBitsActive = matrix.path.every((index) => matrix.bits[index] === 1);
  let connectedSegments = true;
  for (let i = 0; i < coords.length - 1; i += 1) {
    if (!manhattanAdjacent(coords[i], coords[i + 1])) {
      connectedSegments = false;
      break;
    }
  }
  const anchorKeys = new Set(matrix.anchors.map((anchor) => anchor.coord.join(",")));
  const pathKeys = new Set(coords.map((coord) => coord.join(",")));
  const anchorsPresent = [...anchorKeys].every((key) => pathKeys.has(key));
  const constellationInBounds = trajectory.constellation.every(
    (point) =>
      point.x >= -1e-6 &&
      point.x <= 1 + 1e-6 &&
      point.y >= -1e-6 &&
      point.y <= 1 + 1e-6 &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y),
  );
  return {
    allPathBitsActive,
    connectedSegments,
    anchorsPresent,
    constellationInBounds,
    pointCount: trajectory.constellation.length,
    segmentCount: trajectory.segments.length,
    anchorCount: matrix.anchors.length,
  };
}
