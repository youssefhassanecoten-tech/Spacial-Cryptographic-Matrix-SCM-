import type {
  PayloadKind,
  SCMPayload,
  SCMPayloadItem,
  SCMPayloadManifest,
  SCMTokenPayload,
} from "../types";
import { stableHash } from "./scm";

const TOKEN_PREFIX = "SCM1";
const CONTAINER_PREFIX = "SCMC1";
const PAYLOAD_KINDS: PayloadKind[] = ["text", "image", "video", "document"];
const KEY_MATERIAL = "scm-studio::duo-system::v1::local-first-matrix::aes-gcm";

interface TokenEnvelope {
  v: 1;
  n: string;
  c: string;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const encoder = new TextEncoder();
    keyPromise = crypto.subtle
      .digest("SHA-256", encoder.encode(KEY_MATERIAL))
      .then((digest) =>
        crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
          "encrypt",
          "decrypt",
        ]),
      );
  }
  return keyPromise;
}

export async function encryptPayload(payload: SCMTokenPayload): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  const envelope: TokenEnvelope = {
    v: 1,
    n: bytesToBase64Url(iv),
    c: bytesToBase64Url(new Uint8Array(cipher)),
  };
  return `${TOKEN_PREFIX}.${bytesToBase64Url(encoder.encode(JSON.stringify(envelope)))}`;
}

function validateContent(value: unknown): SCMPayload | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object") {
    throw new Error("Token content metadata is malformed.");
  }
  const content = value as Partial<SCMPayload>;
  if (!content.kind || !PAYLOAD_KINDS.includes(content.kind)) {
    throw new Error("Token content has an unsupported data kind.");
  }
  if (typeof content.name !== "string" || content.name.length === 0 || content.name.length > 160) {
    throw new Error("Token content is missing a valid file name.");
  }
  if (typeof content.mime !== "string" || content.mime.length > 120) {
    throw new Error("Token content is missing a valid MIME type.");
  }
  if (typeof content.size !== "number" || content.size < 0) {
    throw new Error("Token content size is invalid.");
  }
  if (typeof content.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(content.sha256)) {
    throw new Error("Token content is missing an integrity hash.");
  }
  if (content.mode !== "embedded" && content.mode !== "external") {
    throw new Error("Token content mode is invalid.");
  }
  if (content.mode === "embedded" && typeof content.data !== "string") {
    throw new Error("Embedded token content is missing its payload.");
  }
  if (content.mode === "external" && content.data) {
    throw new Error("External token content cannot include inline data.");
  }
  return {
    kind: content.kind,
    name: content.name,
    mime: content.mime,
    size: content.size,
    sha256: content.sha256.toLowerCase(),
    mode: content.mode,
    ...(content.data ? { data: content.data } : {}),
  };
}

function validateManifest(value: unknown): SCMPayloadManifest | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object") {
    throw new Error("Token manifest is malformed.");
  }
  const manifest = value as Partial<SCMPayloadManifest>;
  if (manifest.v !== 1 || !Array.isArray(manifest.items)) {
    throw new Error("Token manifest has an unsupported version.");
  }
  const items: SCMPayloadItem[] = manifest.items.map((value) => {
    if (!value || typeof value !== "object") {
      throw new Error("Token manifest item is malformed.");
    }
    const item = value as Partial<SCMPayloadItem>;
    if (!item.kind || !PAYLOAD_KINDS.includes(item.kind)) {
      throw new Error("Token manifest item has an unsupported kind.");
    }
    if (
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.path !== "string" ||
      typeof item.mime !== "string" ||
      typeof item.size !== "number" ||
      typeof item.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/i.test(item.sha256)
    ) {
      throw new Error("Token manifest item is incomplete.");
    }
    if (item.mode !== "embedded" && item.mode !== "package") {
      throw new Error("Token manifest item mode is invalid.");
    }
    if (item.mode === "embedded" && typeof item.data !== "string") {
      throw new Error("Embedded manifest item is missing data.");
    }
    if (item.mode === "package" && item.data) {
      throw new Error("Packaged manifest item cannot include inline data.");
    }
    return {
      id: item.id,
      kind: item.kind,
      name: item.name,
      path: item.path,
      mime: item.mime,
      size: item.size,
      sha256: item.sha256.toLowerCase(),
      mode: item.mode,
      ...(item.data ? { data: item.data } : {}),
    };
  });
  if (
    typeof manifest.totalSize !== "number" ||
    typeof manifest.embeddedSize !== "number" ||
    typeof manifest.packageSize !== "number" ||
    typeof manifest.contentRoot !== "string" ||
    !/^[0-9a-f]{64}$/i.test(manifest.contentRoot)
  ) {
    throw new Error("Token manifest totals are invalid.");
  }
  return {
    v: 1,
    items,
    totalSize: manifest.totalSize,
    embeddedSize: manifest.embeddedSize,
    packageSize: manifest.packageSize,
    contentRoot: manifest.contentRoot.toLowerCase(),
  };
}

