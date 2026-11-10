import { sha256 } from "@noble/hashes/sha256";
import { base64UrlToBytes, bytesToBase64Url, sha256Hex } from "./crypto";
import { gfDiv, gfMatrixInverse, gfMul, gfPow } from "./gf256";
import {
  buildMerkleTree,
  merkleProof,
  toHex,
  verifyMerkleProof,
  type MerkleProofStep,
} from "./merkle";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const SHARE_PREFIX = "SCMSHARE1";
const SHARD_MAGIC = "SCMSH3";
export const MAX_SHARD_PACKAGE_BYTES = 16 * 1024 * 1024;

export interface ShamirShare {
  x: number;
  data: Uint8Array<ArrayBuffer>;
}

export interface ErasureShare {
  index: number;
  data: Uint8Array<ArrayBuffer>;
}

export interface ShardHeader {
  v: 3;
  k: number;
  n: number;
  index: number;
  packageSize: number;
  shardLength: number;
  packageHash: string;
  shardRoot: string;
  proof: MerkleProofStep[];
}

function validateThreshold(k: number, n: number): void {
  if (!Number.isInteger(k) || !Number.isInteger(n)) {
    throw new Error("Shard counts must be integers.");
  }
  if (k < 2 || n < k || n > 255) {
    throw new Error("Use 2 or more shares, with n >= k and n <= 255.");
  }
}

function randomByte(): number {
  return crypto.getRandomValues(new Uint8Array(1))[0];
}

export function splitSecret(
  secret: Uint8Array,
  threshold: number,
  total: number,
): ShamirShare[] {
  validateThreshold(threshold, total);
  const shares = Array.from({ length: total }, () => ({
    x: 0,
    data: new Uint8Array(secret.length),
  }));
  const coefficients = new Uint8Array(threshold);
  for (let position = 0; position < secret.length; position += 1) {
    coefficients[0] = secret[position];
    for (let degree = 1; degree < threshold; degree += 1) {
      coefficients[degree] = randomByte();
    }
    for (let shareIndex = 0; shareIndex < total; shareIndex += 1) {
      const x = shareIndex + 1;
      let y = 0;
      for (let degree = threshold - 1; degree >= 0; degree -= 1) {
        y = gfMul(y, x) ^ coefficients[degree];
      }
      shares[shareIndex].x = x;
      shares[shareIndex].data[position] = y;
    }
  }
  return shares;
}

export function combineSecret(
  shares: ShamirShare[],
  threshold: number,
): Uint8Array<ArrayBuffer> {
  const selected = shares.slice(0, threshold);
  if (selected.length < threshold) {
    throw new Error(`Need at least ${threshold} shares.`);
  }
  const length = selected[0]?.data.length ?? 0;
  if (selected.some((share) => share.data.length !== length)) {
    throw new Error("Shares have different lengths.");
  }
  const secret = new Uint8Array(length);
  for (let position = 0; position < length; position += 1) {
    let value = 0;
    for (let index = 0; index < selected.length; index += 1) {
      const share = selected[index];
      let basis = 1;
      for (let other = 0; other < selected.length; other += 1) {
        if (other === index) {
          continue;
        }
        const otherX = selected[other].x;
        basis = gfMul(basis, gfDiv(otherX, otherX ^ share.x));
      }
      value ^= gfMul(share.data[position], basis);
    }
    secret[position] = value;
  }
  return secret;
}

export function splitTokenShares(
  token: string,
  threshold: number,
  total: number,
): string[] {
  const shares = splitSecret(textEncoder.encode(token), threshold, total);
  return shares.map((share) => {
    const data = bytesToBase64Url(share.data);
    const check = toHex(sha256(share.data)).slice(0, 16);
    return `${SHARE_PREFIX}.${bytesToBase64Url(
      textEncoder.encode(
        JSON.stringify({
          v: 1,
          k: threshold,
          n: total,
          x: share.x,
          data,
          check,
        }),
      ),
    )}`;
  });
}

