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
  autoGridSizeForBytes,
  bitstreamSignature,
  capacityForGridSize,
  createBlankMatrix,
  createMatrixFromSeed,
  indexToCoord,
  matrixFromPayload,
  matrixToPayload,
  matrixSignature,
} from "./scm";
import { buildTrajectory, manhattanAdjacent, validateTrajectory } from "./trajectory";
import {
  buildGuestLink,
  decodeShapeToken,
  matrixFromShape,
  sealVault,
  unlockVault,
  type PayloadDraftItem,
} from "./vault";
import { resolveExplosionType } from "./reveal";
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
    const coords = matrix.path.map((index) => indexToCoord(index, matrix.gridSize));
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
    const coord = indexToCoord(index, matrix.gridSize);
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
    expect(result.metrics["variants tested"]).toBe(57);
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

describe("Phase 6 sealed multi-item vault", () => {
  const textDraft = (text: string, name: string): PayloadDraftItem => ({
    id: `text-${name}`,
    kind: "text",
    name,
    path: name,
    mime: "text/plain",
    size: new TextEncoder().encode(text).byteLength,
    bytes: new TextEncoder().encode(text),
  });

  const binaryDraft = (name: string, kind: "image" | "document", data: string): PayloadDraftItem => {
    const bytes = new TextEncoder().encode(data);
    return {
      id: `bin-${name}`,
      kind,
      name,
      path: `folder/${name}`,
      mime: kind === "image" ? "image/png" : "application/pdf",
      size: bytes.byteLength,
      bytes,
    };
  };

  it("seals text, image, and document items into one content-derived shape", async () => {
    const drafts = [
      textDraft("the vault phrase is amber-nine", "note.txt"),
      binaryDraft("image.png", "image", "fake image bytes"),
      binaryDraft("document.pdf", "document", "fake pdf bytes"),
    ];
    const artifacts = await sealVault(drafts, "Multi Item Test");
    expect(artifacts.matrix.label).toBe("Multi Item Test");
    expect(artifacts.manifest.items).toHaveLength(3);
    expect(artifacts.manifest.items.find((item) => item.kind === "text")?.mode).toBe(
      "embedded",
    );
    expect(artifacts.manifest.items.find((item) => item.kind === "image")?.mode).toBe(
      "package",
    );
    expect(artifacts.packageBlob).not.toBeNull();
    const shape = decodeShapeToken(artifacts.shapeToken);
    expect(shape.seed).toBe(artifacts.matrix.seed);
    expect(shape.shapeId).toBe(artifacts.shape.shapeId);
    const link = buildGuestLink(artifacts.shapeToken, "https://example.com/app/");
    expect(new URL(link).searchParams.get("shape")).toBe(artifacts.shapeToken);
  });

  it("unlocks embedded text with the token alone and files with the package", async () => {
    const drafts = [
      textDraft("token-only secret", "secret.txt"),
      binaryDraft("photo.png", "image", "image payload"),
    ];
    const artifacts = await sealVault(drafts, "Unlock Test");
    const tokenOnly = await unlockVault({
      token: artifacts.token,
      expectedShape: artifacts.shape,
    });
    expect(tokenOnly.ok).toBe(true);
    expect(tokenOnly.needsPackage).toBe(true);

    const full = await unlockVault({
      token: artifacts.token,
      expectedShape: artifacts.shape,
      packageInput: artifacts.packageBlob,
    });
    expect(full.ok).toBe(true);
    expect(full.needsPackage).toBeFalsy();
    expect(full.items).toHaveLength(2);
    const textItem = full.items?.find((item) => item.kind === "text");
    expect(await textItem?.blob?.text()).toBe("token-only secret");
    const imageItem = full.items?.find((item) => item.kind === "image");
    expect(new TextDecoder().decode(await imageItem?.blob?.arrayBuffer())).toBe(
      "image payload",
    );
  });

  it("reshapes the matrix and token when content changes", async () => {
    const first = await sealVault([textDraft("first note", "one.txt")], "First");
    const second = await sealVault([textDraft("second note", "two.txt")], "Second");
    expect(first.matrix.id).not.toBe(second.matrix.id);
    expect(first.matrix.seed).not.toBe(second.matrix.seed);
    expect(first.token).not.toBe(second.token);
    expect(first.shape.shapeId).not.toBe(second.shape.shapeId);
  });

  it("rejects a private token from a different guest shape", async () => {
    const first = await sealVault([textDraft("first", "one.txt")], "First");
    const second = await sealVault([textDraft("second", "two.txt")], "Second");
    const mismatch = await unlockVault({
      token: first.token,
      expectedShape: second.shape,
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.error).toContain("does not belong");
  });

  it("keeps a previous token valid after re-sealing a new version", async () => {
    const first = await sealVault([textDraft("old secret", "old.txt")], "Old Version");
    const second = await sealVault([textDraft("new secret", "new.txt")], "New Version");
    const oldUnlock = await unlockVault({
      token: first.token,
      expectedShape: first.shape,
    });
    expect(oldUnlock.ok).toBe(true);
    const oldText = oldUnlock.items?.find((item) => item.kind === "text");
    expect(await oldText?.blob?.text()).toBe("old secret");
    expect(second.token).not.toBe(first.token);
  });
});

describe("Phase 7 scalable lattice", () => {
  it("supports 3� through 21� matrices", () => {
    for (const gridSize of [3, 6, 9, 12, 15, 18, 21]) {
      const scaled = createMatrixFromSeed(SEED, META, undefined, gridSize);
      expect(scaled.gridSize).toBe(gridSize);
      expect(scaled.voxelCount).toBe(gridSize ** 3);
      expect(scaled.bits.length).toBe(gridSize ** 3);
      expect(scaled.order.length).toBe(gridSize ** 3);
      expect(scaled.anchors.every((anchor) => anchor.coord.every((c) => c < gridSize))).toBe(true);
      expect(scaled.path.length).toBeGreaterThan(0);
    }
  });

  it("seals a 21� matrix and emits 21�21 face maps", async () => {
    const artifacts = await sealVault(
      [
        {
          id: "scaled-text",
          kind: "text",
          name: "large.txt",
          path: "large.txt",
          mime: "text/plain",
          size: 9,
          bytes: new TextEncoder().encode("scaled 21"),
        },
      ],
      "Scaled 21",
      21,
    );
    expect(artifacts.matrix.gridSize).toBe(21);
    expect(artifacts.matrix.voxelCount).toBe(21 ** 3);
    const unlocked = await unlockVault({
      token: artifacts.token,
      expectedShape: artifacts.shape,
    });
    expect(unlocked.ok).toBe(true);
    const text = unlocked.items?.find((item) => item.kind === "text");
    expect(await text?.blob?.text()).toBe("scaled 21");
    const faces = buildAllFaceMaps(artifacts.matrix, DEFAULT_DESIGN);
    expect(faces[0].gridSize).toBe(21);
    expect(faces[0].cells).toHaveLength(21 ** 2);
    expect(faceMapSvg(faces[0])).toContain("MATRIX");
  });
});

describe("Phase 8 volume fill", () => {
  const draft = (text: string): PayloadDraftItem => ({
    id: "fill-text",
    kind: "text",
    name: "fill.txt",
    path: "fill.txt",
    mime: "text/plain",
    size: new TextEncoder().encode(text).byteLength,
    bytes: new TextEncoder().encode(text),
  });

  it("starts with a blank matrix", () => {
    const blank = createBlankMatrix();
    expect(blank.activeCount).toBe(0);
    expect(blank.bits.every((bit) => bit === 0)).toBe(true);
    expect(blank.path).toHaveLength(0);
  });

  it("fills every voxel in full mode", () => {
    const full = createMatrixFromSeed(SEED, META, undefined, 9, {
      mode: "full",
    });
    expect(full.activeCount).toBe(9 ** 3);
    expect(full.bits.every((bit) => bit === 1)).toBe(true);
    expect(full.fill).toBe("full");
  });

  it("fills to a data target and reproduces it from the shape token", async () => {
    const data = createMatrixFromSeed(SEED, META, undefined, 9, {
      mode: "data",
      count: 120,
    });
    expect(data.activeCount).toBeGreaterThanOrEqual(120);
    expect(data.fill).toBe("data");
    expect(data.fillCount).toBe(data.activeCount);

    const rebuilt = createMatrixFromSeed(
      SEED,
      META,
      data.anchors.map((anchor) => anchor.coord),
      9,
      { mode: "data", count: data.fillCount },
    );
    expect(bitstreamSignature(rebuilt)).toBe(bitstreamSignature(data));

    const artifacts = await sealVault([draft("data fill note")], "Data fill", 9, "data");
    expect(artifacts.shape.fill).toBe("data");
    expect(artifacts.matrix.fill).toBe("data");
    const shape = decodeShapeToken(artifacts.shapeToken);
    expect(shape.fill).toBe("data");
    expect(shape.fillCount).toBe(artifacts.matrix.activeCount);
    const fromShape = matrixFromShape(shape);
    expect(bitstreamSignature(fromShape)).toBe(bitstreamSignature(artifacts.matrix));
    const unlocked = await unlockVault({
      token: artifacts.token,
      expectedShape: shape,
    });
    expect(unlocked.ok).toBe(true);
    const text = unlocked.items?.find((item) => item.kind === "text");
    expect(await text?.blob?.text()).toBe("data fill note");
  });
});

describe("Phase 9 capacity and reveal directives", () => {
  it("grows only after a lattice capacity is exceeded", () => {
    const small = capacityForGridSize(3);
    const medium = capacityForGridSize(6);
    expect(autoGridSizeForBytes(small)).toBe(3);
    expect(autoGridSizeForBytes(small + 1)).toBe(6);
    expect(autoGridSizeForBytes(medium)).toBe(6);
    expect(autoGridSizeForBytes(medium + 1)).toBe(9);
    expect(autoGridSizeForBytes(capacityForGridSize(21))).toBe(21);
  });

  it("carries a versioned reveal type through the shape and private token", async () => {
    const draft: PayloadDraftItem = {
      id: "reveal-text",
      kind: "text",
      name: "reveal.txt",
      path: "reveal.txt",
      mime: "text/plain",
      size: 10,
      bytes: new TextEncoder().encode("reveal me!"),
    };
    const artifacts = await sealVault([draft], "Reveal Test", 9, "full", "vortex");
    expect(artifacts.shape.reveal).toEqual({ v: 1, type: "vortex" });
    const shape = decodeShapeToken(artifacts.shapeToken);
    expect(shape.reveal).toEqual({ v: 1, type: "vortex" });
    expect(matrixFromShape(shape).reveal).toBe("vortex");
    const unlocked = await unlockVault({
      token: artifacts.token,
      expectedShape: shape,
    });
    expect(unlocked.ok).toBe(true);
    expect(unlocked.shape?.reveal).toEqual({ v: 1, type: "vortex" });
  });

  it("falls back unknown reveal types to radial", () => {
    expect(resolveExplosionType({ v: 99, type: "supernova" })).toBe("radial");
    expect(resolveExplosionType("vortex")).toBe("vortex");
  });
});

describe("Phase 10 live preview", () => {
  it("rebuilds the preview and grid tier from drafts", () => {
    const smallDraft: PayloadDraftItem = {
      id: "preview-small",
      kind: "text",
      name: "small.txt",
      path: "small.txt",
      mime: "text/plain",
      size: 32,
      bytes: new TextEncoder().encode("preview"),
    };
    useStudio.setState({
      drafts: [smallDraft],
      sealed: false,
      guestMode: false,
      gridChoice: "auto",
      fillChoice: "full",
      revealStyle: "vortex",
    });
    useStudio.getState().refreshPreview();
    const small = useStudio.getState().matrix;
    expect(small.gridSize).toBe(3);
    expect(small.reveal).toBe("vortex");
    expect(small.activeCount).toBe(3 ** 3);

    const largeDraft: PayloadDraftItem = {
      ...smallDraft,
      id: "preview-large",
      size: capacityForGridSize(3) + 1,
    };
    useStudio.setState({ drafts: [largeDraft] });
    useStudio.getState().refreshPreview();
    expect(useStudio.getState().matrix.gridSize).toBe(6);
  });
});
