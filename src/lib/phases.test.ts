import { beforeAll, describe, expect, it } from "vitest";
import type { SCMMatrix, SCMPayload } from "../types";
import { useStudio, DEFAULT_DESIGN } from "../store/useStudio";
import { computeVoxelAnimation } from "./animation";
import {
  buildPayloadContainer,
  bytesToBase64Url,
  decryptToken,
  embeddedPayloadBytes,
  encryptPayload,
  parsePayloadContainer,
  sha256Hex,
} from "./crypto";
import {
  bitstreamSignature,
  createMatrixFromSeed,
  indexToCoord,
  matrixFromPayload,
  matrixToPayload,
  matrixSignature,
} from "./scm";
import { buildTrajectory, manhattanAdjacent, validateTrajectory } from "./trajectory";
import { runTestE, runTestF } from "./verify";
import {
  buildModelSoup,
  estimateExport,
  exportObj,
  exportStl,
} from "./exporters/model";
import {
  FACE_DEFS,
  buildAllFaceMaps,
  buildFaceMap,
  faceMapSvg,
} from "./exporters/vector";

const SEED = 0x7a3f91c2;
const META = {
  id: "scm_test_matrix",
  label: "Test Lattice",
  createdAt: "2026-11-03T00:00:00.000Z",
};

let matrix: SCMMatrix;
let token: string;

beforeAll(async () => {
  matrix = createMatrixFromSeed(SEED, META);
  token = await encryptPayload(matrixToPayload(matrix));
  useStudio.setState({
    matrix,
    token,
    tokenStatus: "ready",
    tokenError: null,
    design: { ...DEFAULT_DESIGN },
  });
});

describe("Phase 1-2 cryptographic matrix core", () => {
  it("is deterministic for the same seed and anchors", () => {
    const rebuilt = createMatrixFromSeed(SEED, META, matrix.anchors.map((anchor) => anchor.coord));
    expect(bitstreamSignature(rebuilt)).toBe(bitstreamSignature(matrix));
    expect(rebuilt.activeCount).toBe(matrix.activeCount);
    expect(rebuilt.path).toEqual(matrix.path);
    expect(rebuilt.order).toEqual(matrix.order);
    expect(rebuilt.anchors.map((anchor) => anchor.coord)).toEqual(
      matrix.anchors.map((anchor) => anchor.coord),
    );
  });

  it("carves a connected alignment path through active voxels", () => {
    const coords = matrix.path.map(indexToCoord);
    expect(matrix.path.every((index) => matrix.bits[index] === 1)).toBe(true);
    for (let i = 0; i < coords.length - 1; i += 1) {
      expect(manhattanAdjacent(coords[i], coords[i + 1])).toBe(true);
    }
    const pathKeys = new Set(coords.map((coord) => coord.join(",")));
    for (const anchor of matrix.anchors) {
      expect(pathKeys.has(anchor.coord.join(","))).toBe(true);
    }
  });

  it("round-trips an encrypted token back into an identical matrix", async () => {
    const payload = await decryptToken(token);
    expect(payload.seed).toBe(SEED);
    expect(payload.anchors).toEqual(matrix.anchors.map((anchor) => anchor.coord));
    const rebuilt = matrixFromPayload(payload);
    expect(matrixSignature(rebuilt)).toBe(matrixSignature(matrix));
    expect(bitstreamSignature(rebuilt)).toBe(bitstreamSignature(matrix));
  });
});

describe("Phase 4 payload encryption", () => {
  it("embeds and decrypts small text inside the SCM1 token", async () => {
    const bytes = new TextEncoder().encode("recovery phrase: amber vector nine");
    const sha256 = await sha256Hex(bytes);
    const payload: SCMPayload = {
      kind: "text",
      name: "message.txt",
      mime: "text/plain",
      size: bytes.byteLength,
      sha256,
      mode: "embedded",
      data: bytesToBase64Url(bytes),
    };
    const textToken = await encryptPayload(matrixToPayload(matrix, payload));
    const decoded = await decryptToken(textToken);
    expect(decoded.payload?.mode).toBe("embedded");
    expect(decoded.payload?.sha256).toBe(sha256);
    const embedded = embeddedPayloadBytes(decoded.payload ?? null);
    expect(embedded).not.toBeNull();
    expect(new TextDecoder().decode(embedded ?? new Uint8Array())).toBe(
      "recovery phrase: amber vector nine",
    );
  });

  it("builds and verifies an encrypted .scm container", async () => {
    const bytes = new TextEncoder().encode("external file payload");
    const sha256 = await sha256Hex(bytes);
    const payload: SCMPayload = {
      kind: "document",
      name: "evidence.bin",
      mime: "application/octet-stream",
      size: bytes.byteLength,
      sha256,
      mode: "external",
    };
    const externalToken = await encryptPayload(matrixToPayload(matrix, payload));
    const container = await buildPayloadContainer(externalToken, payload, bytes);
    const parsed = await parsePayloadContainer(container);
    expect(parsed.sha256Ok).toBe(true);
    expect(parsed.header.token).toBe(externalToken);
    expect(parsed.payload.mode).toBe("external");
    expect(new TextDecoder().decode(parsed.bytes)).toBe("external file payload");
    const decoded = await decryptToken(parsed.header.token);
    expect(decoded.payload?.sha256).toBe(sha256);
  });
});

