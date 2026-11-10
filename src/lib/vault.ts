import type {
  ExplosionType,
  FillMode,
  PayloadKind,
  RevealedItem,
  RevealDirective,
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
import { sha256 } from "@noble/hashes/sha256";
import {
  createMatrixFromSeed,
  deriveAnchors,
  matrixToPayload,
  normalizeGridSize,
  stableHash,
} from "./scm";
import { resolveExplosionType } from "./reveal";
import { randomId } from "./rng";
import { MAX_PAYLOAD_BYTES } from "../types";

export const MAX_TOTAL_PAYLOAD_BYTES = MAX_PAYLOAD_BYTES;
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
  bytes: Uint8Array<ArrayBuffer>;
  blob?: Blob;
}

export function draftBlob(draft: PayloadDraftItem): Blob {
  return draft.blob ?? new Blob([draft.bytes]);
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const hasher = sha256.create();
  const reader = blob.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      hasher.update(value);
    }
  }
  return Array.from(hasher.digest(), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

async function sha256Draft(draft: PayloadDraftItem): Promise<string> {
  if (draft.blob) {
    return sha256Blob(draft.blob);
  }
  return sha256Hex(draft.bytes);
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
  files?: Map<string, Blob>;
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
  compression?: "gzip";
}

const PACKAGE_V2_MAGIC = "SCMP2";
const PACKAGE_CHUNK_SIZE = 4 * 1024 * 1024;

interface PackageEntryV2 {
  id: string;
  kind: PayloadKind;
  name: string;
  path: string;
  mime: string;
  size: number;
  sha256: string;
}

interface PackageHeaderV2 {
  v: 2;
  tokenId: string;
  shapeId: string;
  contentRoot: string;
  manifestIv: string;
  manifestSize: number;
  chunkSize: number;
  chunks: number[];
  compression: "gzip" | "none";
}

function uint32Bytes(value: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

async function readBlobSlice(blob: Blob, start: number, end: number): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

async function blobFromReadableStream(
  stream: ReadableStream<Uint8Array>,
  type: string,
): Promise<Blob> {
  const blob = await new Response(stream).blob();
  return new Blob([blob], { type });
}

async function gunzipBytes(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress the SCM package.");
  }
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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
  const kind = detectKindFromFile(file);
  const relativePath =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const bytes =
    kind === "text" && file.size <= MAX_EMBEDDED_ITEM_BYTES
      ? new Uint8Array(await file.arrayBuffer())
      : new Uint8Array(0);
  return {
    id: randomId("item"),
    kind,
    name: file.name,
    path: relativePath,
    mime: file.type || "application/octet-stream",
    size: file.size,
    bytes,
    blob: file,
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
      `Payload totals ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB, above the ${(
        MAX_TOTAL_PAYLOAD_BYTES /
        (1024 * 1024 * 1024)
      ).toFixed(0)} GB limit.`,
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
    const sha256 = await sha256Draft(draft);
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
  fill?: FillMode,
  fillCount?: number,
  reveal?: RevealDirective,
): string {
  return stableHash([
    "scm-shape-v2",
    id,
    seed,
    gridSize,
    ...anchors.flat(),
    ...(fill ? ["fill", fill] : []),
    ...(fill === "data" ? ["count", fillCount ?? 0] : []),
    ...(reveal ? ["reveal", reveal.v, reveal.type] : []),
  ]);
}

export function createShapePayload(matrix: SCMMatrix): SCMShapePayload {
  const anchors = matrix.anchors.map((anchor) => [...anchor.coord] as Vec3);
  const reveal: RevealDirective | undefined = matrix.reveal
    ? { v: 1, type: matrix.reveal }
    : undefined;
  return {
    v: 1,
    kind: "shape",
    id: matrix.id,
    seed: matrix.seed,
    label: matrix.label,
    createdAt: matrix.createdAt,
    gridSize: matrix.gridSize,
    anchors,
    shapeId: shapeIdFor(
      matrix.id,
      matrix.seed,
      anchors,
      matrix.gridSize,
      matrix.fill,
      matrix.fillCount,
      reveal,
    ),
    ...(matrix.fill ? { fill: matrix.fill } : {}),
    ...(matrix.fill === "data" && matrix.fillCount !== undefined
      ? { fillCount: matrix.fillCount }
      : {}),
    ...(reveal ? { reveal } : {}),
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
    shapeId: shapeIdFor(
      payload.id,
      payload.seed,
      anchors,
      gridSize,
      payload.fill,
      payload.fillCount,
      payload.reveal,
    ),
    ...(payload.fill ? { fill: payload.fill } : {}),
    ...(payload.fill === "data" && payload.fillCount !== undefined
      ? { fillCount: payload.fillCount }
      : {}),
    ...(payload.reveal ? { reveal: payload.reveal } : {}),
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
    parsed.anchors.length !== 3 ||
    (parsed.fill !== undefined &&
      parsed.fill !== "full" &&
      parsed.fill !== "data") ||
    (parsed.fillCount !== undefined &&
      (!Number.isInteger(parsed.fillCount) || parsed.fillCount < 1)) ||
    (parsed.fill === "data" && parsed.fillCount === undefined) ||
    (parsed.reveal !== undefined &&
      (typeof parsed.reveal !== "object" ||
        parsed.reveal === null ||
        typeof parsed.reveal.v !== "number" ||
        typeof parsed.reveal.type !== "string"))
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
    parsed.fill,
    parsed.fillCount,
    parsed.reveal,
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
    shape.fill
      ? { mode: shape.fill, count: shape.fillCount }
      : undefined,
    shape.reveal
      ? resolveExplosionType(shape.reveal)
      : undefined,
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

async function* readChunks(
  stream: ReadableStream<Uint8Array>,
  size: number,
): AsyncGenerator<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const pending = new Uint8Array(size);
  let pendingLength = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        let offset = 0;
        while (offset < value.length) {
          const take = Math.min(size - pendingLength, value.length - offset);
          pending.set(value.subarray(offset, offset + take), pendingLength);
          pendingLength += take;
          offset += take;
          if (pendingLength === size) {
            yield pending.slice(0, size);
            pendingLength = 0;
          }
        }
      }
      if (done) {
        if (pendingLength > 0) {
          yield pending.slice(0, pendingLength);
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function encryptChunk(
  key: CryptoKey,
  plain: Uint8Array<ArrayBuffer>,
  additionalData: Uint8Array<ArrayBuffer>,
): Promise<{ iv: Uint8Array<ArrayBuffer>; cipher: Uint8Array<ArrayBuffer> }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    plain,
  );
  return { iv, cipher: new Uint8Array(cipher) };
}

export async function buildPackage(
  drafts: PayloadDraftItem[],
  manifestItems: SCMPayloadItem[],
  tokenId: string,
  shapeId: string,
  salt: string,
  contentRoot: string,
): Promise<Blob> {
  const sorted = drafts
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
  const itemById = new Map(
    manifestItems
      .filter((item) => item.mode === "package")
      .map((item) => [item.id, item]),
  );
  const entries: PackageEntryV2[] = sorted.map((draft) => {
    const item = itemById.get(draft.id);
    if (!item) {
      throw new Error(`Package manifest is missing ${draft.path}.`);
    }
    return {
      id: item.id,
      kind: item.kind,
      name: item.name,
      path: item.path,
      mime: item.mime,
      size: item.size,
      sha256: item.sha256,
    };
  });

  const key = await deriveContentKey(salt, contentRoot);
  const compression =
    typeof CompressionStream === "undefined" ? "none" : "gzip";
  const chunkParts: BlobPart[] = [];
  const chunks: number[] = [];

  for (const draft of sorted) {
    let source: ReadableStream<Uint8Array> = draftBlob(draft).stream();
    if (compression === "gzip") {
      source = source.pipeThrough(
        new CompressionStream(
          "gzip",
        ) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
      );
    }
    let chunkIndex = 0;
    for await (const plain of readChunks(source, PACKAGE_CHUNK_SIZE)) {
      const aad = textEncoder.encode(
        `${PACKAGE_V2_MAGIC}:${tokenId}:${draft.id}:${chunkIndex}`,
      );
      const { iv, cipher } = await encryptChunk(key, plain, aad);
      const part = new Uint8Array(4 + 12 + cipher.byteLength);
      new DataView(part.buffer).setUint32(0, cipher.byteLength, true);
      part.set(iv, 4);
      part.set(cipher, 16);
      chunkParts.push(new Blob([part]));
      chunkIndex += 1;
    }
    chunks.push(chunkIndex);
  }

  const manifestBytes = textEncoder.encode(JSON.stringify(entries));
  const manifestIv = crypto.getRandomValues(new Uint8Array(12));
  const manifestAad = textEncoder.encode(
    `${PACKAGE_V2_MAGIC}:manifest:${tokenId}`,
  );
  const manifestCipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: manifestIv, additionalData: manifestAad },
      key,
      manifestBytes,
    ),
  );
  const header: PackageHeaderV2 = {
    v: 2,
    tokenId,
    shapeId,
    contentRoot,
    manifestIv: bytesToBase64Url(manifestIv),
    manifestSize: manifestCipher.byteLength,
    chunkSize: PACKAGE_CHUNK_SIZE,
    chunks,
    compression,
  };
  const headerBytes = textEncoder.encode(JSON.stringify(header));
  const magic = textEncoder.encode(PACKAGE_V2_MAGIC);
  return new Blob(
    [magic, uint32Bytes(headerBytes.length), headerBytes, manifestCipher, ...chunkParts],
    { type: "application/x-scm-package" },
  );
}