export function recoverTokenFromShares(values: string[]): string {
  const parsed = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (!value.startsWith(`${SHARE_PREFIX}.`)) {
        throw new Error("This is not an SCM token share.");
      }
      const payload = JSON.parse(
        textDecoder.decode(
          base64UrlToBytes(value.slice(SHARE_PREFIX.length + 1)),
        ),
      ) as {
        v: number;
        k: number;
        n: number;
        x: number;
        data: string;
        check?: string;
      };
      if (
        payload.v !== 1 ||
        !Number.isInteger(payload.k) ||
        !Number.isInteger(payload.n) ||
        !Number.isInteger(payload.x)
      ) {
        throw new Error("SCM token share is invalid.");
      }
      const data = base64UrlToBytes(payload.data);
      if (
        payload.check &&
        toHex(sha256(data)).slice(0, 16) !== payload.check.toLowerCase()
      ) {
        throw new Error("SCM token share failed its checksum.");
      }
      return {
        k: payload.k,
        n: payload.n,
        share: {
          x: payload.x,
          data,
        },
      };
    });
  if (parsed.length === 0) {
    throw new Error("Paste at least one token share.");
  }
  const { k, n } = parsed[0];
  if (parsed.some((entry) => entry.k !== k || entry.n !== n)) {
    throw new Error("Token shares belong to different sets.");
  }
  if (parsed.length < k) {
    throw new Error(`Need at least ${k} shares to recover this token.`);
  }
  return textDecoder.decode(
    combineSecret(
      parsed.slice(0, k).map((entry) => entry.share),
      k,
    ),
  );
}

function erasureGenerator(threshold: number, total: number): number[][] {
  return Array.from({ length: total }, (_, shareIndex) =>
    Array.from({ length: threshold }, (_, degree) =>
      gfPow(shareIndex + 1, degree),
    ),
  );
}

export function erasureEncode(
  data: Uint8Array,
  threshold: number,
  total: number,
): ErasureShare[] {
  validateThreshold(threshold, total);
  const shardLength = data.length === 0 ? 0 : Math.ceil(data.length / threshold);
  const shards = Array.from({ length: total }, (_, index) => ({
    index,
    data: new Uint8Array(shardLength),
  }));
  if (shardLength === 0) {
    return shards;
  }
  const generator = erasureGenerator(threshold, total);
  for (let degree = 0; degree < threshold; degree += 1) {
    const offset = degree * shardLength;
    for (let position = 0; position < shardLength; position += 1) {
      const value = data[offset + position] ?? 0;
      if (value === 0) {
        continue;
      }
      for (let shareIndex = 0; shareIndex < total; shareIndex += 1) {
        shards[shareIndex].data[position] ^=
          gfMul(generator[shareIndex][degree], value);
      }
    }
  }
  return shards;
}

export function erasureDecode(
  shares: ErasureShare[],
  threshold: number,
  originalLength: number,
): Uint8Array<ArrayBuffer> {
  if (shares.length < threshold) {
    throw new Error(`Need at least ${threshold} shards.`);
  }
  const selected = shares.slice(0, threshold);
  const shardLength = selected[0]?.data.length ?? 0;
  if (selected.some((share) => share.data.length !== shardLength)) {
    throw new Error("Shards have different lengths.");
  }
  const matrix = selected.map((share) =>
    Array.from({ length: threshold }, (_, degree) =>
      gfPow(share.index + 1, degree),
    ),
  );
  const inverse = gfMatrixInverse(matrix);
  const output = new Uint8Array(originalLength);
  for (let position = 0; position < shardLength; position += 1) {
    for (let degree = 0; degree < threshold; degree += 1) {
      let value = 0;
      for (let row = 0; row < threshold; row += 1) {
        value ^= gfMul(inverse[degree][row], selected[row].data[position]);
      }
      const outputIndex = degree * shardLength + position;
      if (outputIndex < originalLength) {
        output[outputIndex] = value;
      }
    }
  }
  return output;
}

function shardHeaderBytes(header: ShardHeader): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(JSON.stringify(header));
}