function validatePayload(value: unknown): SCMTokenPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Token payload is empty.");
  }
  const payload = value as Partial<SCMTokenPayload>;
  if (payload.v !== 1) {
    throw new Error("Unsupported SCM token version.");
  }
  if (typeof payload.id !== "string" || payload.id.length < 3) {
    throw new Error("Token is missing a valid matrix id.");
  }
  if (typeof payload.seed !== "number" || !Number.isFinite(payload.seed)) {
    throw new Error("Token is missing a valid PRNG seed.");
  }
  if (!Array.isArray(payload.anchors) || payload.anchors.length !== 3) {
    throw new Error("Token must contain exactly three alignment anchors.");
  }
  for (const anchor of payload.anchors) {
    if (
      !Array.isArray(anchor) ||
      anchor.length !== 3 ||
      anchor.some(
        (value) =>
          !Number.isInteger(value) || value < 0 || value > 8,
      )
    ) {
      throw new Error("Token contains an out-of-bounds anchor coordinate.");
    }
  }
  if (payload.shapeId !== undefined && typeof payload.shapeId !== "string") {
    throw new Error("Token shape commitment is invalid.");
  }
  if (payload.salt !== undefined && typeof payload.salt !== "string") {
    throw new Error("Token content salt is invalid.");
  }
  if (
    payload.contentRoot !== undefined &&
    (typeof payload.contentRoot !== "string" ||
      !/^[0-9a-f]{64}$/i.test(payload.contentRoot))
  ) {
    throw new Error("Token content root is invalid.");
  }
  return {
    v: 1,
    id: payload.id,
    seed: payload.seed >>> 0,
    label: typeof payload.label === "string" ? payload.label : "SCM Lattice",
    createdAt:
      typeof payload.createdAt === "string" ? payload.createdAt : new Date(0).toISOString(),
    anchors: payload.anchors.map((anchor) => [anchor[0], anchor[1], anchor[2]]),
    ...(payload.shapeId ? { shapeId: payload.shapeId } : {}),
    ...(payload.salt ? { salt: payload.salt } : {}),
    ...(payload.contentRoot ? { contentRoot: payload.contentRoot } : {}),
    ...(payload.manifest ? { manifest: validateManifest(payload.manifest) } : {}),
    ...(payload.payload ? { payload: validateContent(payload.payload) } : {}),
  };
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export async function encryptBytes(
  input: Uint8Array,
): Promise<{ iv: string; cipher: Uint8Array<ArrayBuffer> }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new Uint8Array(input),
  );
  return { iv: bytesToBase64Url(iv), cipher: new Uint8Array(cipher) };
}

export async function decryptBytes(
  input: Uint8Array,
  iv: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(iv) },
    key,
    new Uint8Array(input),
  );
  return new Uint8Array(plain);
}

interface ContainerHeader {
  v: 1;
  token: string;
  iv: string;
  kind: PayloadKind;
  name: string;
  mime: string;
  size: number;
  sha256: string;
}

export interface ParsedPayloadContainer {
  header: ContainerHeader;
  payload: SCMPayload;
  bytes: Uint8Array<ArrayBuffer>;
  sha256Ok: boolean;
}

