import type {
  PayloadKind,
  RevealedItem,
  SCMShapePayload,
  SCMMatrix,
  SCMPayloadItem,
  SCMPayloadManifest,
  SCMTokenPayload,
  Vec3,
} from "../types";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptToken,
  encryptPayload,
  getAppBaseUrl,
  sha256Hex,
} from "./crypto";
import {
  createMatrixFromSeed,
  deriveAnchors,
  matrixToPayload,
  normalizeGridSize,
  stableHash,
} from "./scm";
import { randomId } from "./rng";

export const MAX_TOTAL_PAYLOAD_BYTES = 64 * 1024 * 1024;
export const MAX_EMBEDDED_ITEM_BYTES = 2048;
export const MAX_EMBEDDED_BYTES = 4096;
export const SHAPE_TOKEN_PREFIX = "SCMS1";
export const PACKAGE_MAGIC = "SCMP1";

export interface PayloadDraftItem {
  id: string;
  kind: PayloadKind;
  name: string;
  path: string;
  mime: string;
  size: number;
  bytes: Uint8Array;
}

export interface BuildManifestResult {
  manifest: SCMPayloadManifest;
  packageDrafts: PayloadDraftItem[];
}

export interface SealArtifacts {
  matrix: SCMMatrix;
  token: string;
  shapeToken: string;
  shape: SCMShapePayload;
  manifest: SCMPayloadManifest;
  packageBlob: Blob | null;
  salt: string;
  contentRoot: string;
}

export interface UnlockVaultResult {
  ok: boolean;
  error?: string;
  needsPackage?: boolean;
  payload?: SCMTokenPayload;
  manifest?: SCMPayloadManifest;
  shape?: SCMShapePayload;
  items?: RevealedItem[];
  files?: Map<string, Uint8Array>;
  packageLoaded?: boolean;
}

interface ArchiveEntry {
  id: string;
  kind: PayloadKind;
  name: string;
  path: string;
  mime: string;
  size: number;
  sha256: string;
  offset: number;
}

interface PackageHeader {
  v: 1;
  tokenId: string;
  shapeId: string;
  contentRoot: string;
  iv: string;
  archiveSize: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function randomSalt(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export function detectKindFromFile(file: File): PayloadKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("text/")) return "text";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "txt" || extension === "md" || extension === "csv") {
    return "text";
  }
  return "document";
}

export async function draftFromFile(file: File): Promise<PayloadDraftItem> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const relativePath =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return {
    id: randomId("item"),
    kind: detectKindFromFile(file),
    name: file.name,
    path: relativePath,
    mime: file.type || "application/octet-stream",
    size: bytes.byteLength,
    bytes,
  };
}

export function createTextDraft(text: string, name = "message.txt"): PayloadDraftItem {
  const bytes = textEncoder.encode(text);
  return {
    id: randomId("item"),
    kind: "text",
    name,
    path: name,
    mime: "text/plain",
    size: bytes.byteLength,
    bytes,
  };
}

export function canonicalItem(item: SCMPayloadItem) {
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    path: item.path,
    mime: item.mime,
    size: item.size,
    sha256: item.sha256,
    mode: item.mode,
  };
}

export async function computeContentRoot(items: SCMPayloadItem[]): Promise<string> {
  const canonical = items
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id))
    .map(canonicalItem);
  return sha256Hex(textEncoder.encode(JSON.stringify(canonical)));
}

