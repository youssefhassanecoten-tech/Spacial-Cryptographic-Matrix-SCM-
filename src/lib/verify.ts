import type {
  DesignState,
  GeometryStyle,
  MaterialType,
  TrajectoryResult,
  VerificationResult,
} from "../types";
import { VOXEL_COUNT } from "../types";
import { useStudio } from "../store/useStudio";
import { decryptToken } from "./crypto";
import { PATTERN_TYPES } from "./patterns";
import { SHAPE_TYPES } from "./shapes";
import {
  alignmentSignature,
  anchorCenterSignature,
  bitstreamSignature,
  executionSignature,
  matrixFromPayload,
  matrixSignature,
} from "./scm";
import {
  buildTrajectory,
  validateTrajectory,
} from "./trajectory";

const GEOMETRIES: GeometryStyle[] = ["classic", "maze", "polyhedral"];
const MATERIALS: MaterialType[] = ["matte", "metallic", "glass", "neon"];
const ROUGHNESS_VALUES = [0.05, 0.5, 0.95];

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

interface MatrixSnapshot {
  bits: string;
  anchors: string;
  alignment: string;
  execution: string;
  active: number;
}

function snapshotMatrix(): MatrixSnapshot {
  const { matrix } = useStudio.getState();
  return {
    bits: bitstreamSignature(matrix),
    anchors: anchorCenterSignature(matrix),
    alignment: alignmentSignature(matrix),
    execution: executionSignature(matrix),
    active: matrix.activeCount,
  };
}

function snapshotsMatch(a: MatrixSnapshot, b: MatrixSnapshot): boolean {
  return (
    a.bits === b.bits &&
    a.anchors === b.anchors &&
    a.alignment === b.alignment &&
    a.execution === b.execution &&
    a.active === b.active
  );
}

function describeMismatch(before: MatrixSnapshot, after: MatrixSnapshot): string {
  const fields: Array<keyof MatrixSnapshot> = [
    "bits",
    "anchors",
    "alignment",
    "execution",
    "active",
  ];
  const changed = fields.filter((field) => before[field] !== after[field]);
  return changed.length ? `Mutation detected in: ${changed.join(", ")}.` : "Unknown mutation.";
}

export async function runTestE(): Promise<VerificationResult> {
  const started = now();
  const state = useStudio.getState();
  const designBefore: DesignState = { ...state.design };
  const before = snapshotMatrix();
  let tested = 0;
  let mismatch = "";

  try {
    for (const geometry of GEOMETRIES) {
      for (const material of MATERIALS) {
        for (const roughness of ROUGHNESS_VALUES) {
          useStudio.getState().setDesign({
            geometry,
            material,
            roughness,
            metalness: material === "metallic" ? 0.92 : 0.18,
            opacity: material === "glass" ? 0.55 : 0.92,
            gradient: roughness < 0.3 ? "radial" : "linear",
            contrastGuard: roughness > 0.9,
          });
          tested += 1;
          const after = snapshotMatrix();
          if (!snapshotsMatch(before, after)) {
            mismatch = `Variant ${geometry}/${material}/r${roughness}: ${describeMismatch(
              before,
              after,
            )}`;
            break;
          }
        }
        if (mismatch) break;
      }
      if (mismatch) break;
    }

    if (!mismatch) {
      for (const shape of SHAPE_TYPES) {
        useStudio.getState().setDesign({
          ...designBefore,
          shape,
          pattern: "none",
          contrastGuard: false,
        });
        tested += 1;
        const after = snapshotMatrix();
        if (!snapshotsMatch(before, after)) {
          mismatch = `Shape ${shape}: ${describeMismatch(before, after)}`;
          break;
        }
      }
    }

    if (!mismatch) {
      for (const pattern of PATTERN_TYPES) {
        useStudio.getState().setDesign({
          ...designBefore,
          shape: "cube",
          pattern,
          patternScale: 6,
          patternIntensity: 0.8,
          patternColor: "#f97316",
          contrastGuard: false,
        });
        tested += 1;
        const after = snapshotMatrix();
        if (!snapshotsMatch(before, after)) {
          mismatch = `Pattern ${pattern}: ${describeMismatch(before, after)}`;
          break;
        }
      }
    }
  } finally {
    useStudio.getState().setDesign(designBefore);
  }

  const durationMs = now() - started;
  const passed = !mismatch;
  return {
    id: "E",
    name: "Studio Customization Interoperability",
    passed,
    detail: passed
      ? `${tested} render variants (geometry, materials, roughness, overall shapes, and per-block patterns) left the bitstream, alignment path, execution order, and anchor centers untouched.`
      : mismatch,
    metrics: {
      "variants tested": tested,
      "bitstream hash": before.bits,
      "anchor center hash": before.anchors,
      "alignment hash": before.alignment,
      "execution hash": before.execution,
      "active voxels": `${before.active}/${VOXEL_COUNT}`,
    },
    durationMs,
  };
}