export async function buildShardPackageFiles(
  packageBytes: Uint8Array,
  threshold: number,
  total: number,
): Promise<Blob[]> {
  if (packageBytes.byteLength > MAX_SHARD_PACKAGE_BYTES) {
    throw new Error("Shard export is limited to 16 MB packages.");
  }
  const shards = erasureEncode(packageBytes, threshold, total);
  const leaves = shards.map((share) => sha256(share.data));
  const tree = buildMerkleTree(leaves);
  const packageHash = await sha256Hex(packageBytes);
  const root = toHex(tree.root);
  return shards.map((share, index) => {
    const header: ShardHeader = {
      v: 3,
      k: threshold,
      n: total,
      index: share.index,
      packageSize: packageBytes.byteLength,
      shardLength: share.data.byteLength,
      packageHash,
      shardRoot: root,
      proof: merkleProof(tree, index),
    };
    const headerBytes = shardHeaderBytes(header);
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, headerBytes.byteLength, true);
    return new Blob(
      [textEncoder.encode(SHARD_MAGIC), length, headerBytes, share.data],
      { type: "application/x-scm-shard" },
    );
  });
}

async function parseShardFile(blob: Blob): Promise<{
  header: ShardHeader;
  data: Uint8Array<ArrayBuffer>;
}> {
  const magic = new Uint8Array(await blob.slice(0, 6).arrayBuffer());
  if (textDecoder.decode(magic) !== SHARD_MAGIC) {
    throw new Error("This is not an SCM v3 shard file.");
  }
  const lengthBytes = new Uint8Array(await blob.slice(6, 10).arrayBuffer());
  const headerLength = new DataView(lengthBytes.buffer).getUint32(0, true);
  if (headerLength <= 0 || 10 + headerLength > blob.size) {
    throw new Error("SCM shard header is corrupt.");
  }
  const header = JSON.parse(
    textDecoder.decode(
      new Uint8Array(await blob.slice(10, 10 + headerLength).arrayBuffer()),
    ),
  ) as ShardHeader;
  if (
    header.v !== 3 ||
    !Number.isInteger(header.index) ||
    !Number.isInteger(header.k) ||
    !Number.isInteger(header.n) ||
    header.index < 0 ||
    header.index >= header.n
  ) {
    throw new Error("SCM shard header is invalid.");
  }
  const data = new Uint8Array(
    await blob.slice(10 + headerLength).arrayBuffer(),
  );
  if (data.byteLength !== header.shardLength) {
    throw new Error("SCM shard data is truncated.");
  }
  const leaf = sha256(data);
  if (!verifyMerkleProof(leaf, header.proof, header.shardRoot)) {
    throw new Error("SCM shard proof does not match its root.");
  }
  return { header, data };
}

export async function recoverPackageFromShardFiles(
  files: Blob[],
): Promise<Blob> {
  if (files.length === 0) {
    throw new Error("Add at least one SCM shard file.");
  }
  const parsed = await Promise.all(files.map(parseShardFile));
  const { k, n, packageSize, packageHash, shardLength } = parsed[0].header;
  if (
    parsed.some(
      (entry) =>
        entry.header.k !== k ||
        entry.header.n !== n ||
        entry.header.packageSize !== packageSize ||
        entry.header.packageHash !== packageHash,
    )
  ) {
    throw new Error("SCM shards belong to different packages.");
  }
  if (parsed.length < k) {
    throw new Error(`Need at least ${k} shards to recover this package.`);
  }
  const unique = new Map<number, ErasureShare>();
  for (const entry of parsed) {
    unique.set(entry.header.index, {
      index: entry.header.index,
      data: entry.data,
    });
  }
  if (unique.size < k) {
    throw new Error("SCM shard indexes are duplicated.");
  }
  if (shardLength !== Math.ceil(packageSize / k)) {
    throw new Error("SCM shard length does not match the package.");
  }
  const bytes = erasureDecode(
    Array.from(unique.values()),
    k,
    packageSize,
  );
  if ((await sha256Hex(bytes)) !== packageHash) {
    throw new Error("Recovered package hash does not match.");
  }
  return new Blob([bytes], { type: "application/x-scm-package" });
}