export async function buildManifest(
  drafts: PayloadDraftItem[],
): Promise<BuildManifestResult> {
  const totalSize = drafts.reduce((sum, draft) => sum + draft.size, 0);
  if (totalSize > MAX_TOTAL_PAYLOAD_BYTES) {
    throw new Error(
      `Payload totals ${(totalSize / (1024 * 1024)).toFixed(1)} MB, above the 64 MB limit.`,
    );
  }
  const sorted = drafts
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
  let embeddedSize = 0;
  let packageSize = 0;
  const items: SCMPayloadItem[] = [];
  const packageDrafts: PayloadDraftItem[] = [];

  for (const draft of sorted) {
    const sha256 = await sha256Hex(draft.bytes);
    const canEmbed =
      draft.kind === "text" &&
      draft.size <= MAX_EMBEDDED_ITEM_BYTES &&
      embeddedSize + draft.size <= MAX_EMBEDDED_BYTES;
    if (canEmbed) {
      embeddedSize += draft.size;
      items.push({
        id: draft.id,
        kind: draft.kind,
        name: draft.name,
        path: draft.path,
        mime: draft.mime,
        size: draft.size,
        sha256,
        mode: "embedded",
        data: bytesToBase64Url(draft.bytes),
      });
    } else {
      packageSize += draft.size;
      packageDrafts.push(draft);
      items.push({
        id: draft.id,
        kind: draft.kind,
        name: draft.name,
        path: draft.path,
        mime: draft.mime,
        size: draft.size,
        sha256,
        mode: "package",
      });
    }
  }

  const contentRoot = await computeContentRoot(items);
  return {
    manifest: {
      v: 1,
      items,
      totalSize,
      embeddedSize,
      packageSize,
      contentRoot,
    },
    packageDrafts,
  };
}

export async function deriveSeedFromContent(
  salt: string,
  contentRoot: string,
): Promise<number> {
  const digest = await sha256Hex(
    textEncoder.encode(`scm-seed-v2:${salt}:${contentRoot}`),
  );
  return Number.parseInt(digest.slice(0, 8), 16) >>> 0;
}

export async function deriveMatrixId(
  salt: string,
  contentRoot: string,
  gridSize: number,
): Promise<string> {
  const digest = await sha256Hex(
    textEncoder.encode(`scm-id-v2:${salt}:${contentRoot}:${gridSize}`),
  );
  return `scm_${digest.slice(0, 12)}`;
}

export function shapeIdFor(
  id: string,
  seed: number,
  anchors: Vec3[],
  gridSize: number,
): string {
  return stableHash([
    "scm-shape-v2",
    id,
    seed,
    gridSize,
    ...anchors.flat(),
  ]);
}

export function createShapePayload(matrix: SCMMatrix): SCMShapePayload {
  const anchors = matrix.anchors.map((anchor) => [...anchor.coord] as Vec3);
  return {
    v: 1,
    kind: "shape",
    id: matrix.id,
    seed: matrix.seed,
    label: matrix.label,
    createdAt: matrix.createdAt,
    gridSize: matrix.gridSize,
    anchors,
    shapeId: shapeIdFor(matrix.id, matrix.seed, anchors, matrix.gridSize),
  };
}

export function shapeFromPrivateToken(payload: SCMTokenPayload): SCMShapePayload {
  const anchors = payload.anchors.map((anchor) => [...anchor] as Vec3);
  const gridSize = normalizeGridSize(payload.gridSize ?? 9);
  return {
    v: 1,
    kind: "shape",
    id: payload.id,
    seed: payload.seed,
    label: payload.label,
    createdAt: payload.createdAt,
    gridSize,
    anchors,
    shapeId: shapeIdFor(payload.id, payload.seed, anchors, gridSize),
  };
}

export function encodeShapeToken(shape: SCMShapePayload): string {
  return `${SHAPE_TOKEN_PREFIX}.${bytesToBase64Url(
    textEncoder.encode(JSON.stringify(shape)),
  )}`;
}

export function decodeShapeToken(token: string): SCMShapePayload {
  const trimmed = token.trim();
  if (!trimmed.startsWith(`${SHAPE_TOKEN_PREFIX}.`)) {
    throw new Error("This is not an SCM shape token.");
  }
  let parsed: SCMShapePayload;
  try {
    parsed = JSON.parse(
      textDecoder.decode(base64UrlToBytes(trimmed.slice(SHAPE_TOKEN_PREFIX.length + 1))),
    ) as SCMShapePayload;
  } catch {
    throw new Error("SCM shape token is malformed.");
  }
  if (
    parsed.v !== 1 ||
    parsed.kind !== "shape" ||
    typeof parsed.id !== "string" ||
    typeof parsed.seed !== "number" ||
    typeof parsed.gridSize !== "number" ||
    !Array.isArray(parsed.anchors) ||
    parsed.anchors.length !== 3
  ) {
    throw new Error("SCM shape token is incomplete.");
  }
  parsed.gridSize = normalizeGridSize(parsed.gridSize);
  for (const anchor of parsed.anchors) {
    if (
      !Array.isArray(anchor) ||
      anchor.length !== 3 ||
      anchor.some(
        (value) =>
          !Number.isInteger(value) || value < 0 || value >= parsed.gridSize,
      )
    ) {
      throw new Error("SCM shape token has an invalid anchor.");
    }
  }
  const expected = shapeIdFor(
    parsed.id,
    parsed.seed >>> 0,
    parsed.anchors.map((anchor) => [...anchor] as Vec3),
    parsed.gridSize,
  );
  if (parsed.shapeId !== expected) {
    throw new Error("SCM shape token integrity check failed.");
  }
  return {
    ...parsed,
    seed: parsed.seed >>> 0,
    anchors: parsed.anchors.map((anchor) => [...anchor] as Vec3),
    shapeId: expected,
  };
}

