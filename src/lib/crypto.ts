import type { SCMTokenPayload } from "../types";
import { stableHash } from "./scm";

const TOKEN_PREFIX = "SCM1";
const KEY_MATERIAL = "scm-studio::duo-system::v1::local-first-matrix::aes-gcm";

interface TokenEnvelope {
  v: 1;
  n: string;
  c: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
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
  return {
    v: 1,
    id: payload.id,
    seed: payload.seed >>> 0,
    label: typeof payload.label === "string" ? payload.label : "SCM Lattice",
    createdAt:
      typeof payload.createdAt === "string" ? payload.createdAt : new Date(0).toISOString(),
    anchors: payload.anchors.map((anchor) => [anchor[0], anchor[1], anchor[2]]),
  };
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
