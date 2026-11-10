import { describe, expect, it } from "vitest";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  sha256Hex,
} from "./crypto";
import { buildMerkleTree, merkleProof, toHex, verifyMerkleProof } from "./merkle";
import {
  buildShardPackageFiles,
  combineSecret,
  erasureDecode,
  erasureEncode,
  recoverPackageFromShardFiles,
  recoverTokenFromShares,
  splitSecret,
  splitTokenShares,
} from "./sharding";

const encoder = new TextEncoder();

describe("Shamir threshold sharing", () => {
  it("reconstructs a secret from any threshold subset", () => {
    const secret = encoder.encode("SCM1.threshold-token-test");
    const shares = splitSecret(secret, 3, 5);
    expect(shares).toHaveLength(5);
    for (const subset of [
      [0, 1, 2],
      [0, 3, 4],
      [1, 2, 4],
    ]) {
      expect(
        combineSecret(
          subset.map((index) => shares[index]),
          3,
        ),
      ).toEqual(secret);
    }
  });

  it("round-trips token share strings", () => {
    const token = "SCM1.example-token-value";
    const shares = splitTokenShares(token, 3, 5);
    expect(recoverTokenFromShares([shares[0], shares[2], shares[4]])).toBe(token);
    expect(() => recoverTokenFromShares([shares[0], shares[1]])).toThrow(
      /at least 3 shares/,
    );
  });
});

describe("Reed-Solomon erasure coding", () => {
  it("reconstructs data from any threshold shards", () => {
    const data = encoder.encode("The SCM spatial shard recovery layer.");
    const shards = erasureEncode(data, 3, 5);
    expect(shards).toHaveLength(5);
    for (const subset of [
      [0, 1, 2],
      [0, 2, 4],
      [1, 3, 4],
    ]) {
      expect(
        erasureDecode(
          subset.map((index) => shards[index]),
          3,
          data.length,
        ),
      ).toEqual(data);
    }
  });

  it("round-trips a v3 shard set", async () => {
    const bytes = new Uint8Array(2048);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 19 + 7) & 0xff;
    }
    const files = await buildShardPackageFiles(bytes, 3, 5);
    expect(files).toHaveLength(5);
    const recovered = await recoverPackageFromShardFiles([
      files[0],
      files[2],
      files[4],
    ]);
    const restored = new Uint8Array(await recovered.arrayBuffer());
    expect(await sha256Hex(restored)).toBe(await sha256Hex(bytes));
  });
});

describe("Merkle proofs", () => {
  it("verifies each leaf and rejects a tampered leaf", () => {
    const leaves = Array.from({ length: 8 }, (_, index) =>
      encoder.encode(`leaf-${index}`),
    );
    const tree = buildMerkleTree(leaves);
    for (let index = 0; index < leaves.length; index += 1) {
      expect(
        verifyMerkleProof(leaves[index], merkleProof(tree, index), toHex(tree.root)),
      ).toBe(true);
    }
    const tampered = encoder.encode("leaf-x");
    expect(
      verifyMerkleProof(tampered, merkleProof(tree, 0), toHex(tree.root)),
    ).toBe(false);
  });
});

describe("Token share integrity", () => {
  it("rejects a damaged token share before reconstruction", () => {
    const shares = splitTokenShares("SCM1.checksum-test", 3, 5);
    const payload = JSON.parse(
      new TextDecoder().decode(
        base64UrlToBytes(shares[0].slice("SCMSHARE1.".length)),
      ),
    );
    const data = base64UrlToBytes(payload.data);
    data[0] ^= 0xff;
    payload.data = bytesToBase64Url(data);
    const tampered = `SCMSHARE1.${bytesToBase64Url(
      new TextEncoder().encode(JSON.stringify(payload)),
    )}`;
    expect(() =>
      recoverTokenFromShares([tampered, shares[1], shares[2]]),
    ).toThrow(/checksum/);
  });
});