export function buildGuestLink(shapeToken: string, baseUrl = getAppBaseUrl()): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("shape", shapeToken);
  return url.toString();
}

export function readShapeFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("shape");
}

export function matrixFromShape(shape: SCMShapePayload): SCMMatrix {
  return createMatrixFromSeed(
    shape.seed,
    {
      id: shape.id,
      label: shape.label,
      createdAt: shape.createdAt,
    },
    shape.anchors,
    shape.gridSize,
  );
}

export function privatePayloadFor(
  matrix: SCMMatrix,
  shape: SCMShapePayload,
  salt: string,
  contentRoot: string,
  manifest: SCMPayloadManifest,
): SCMTokenPayload {
  return matrixToPayload(matrix, null, {
    shapeId: shape.shapeId,
    salt,
    contentRoot,
    manifest,
  });
}

export async function createEmptyVault(matrix: SCMMatrix): Promise<{
  token: string;
  shapeToken: string;
  shape: SCMShapePayload;
  manifest: SCMPayloadManifest;
}> {
  const shape = createShapePayload(matrix);
  const salt = randomSalt();
  const contentRoot = await computeContentRoot([]);
  const manifest: SCMPayloadManifest = {
    v: 1,
    items: [],
    totalSize: 0,
    embeddedSize: 0,
    packageSize: 0,
    contentRoot,
  };
  const token = await encryptPayload(
    privatePayloadFor(matrix, shape, salt, contentRoot, manifest),
  );
  return { token, shapeToken: encodeShapeToken(shape), shape, manifest };
}

async function deriveContentKey(
  salt: string,
  contentRoot: string,
): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`scm-content-v2:${salt}:${contentRoot}`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function buildPackage(
  drafts: PayloadDraftItem[],
  tokenId: string,
  shapeId: string,
  salt: string,
  contentRoot: string,
): Promise<Blob> {
  const sorted = drafts
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
  const entries: ArchiveEntry[] = [];
  let offset = 0;
  for (const draft of sorted) {
    entries.push({
      id: draft.id,
      kind: draft.kind,
      name: draft.name,
      path: draft.path,
      mime: draft.mime,
      size: draft.size,
      sha256: await sha256Hex(draft.bytes),
      offset,
    });
    offset += draft.size;
  }
  const archiveHeader = textEncoder.encode(JSON.stringify(entries));
  const archive = new Uint8Array(4 + archiveHeader.length + offset);
  new DataView(archive.buffer).setUint32(0, archiveHeader.length, true);
  archive.set(archiveHeader, 4);
  let cursor = 4 + archiveHeader.length;
  for (const draft of sorted) {
    archive.set(draft.bytes, cursor);
    cursor += draft.size;
  }
  const key = await deriveContentKey(salt, contentRoot);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    archive,
  );
  const header: PackageHeader = {
    v: 1,
    tokenId,
    shapeId,
    contentRoot,
    iv: bytesToBase64Url(iv),
    archiveSize: archive.byteLength,
  };
  const headerBytes = textEncoder.encode(JSON.stringify(header));
  const magic = textEncoder.encode(PACKAGE_MAGIC);
  const output = new Uint8Array(
    9 + headerBytes.length + new Uint8Array(cipher).length,
  );
  output.set(magic, 0);
  new DataView(output.buffer).setUint32(5, headerBytes.length, true);
  output.set(headerBytes, 9);
  output.set(new Uint8Array(cipher), 9 + headerBytes.length);
  return new Blob([output], { type: "application/x-scm-package" });
}