export async function buildPayloadContainer(
  token: string,
  payload: SCMPayload,
  bytes: Uint8Array,
): Promise<Blob> {
  const { iv, cipher } = await encryptBytes(bytes);
  const header: ContainerHeader = {
    v: 1,
    token,
    iv,
    kind: payload.kind,
    name: payload.name,
    mime: payload.mime,
    size: payload.size,
    sha256: payload.sha256,
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const prefixBytes = new TextEncoder().encode(CONTAINER_PREFIX);
  const output = new Uint8Array(9 + headerBytes.length + cipher.length);
  output.set(prefixBytes, 0);
  new DataView(output.buffer).setUint32(5, headerBytes.length, true);
  output.set(headerBytes, 9);
  output.set(cipher, 9 + headerBytes.length);
  return new Blob([output], { type: "application/x-scm-container" });
}

export async function parsePayloadContainer(
  input: Blob | ArrayBuffer,
): Promise<ParsedPayloadContainer> {
  const buffer = input instanceof Blob ? await input.arrayBuffer() : input;
  const raw = new Uint8Array(buffer);
  if (raw.length < 9) {
    throw new Error("SCM container is too small to be valid.");
  }
  const prefix = new TextDecoder().decode(raw.subarray(0, 5));
  if (prefix !== CONTAINER_PREFIX) {
    throw new Error("This is not an SCMC1 encrypted payload container.");
  }
  const headerLength = new DataView(raw.buffer).getUint32(5, true);
  if (headerLength <= 0 || 9 + headerLength > raw.length) {
    throw new Error("SCM container header is corrupt.");
  }
  let header: ContainerHeader;
  try {
    header = JSON.parse(
      new TextDecoder().decode(raw.subarray(9, 9 + headerLength)),
    ) as ContainerHeader;
  } catch {
    throw new Error("SCM container header is not valid JSON.");
  }
  if (
    header.v !== 1 ||
    typeof header.token !== "string" ||
    typeof header.iv !== "string" ||
    typeof header.name !== "string" ||
    typeof header.mime !== "string" ||
    typeof header.size !== "number" ||
    typeof header.sha256 !== "string" ||
    !PAYLOAD_KINDS.includes(header.kind)
  ) {
    throw new Error("SCM container header is missing required fields.");
  }
  const cipher = raw.slice(9 + headerLength);
  const plain = await decryptBytes(cipher, header.iv);
  const actualHash = await sha256Hex(plain);
  return {
    header,
    payload: {
      kind: header.kind,
      name: header.name,
      mime: header.mime,
      size: header.size,
      sha256: header.sha256.toLowerCase(),
      mode: "external",
    },
    bytes: plain,
    sha256Ok: actualHash === header.sha256.toLowerCase(),
  };
}

export function embeddedPayloadBytes(payload: SCMPayload | null): Uint8Array<ArrayBuffer> | null {
  if (!payload || payload.mode !== "embedded" || !payload.data) {
    return null;
  }
  return base64UrlToBytes(payload.data);
}

export async function decryptToken(token: string): Promise<SCMTokenPayload> {
  const trimmed = token.trim();
  if (!trimmed.startsWith(`${TOKEN_PREFIX}.`)) {
    throw new Error("This is not an SCM1 digital card token.");
  }
  const encoded = trimmed.slice(TOKEN_PREFIX.length + 1);
  const decoder = new TextDecoder();
  let envelope: TokenEnvelope;
  try {
    envelope = JSON.parse(decoder.decode(base64UrlToBytes(encoded))) as TokenEnvelope;
  } catch {
    throw new Error("Token envelope is malformed.");
  }
  if (envelope.v !== 1 || typeof envelope.n !== "string" || typeof envelope.c !== "string") {
    throw new Error("Token envelope is incomplete.");
  }
  const key = await getKey();
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(envelope.n) },
      key,
      base64UrlToBytes(envelope.c),
    );
  } catch {
    throw new Error("Token authentication failed: the SCM payload was rejected.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(plain));
  } catch {
    throw new Error("Decrypted SCM payload is not valid JSON.");
  }
  return validatePayload(parsed);
}

export function tokenFingerprint(token: string): string {
  return stableHash([token]).slice(0, 12).toUpperCase();
}

export function getAppBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }
  if (typeof window !== "undefined" && window.location) {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}`;
  }
  return "https://scm.studio/";
}

export function buildShareLink(token: string, baseUrl = getAppBaseUrl()): string {
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function readTokenFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const fromSearch = new URLSearchParams(window.location.search).get("token");
  if (fromSearch) {
    return fromSearch;
  }
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("token=")) {
    return decodeURIComponent(hash.slice(6));
  }
  return null;
}

export function describeTokenError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown token failure.";
}