export interface VerificationRun {
  results: VerificationResult[];
  trajectory: TrajectoryResult | null;
  passed: boolean;
}

export async function runTestF(): Promise<{ result: VerificationResult; trajectory: TrajectoryResult | null }> {
  const started = now();
  const { token, matrix, design } = useStudio.getState();
  if (!token) {
    return {
      result: {
        id: "F",
        name: "Token-Driven Trajectory Rendering",
        passed: false,
        detail: "No encrypted token is loaded. Generate or load a token first.",
        metrics: {},
        durationMs: now() - started,
      },
      trajectory: null,
    };
  }

  try {
    const payload = await decryptToken(token);
    const tokenMatrix = matrixFromPayload(payload);
    const trajectory = buildTrajectory(matrix);
    const tokenTrajectory = buildTrajectory(tokenMatrix);
    const checks = validateTrajectory(matrix, trajectory);
    const signatureStable = matrixSignature(matrix) === matrixSignature(tokenMatrix);
    const anchorPointsMatch =
      JSON.stringify(matrix.anchors.map((anchor) => anchor.coord)) ===
      JSON.stringify(tokenMatrix.anchors.map((anchor) => anchor.coord));

    useStudio.getState().setDesign({
      geometry: "maze",
      material: "glass",
      roughness: 0.05,
      metalness: 0.1,
      gradient: "radial",
      contrastGuard: true,
    });
    let styledTrajectory: TrajectoryResult;
    try {
      styledTrajectory = buildTrajectory(useStudio.getState().matrix);
    } finally {
      useStudio.getState().setDesign(design);
    }

    const styleStable =
      styledTrajectory.signature === trajectory.signature &&
      styledTrajectory.constellationSignature === trajectory.constellationSignature;
    const tokenStable =
      tokenTrajectory.signature === trajectory.signature &&
      tokenTrajectory.constellationSignature === trajectory.constellationSignature;

    const passed =
      checks.allPathBitsActive &&
      checks.connectedSegments &&
      checks.anchorsPresent &&
      checks.constellationInBounds &&
      signatureStable &&
      anchorPointsMatch &&
      styleStable &&
      tokenStable;

    const failures: string[] = [];
    if (!checks.allPathBitsActive) failures.push("inactive path voxel");
    if (!checks.connectedSegments) failures.push("non-adjacent trajectory segment");
    if (!checks.anchorsPresent) failures.push("anchor missing from path");
    if (!checks.constellationInBounds) failures.push("constellation left unit bounds");
    if (!signatureStable) failures.push("token did not reproduce the matrix");
    if (!anchorPointsMatch) failures.push("decrypted anchors differ");
    if (!styleStable) failures.push("visual style shifted the glyph");
    if (!tokenStable) failures.push("token trajectory diverged");

    return {
      result: {
        id: "F",
        name: "Token-Driven Trajectory Rendering",
        passed,
        detail: passed
          ? `Decrypted token reproduced the matrix, traced ${checks.segmentCount} connected 3D segments through ${checks.pointCount} path voxels, and flattened a stable constellation glyph across Maze/Glass customization.`
          : `Trajectory verification failed: ${failures.join("; ")}.`,
        metrics: {
          "anchor count": checks.anchorCount,
          "path voxels": checks.pointCount,
          segments: checks.segmentCount,
          "3D trace hash": trajectory.signature,
          "constellation hash": trajectory.constellationSignature,
          "token matrix": signatureStable ? "MATCH" : "MISMATCH",
          "style independent": styleStable ? "YES" : "NO",
        },
        durationMs: now() - started,
      },
      trajectory,
    };
  } catch (error) {
    return {
      result: {
        id: "F",
        name: "Token-Driven Trajectory Rendering",
        passed: false,
        detail: error instanceof Error ? error.message : "Trajectory verification crashed.",
        metrics: {},
        durationMs: now() - started,
      },
      trajectory: null,
    };
  }
}

export async function runAllVerification(): Promise<VerificationRun> {
  const resultE = await runTestE();
  const { result: resultF, trajectory } = await runTestF();
  return {
    results: [resultE, resultF],
    trajectory,
    passed: resultE.passed && resultF.passed,
  };
}