export async function parsePackage(
  input: Blob | ArrayBuffer,
  salt: string,
  contentRoot: string,
  tokenId: string,
  shapeId: string,
): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  const buffer = input instanceof Blob ? await input.arrayBuffer() : input;
  const raw = new Uint8Array(buffer);
  if (raw.length < 9 || textDecoder.decode(raw.subarray(0, 5)) !== PACKAGE_MAGIC) {
    throw new Error("This is not an SCMP1 encrypted package.");
  }
  const headerLength = new DataView(raw.buffer).getUint32(5, true);
  if (headerLength <= 0 || 9 + headerLength > raw.length) {
    throw new Error("SCM package header is corrupt.");
  }
  let header: PackageHeader;
  try {
    header = JSON.parse(
      textDecoder.decode(raw.subarray(9, 9 + headerLength)),
    ) as PackageHeader;
  } catch {
    throw new Error("SCM package header is invalid.");
  }
  if (
    header.v !== 1 ||
    header.tokenId !== tokenId ||
    header.shapeId !== shapeId ||
    header.contentRoot !== contentRoot
  ) {
    throw new Error("SCM package does not belong to this token.");
  }
  const cipher = raw.slice(9 + headerLength);
  const key = await deriveContentKey(salt, contentRoot);
  let archiveBytes: ArrayBuffer;
  try {
    archiveBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(header.iv) },
      key,
      cipher,
    );
  } catch {
    throw new Error("SCM package authentication failed.");
  }
  const archive = new Uint8Array(archiveBytes);
  if (archive.length < 4) {
    throw new Error("SCM package archive is empty.");
  }
  const manifestLength = new DataView(archive.buffer).getUint32(0, true);
  if (4 + manifestLength > archive.length) {
    throw new Error("SCM package archive manifest is corrupt.");
  }
  let entries: ArchiveEntry[];
  try {
    entries = JSON.parse(
      textDecoder.decode(archive.subarray(4, 4 + manifestLength)),
    ) as ArchiveEntry[];
  } catch {
    throw new Error("SCM package archive manifest is invalid.");
  }
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const entry of entries) {
    const start = 4 + manifestLength + entry.offset;
    const end = start + entry.size;
    if (end > archive.length) {
      throw new Error(`Package entry ${entry.name} is truncated.`);
    }
    files.set(entry.id, archive.slice(start, end));
  }
  return files;
}

export async function sealVault(
  drafts: PayloadDraftItem[],
  label: string,
  gridSizeInput = 9,
): Promise<SealArtifacts> {
  if (drafts.length === 0) {
    throw new Error("Add at least one text or file item before sealing.");
  }
  const { manifest, packageDrafts } = await buildManifest(drafts);
  const salt = randomSalt();
  const gridSize = normalizeGridSize(gridSizeInput);
  const seed = await deriveSeedFromContent(salt, manifest.contentRoot);
  const id = await deriveMatrixId(salt, manifest.contentRoot, gridSize);
  const createdAt = new Date().toISOString();
  const anchors = deriveAnchors(seed, gridSize).map(
    (anchor) => [...anchor.coord] as Vec3,
  );
  const matrix = createMatrixFromSeed(
    seed,
    { id, label: label.trim() || "Sealed SCM", createdAt },
    anchors,
    gridSize,
  );
  const shape = createShapePayload(matrix);
  const payload = privatePayloadFor(
    matrix,
    shape,
    salt,
    manifest.contentRoot,
    manifest,
  );
  const token = await encryptPayload(payload);
  const packageBlob =
    packageDrafts.length > 0
      ? await buildPackage(
          packageDrafts,
          matrix.id,
          shape.shapeId,
          salt,
          manifest.contentRoot,
        )
      : null;
  return {
    matrix,
    token,
    shapeToken: encodeShapeToken(shape),
    shape,
    manifest,
    packageBlob,
    salt,
    contentRoot: manifest.contentRoot,
  };
}