describe("Phase 4 visual engine", () => {
  it("resolves pulse, glow, scanline, and reveal animation without touching bits", () => {
    const scratch = { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, glow: 1 };
    const before = bitstreamSignature(matrix);
    const index = matrix.order[0];
    const coord = indexToCoord(index);
    const voxel = { index, x: coord[0], y: coord[1], z: coord[2] };
    const layers = [
      {
        id: "pulse",
        type: "pulse" as const,
        name: "Pulse",
        enabled: true,
        delay: 0,
        duration: 2,
        easing: "sine" as const,
        repeat: 0,
        intensity: 0.8,
        axis: "y" as const,
        mode: "slice" as const,
      },
      {
        id: "wave",
        type: "layerWave" as const,
        name: "Layer Wave",
        enabled: true,
        delay: 0,
        duration: 2,
        easing: "easeOutCubic" as const,
        repeat: 1,
        intensity: 1,
        axis: "z" as const,
        mode: "spiral" as const,
      },
    ];
    const early = computeVoxelAnimation(voxel, matrix, layers, 0.2, scratch);
    const late = computeVoxelAnimation(voxel, matrix, layers, 1.4, scratch);
    expect(Number.isFinite(early.scale)).toBe(true);
    expect(Number.isFinite(late.glow)).toBe(true);
    expect(bitstreamSignature(matrix)).toBe(before);
  });

  it("passes Test E: customization interoperability", async () => {
    const result = await runTestE();
    expect(result.passed).toBe(true);
    expect(result.metrics["variants tested"]).toBe(52);
    expect(useStudio.getState().matrix).toBe(matrix);
  });

  it("writes valid binary STL and OBJ exports from active voxels", async () => {
    const options = { includeBasePlate: true, baseThickness: 1.2, scale: 4 };
    const soup = buildModelSoup(matrix, options);
    const estimate = estimateExport(matrix, options);
    expect(soup.triangles).toBe(estimate.triangles);
    const blob = exportStl(matrix, options);
    expect(blob.size).toBe(84 + soup.triangles * 50);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(80, true)).toBe(soup.triangles);
    const obj = exportObj(matrix, options);
    expect(obj.startsWith("o SCM_Lattice")).toBe(true);
    expect(obj.split("\n").filter((line) => line.startsWith("f ")).length).toBe(
      soup.triangles,
    );
    expect(obj.split("\n").filter((line) => line.startsWith("v ")).length).toBeGreaterThan(0);
  });

  it("projects all six faces and emits high-resolution SVG maps", () => {
    const maps = buildAllFaceMaps(matrix, DEFAULT_DESIGN);
    expect(maps).toHaveLength(FACE_DEFS.length);
    for (const map of maps) {
      expect(map.cells).toHaveLength(81);
      expect(map.activeCount).toBeGreaterThan(0);
      const svg = faceMapSvg(map, 2048);
      expect(svg).toContain("<svg");
      expect(svg).toContain("SCM ·");
      expect(svg.split("<rect").length).toBeGreaterThan(80);
    }
    const front = buildFaceMap(matrix, DEFAULT_DESIGN, FACE_DEFS[0]);
    const directCount = front.cells.filter((cell) => cell.active).length;
    expect(front.activeCount).toBe(directCount);
  });

  it("passes Test F: token-driven trajectory and constellation glyph", async () => {
    const { result, trajectory } = await runTestF();
    expect(result.passed).toBe(true);
    expect(trajectory).not.toBeNull();
    if (!trajectory) {
      return;
    }
    const checks = validateTrajectory(matrix, trajectory);
    expect(checks.allPathBitsActive).toBe(true);
    expect(checks.connectedSegments).toBe(true);
    expect(checks.anchorsPresent).toBe(true);
    expect(checks.constellationInBounds).toBe(true);
    expect(trajectory.points3D.length).toBeGreaterThanOrEqual(matrix.anchors.length);
    expect(trajectory.constellation).toHaveLength(matrix.path.length);
    expect(trajectory.constellationAnchors).toHaveLength(3);
    const again = buildTrajectory(matrix);
    expect(again.signature).toBe(trajectory.signature);
    expect(again.constellationSignature).toBe(trajectory.constellationSignature);
  });
});