async function parsePackageV1(
  blob: Blob,
  salt: string,
  contentRoot: string,
  tokenId: string,
  shapeId: string,
): Promise<Map<string, Blob>> {
  const buffer = await blob.arrayBuffer();
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
    header.contentRoot !== contentRoot ||
    (header.compression !== undefined && header.compression !== "gzip")
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
  let archive = new Uint8Array(archiveBytes);
  if (header.compression === "gzip") {
    archive = await gunzipBytes(archive);
  }
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
  const files = new Map<string, Blob>();
  for (const entry of entries) {
    const start = 4 + manifestLength + entry.offset;
    const end = start + entry.size;
    if (end > archive.length) {
      throw new Error(`Package entry ${entry.name} is truncated.`);
    }
    const bytes = archive.slice(start, end);
    if (bytes.byteLength !== entry.size) {
      throw new Error(`Size mismatch for ${entry.name}.`);
    }
    const hash = await sha256Hex(bytes);
    if (hash !== entry.sha256) {
      throw new Error(`Integrity check failed for ${entry.name}.`);
    }
    files.set(entry.id, new Blob([bytes], { type: entry.mime }));
  }
  return files;
}

async function parsePackageV2(
  blob: Blob,
  salt: string,
  contentRoot: string,
  tokenId: string,
  shapeId: string,
): Promise<Map<string, Blob>> {
  if (blob.size < 9) {
    throw new Error("SCM package is truncated.");
  }
  const headerLengthBytes = await readBlobSlice(blob, 5, 9);
  const headerLength = new DataView(headerLengthBytes.buffer).getUint32(0, true);
  if (headerLength <= 0 || 9 + headerLength > blob.size) {
    throw new Error("SCM package header is corrupt.");
  }
  let header: PackageHeaderV2;
  try {
    header = JSON.parse(
      textDecoder.decode(await readBlobSlice(blob, 9, 9 + headerLength)),
    ) as PackageHeaderV2;
  } catch {
    throw new Error("SCM package header is invalid.");
  }
  if (
    header.v !== 2 ||
    header.tokenId !== tokenId ||
    header.shapeId !== shapeId ||
    header.contentRoot !== contentRoot ||
    (header.compression !== "gzip" && header.compression !== "none") ||
    !Array.isArray(header.chunks)
  ) {
    throw new Error("SCM package does not belong to this token.");
  }

  const key = await deriveContentKey(salt, contentRoot);
  const manifestStart = 9 + headerLength;
  const manifestCipher = await readBlobSlice(
    blob,
    manifestStart,
    manifestStart + header.manifestSize,
  );
  if (manifestCipher.byteLength !== header.manifestSize) {
    throw new Error("SCM package manifest is truncated.");
  }
  let entries: PackageEntryV2[];
  try {
    const manifestAad = textEncoder.encode(
      `${PACKAGE_V2_MAGIC}:manifest:${tokenId}`,
    );
    const manifestBytes = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(header.manifestIv),
        additionalData: manifestAad,
      },
      key,
      manifestCipher,
    );
    entries = JSON.parse(
      textDecoder.decode(new Uint8Array(manifestBytes)),
    ) as PackageEntryV2[];
  } catch {
    throw new Error("SCM package manifest authentication failed.");
  }
  if (entries.length !== header.chunks.length) {
    throw new Error("SCM package chunk table is corrupt.");
  }

  const files = new Map<string, Blob>();
  let cursor = manifestStart + header.manifestSize;
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    const chunkCount = header.chunks[entryIndex];
    if (!Number.isInteger(chunkCount) || chunkCount < 0) {
      throw new Error("SCM package chunk table is corrupt.");
    }
    if (chunkCount === 0) {
      const empty = new Blob([], { type: entry.mime });
      if (empty.size !== entry.size || entries[entryIndex].size !== 0) {
        throw new Error(`Size mismatch for ${entry.name}.`);
      }
      files.set(entry.id, empty);
      continue;
    }

    let chunkIndex = 0;
    let chunkCursor = cursor;
    const compressedStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (chunkIndex >= chunkCount) {
          controller.close();
          return;
        }
        try {
          const lengthBytes = await readBlobSlice(
            blob,
            chunkCursor,
            chunkCursor + 4,
          );
          const cipherLength = new DataView(lengthBytes.buffer).getUint32(
            0,
            true,
          );
          if (
            cipherLength < 16 ||
            cipherLength > header.chunkSize + 64
          ) {
            throw new Error("SCM package chunk is corrupt.");
          }
          const iv = await readBlobSlice(blob, chunkCursor + 4, chunkCursor + 16);
          const cipher = await readBlobSlice(
            blob,
            chunkCursor + 16,
            chunkCursor + 16 + cipherLength,
          );
          if (cipher.byteLength !== cipherLength) {
            throw new Error("SCM package chunk is truncated.");
          }
          chunkCursor += 16 + cipherLength;
          const aad = textEncoder.encode(
            `${PACKAGE_V2_MAGIC}:${tokenId}:${entry.id}:${chunkIndex}`,
          );
          const plain = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv, additionalData: aad },
            key,
            cipher,
          );
          chunkIndex += 1;
          controller.enqueue(new Uint8Array(plain));
        } catch (error) {
          controller.error(error);
        }
      },
    });

    const fileStream =
      header.compression === "gzip"
        ? compressedStream.pipeThrough(
            new DecompressionStream(
              "gzip",
            ) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
          )
        : compressedStream;
    const fileBlob = await blobFromReadableStream(fileStream, entry.mime);
    cursor = chunkCursor;
    if (fileBlob.size !== entry.size) {
      throw new Error(`Size mismatch for ${entry.name}.`);
    }
    const hash = await sha256Blob(fileBlob);
    if (hash !== entry.sha256) {
      throw new Error(`Integrity check failed for ${entry.name}.`);
    }
    files.set(entry.id, fileBlob);
  }
  return files;
}