async function manifestFromLegacy(payload: SCMTokenPayload): Promise<SCMPayloadManifest> {
  if (!payload.payload) {
    const contentRoot = await computeContentRoot([]);
    return {
      v: 1,
      items: [],
      totalSize: 0,
      embeddedSize: 0,
      packageSize: 0,
      contentRoot,
    };
  }
  const legacy = payload.payload;
  const mode = legacy.mode === "embedded" ? "embedded" : "package";
  const item: SCMPayloadItem = {
    id: "legacy-payload",
    kind: legacy.kind,
    name: legacy.name,
    path: legacy.name,
    mime: legacy.mime,
    size: legacy.size,
    sha256: legacy.sha256,
    mode,
    ...(legacy.data ? { data: legacy.data } : {}),
  };
  return {
    v: 1,
    items: [item],
    totalSize: legacy.size,
    embeddedSize: mode === "embedded" ? legacy.size : 0,
    packageSize: mode === "package" ? legacy.size : 0,
    contentRoot: await computeContentRoot([item]),
  };
}

export async function unlockVault(options: {
  token: string;
  expectedShape?: SCMShapePayload | null;
  packageInput?: Blob | null;
  storedPackage?: Blob | null;
}): Promise<UnlockVaultResult> {
  try {
    const payload = await decryptToken(options.token);
    const shape = shapeFromPrivateToken(payload);
    if (options.expectedShape) {
      const expected = options.expectedShape;
      if (
        shape.id !== expected.id ||
        shape.seed !== expected.seed ||
        shape.gridSize !== expected.gridSize ||
        shape.shapeId !== expected.shapeId ||
        JSON.stringify(shape.anchors) !== JSON.stringify(expected.anchors)
      ) {
        return {
          ok: false,
          error: "This ID token does not belong to the loaded SCM shape.",
        };
      }
    }
    const manifest = payload.manifest ?? (await manifestFromLegacy(payload));
    const packageItems = manifest.items.filter((item) => item.mode === "package");
    const packageSource = options.packageInput ?? options.storedPackage ?? null;
    if (packageItems.length > 0 && !packageSource) {
      return {
        ok: true,
        needsPackage: true,
        payload,
        manifest,
        shape,
        error: `This SCM contains ${packageItems.length} encrypted file item(s). Load the matching .scm package to reveal them.`,
      };
    }
    let files: Map<string, Uint8Array<ArrayBuffer>> | undefined;
    if (packageSource) {
      if (!payload.salt || !payload.contentRoot) {
        return { ok: false, error: "This token predates the package format." };
      }
      files = await parsePackage(
        packageSource,
        payload.salt,
        payload.contentRoot,
        payload.id,
        shape.shapeId,
      );
    }
    const items: RevealedItem[] = [];
    for (const item of manifest.items) {
      let bytes: Uint8Array;
      if (item.mode === "embedded") {
        if (!item.data) {
          return { ok: false, error: `Embedded item ${item.name} is missing data.` };
        }
        bytes = base64UrlToBytes(item.data);
      } else {
        const fileBytes = files?.get(item.id);
        if (!fileBytes) {
          return { ok: false, error: `Package item ${item.name} is missing.` };
        }
        bytes = fileBytes;
      }
      if (bytes.byteLength !== item.size) {
        return { ok: false, error: `Size mismatch for ${item.name}.` };
      }
      const hash = await sha256Hex(bytes);
      if (hash !== item.sha256) {
        return { ok: false, error: `Integrity check failed for ${item.name}.` };
      }
      items.push({
        ...item,
        blob: new Blob([copyBytes(bytes)], { type: item.mime }),
      });
    }
    return {
      ok: true,
      payload,
      manifest,
      shape,
      items,
      files,
      packageLoaded: packageItems.length === 0 ? false : Boolean(packageSource),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to unlock this SCM.",
    };
  }
}

export function draftsFromUnlocked(
  manifest: SCMPayloadManifest,
  files?: Map<string, Uint8Array>,
): PayloadDraftItem[] {
  const drafts: PayloadDraftItem[] = [];
  for (const item of manifest.items) {
    let bytes: Uint8Array | undefined;
    if (item.mode === "embedded" && item.data) {
      bytes = base64UrlToBytes(item.data);
    } else if (files) {
      bytes = files.get(item.id);
    }
    if (!bytes) {
      continue;
    }
    drafts.push({
      id: item.id,
      kind: item.kind,
      name: item.name,
      path: item.path,
      mime: item.mime,
      size: item.size,
      bytes,
    });
  }
  return drafts;
}
