import * as ed from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToBase64Url, base64UrlToBytes } from "./crypto";

const DEVICE_KEY = "scm-issuer-key-v1";
const PROJECT_KEY = "scm-project-key-v1";

export type ProvenanceKeyType = "device" | "project";

export interface ProvenanceRecord {
  v: 1;
  algorithm: "Ed25519";
  keyType: ProvenanceKeyType;
  issuerName: string;
  publicKey: string;
  shapeId: string;
  tokenId: string;
  packageHash: string;
  createdAt: string;
  message: string;
  signature: string;
}

function hex(bytes: Uint8Array): string {
  return ed.etc.bytesToHex(bytes);
}

function fromHex(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(ed.etc.hexToBytes(value));
}

function readKey(storageKey: string): Uint8Array<ArrayBuffer> | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? base64UrlToBytes(value) : null;
  } catch {
    return null;
  }
}

function writeKey(storageKey: string, key: Uint8Array<ArrayBuffer>): void {
  try {
    window.localStorage.setItem(storageKey, bytesToBase64Url(key));
  } catch {
    return;
  }
}

export function getDeviceSecretKey(): Uint8Array<ArrayBuffer> {
  const existing = readKey(DEVICE_KEY);
  if (existing) {
    return existing;
  }
  const key = new Uint8Array(ed.utils.randomPrivateKey());
  writeKey(DEVICE_KEY, key);
  return key;
}

export async function getDevicePublicKey(): Promise<string> {
  return hex(await ed.getPublicKeyAsync(getDeviceSecretKey()));
}

export function getProjectSecretKey(): Uint8Array<ArrayBuffer> | null {
  return readKey(PROJECT_KEY);
}

export function clearProjectSecretKey(): void {
  try {
    window.localStorage.removeItem(PROJECT_KEY);
  } catch {
    return;
  }
}

export async function importProjectSecretKey(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Paste a project Ed25519 secret key.");
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = trimmed.length === 64 && /^[0-9a-f]+$/i.test(trimmed)
      ? fromHex(trimmed)
      : base64UrlToBytes(trimmed);
  } catch {
    throw new Error("Project key is not valid hex or base64url.");
  }
  if (bytes.length !== 32) {
    throw new Error("Project Ed25519 secret key must be 32 bytes.");
  }
  writeKey(PROJECT_KEY, bytes);
  return hex(await ed.getPublicKeyAsync(bytes));
}

export async function sha256BlobHex(blob: Blob): Promise<string> {
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
  return hex(hasher.digest());
}

function canonicalMessage(record: Omit<ProvenanceRecord, "message" | "signature">): string {
  return [
    "SCM-PROVENANCE-v1",
    record.keyType,
    record.issuerName,
    record.publicKey,
    record.shapeId,
    record.tokenId,
    record.packageHash,
    record.createdAt,
  ].join("|");
}

export async function createProvenanceRecord(options: {
  keyType: ProvenanceKeyType;
  issuerName: string;
  shapeId: string;
  tokenId: string;
  packageBlob?: Blob | null;
}): Promise<ProvenanceRecord> {
  const secret =
    options.keyType === "project"
      ? getProjectSecretKey()
      : getDeviceSecretKey();
  if (!secret) {
    throw new Error("Import a project signing key first.");
  }
  const publicKey = hex(await ed.getPublicKeyAsync(secret));
  const packageHash = options.packageBlob
    ? await sha256BlobHex(options.packageBlob)
    : sha256BlobHex(new Blob([]));
  const createdAt = new Date().toISOString();
  const base = {
    v: 1 as const,
    algorithm: "Ed25519" as const,
    keyType: options.keyType,
    issuerName: options.issuerName.trim() || "SCM issuer",
    publicKey,
    shapeId: options.shapeId,
    tokenId: options.tokenId,
    packageHash: await packageHash,
    createdAt,
  };
  const message = canonicalMessage(base);
  const signature = hex(
    await ed.signAsync(new TextEncoder().encode(message), secret),
  );
  return { ...base, message, signature };
}

export async function verifyProvenanceRecord(
  record: ProvenanceRecord,
): Promise<boolean> {
  if (
    record.v !== 1 ||
    record.algorithm !== "Ed25519" ||
    typeof record.publicKey !== "string" ||
    typeof record.signature !== "string"
  ) {
    return false;
  }
  const expected = canonicalMessage(record);
  if (record.message !== expected) {
    return false;
  }
  try {
    return await ed.verifyAsync(
      fromHex(record.signature),
      new TextEncoder().encode(record.message),
      fromHex(record.publicKey),
    );
  } catch {
    return false;
  }
}