export async function parsePackage(
  input: Blob | ArrayBuffer,
  salt: string,
  contentRoot: string,
  tokenId: string,
  shapeId: string,
): Promise<Map<string, Blob>> {
  const blob = input instanceof Blob ? input : new Blob([input]);
  const magic = textDecoder.decode(await readBlobSlice(blob, 0, 5));
  if (magic === PACKAGE_V2_MAGIC) {
    return parsePackageV2(blob, salt, contentRoot, tokenId, shapeId);
  }
  if (magic === PACKAGE_MAGIC) {
    return parsePackageV1(blob, salt, contentRoot, tokenId, shapeId);
  }
  throw new Error("This is not an SCM package.");
}

export async function sealVault(
  drafts: PayloadDraftItem[],
  label: string,
  gridSizeInput = 9,
  fillMode: FillMode = "full",
  revealType: ExplosionType = "radial",
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
  const dataCount = Math.min(
    gridSize ** 3,
    Math.max(1, manifest.totalSize),
  );
  const matrix = createMatrixFromSeed(
    seed,
    { id, label: label.trim() || "Sealed SCM", createdAt },
    anchors,
    gridSize,
    { mode: fillMode, count: fillMode === "data" ? dataCount : undefined },
    revealType,
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
          manifest.items,
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
    let files: Map<string, Blob> | undefined;
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
      let blob: Blob;
      if (item.mode === "embedded") {
        if (!item.data) {
          return { ok: false, error: `Embedded item ${item.name} is missing data.` };
        }
        blob = new Blob([base64UrlToBytes(item.data)], { type: item.mime });
      } else {
        const fileBlob = files?.get(item.id);
        if (!fileBlob) {
          return { ok: false, error: `Package item ${item.name} is missing.` };
        }
        blob = fileBlob;
      }
      if (blob.size !== item.size) {
        return { ok: false, error: `Size mismatch for ${item.name}.` };
      }
      const hash = await sha256Blob(blob);
      if (hash !== item.sha256) {
        return { ok: false, error: `Integrity check failed for ${item.name}.` };
      }
      items.push({ ...item, blob });
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
  files?: Map<string, Blob>,
): PayloadDraftItem[] {
  const drafts: PayloadDraftItem[] = [];
  for (const item of manifest.items) {
    if (item.mode === "embedded" && item.data) {
      drafts.push({
        id: item.id,
        kind: item.kind,
        name: item.name,
        path: item.path,
        mime: item.mime,
        size: item.size,
        bytes: base64UrlToBytes(item.data),
      });
      continue;
    }
    const blob = files?.get(item.id);
    if (!blob) {
      continue;
    }
    drafts.push({
      id: item.id,
      kind: item.kind,
      name: item.name,
      path: item.path,
      mime: item.mime,
      size: item.size,
      bytes: new Uint8Array(0),
      blob,
    });
  }
  return drafts;
}
