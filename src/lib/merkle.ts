import { sha256 } from "@noble/hashes/sha256";

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function combineHashes(
  left: Uint8Array,
  right: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(left.length + right.length);
  joined.set(left, 0);
  joined.set(right, left.length);
  return new Uint8Array(sha256(joined));
}

export interface MerkleTree {
  root: Uint8Array<ArrayBuffer>;
  layers: Uint8Array<ArrayBuffer>[][];
}

export interface MerkleProofStep {
  hash: string;
  side: "left" | "right";
}

export function buildMerkleTree(leaves: Uint8Array[]): MerkleTree {
  if (leaves.length === 0) {
    const root = new Uint8Array(sha256(new Uint8Array(0)));
    return { root, layers: [[root]] };
  }
  const layers: Uint8Array<ArrayBuffer>[][] = [
    leaves.map((leaf) => new Uint8Array(leaf)),
  ];
  while (layers[layers.length - 1].length > 1) {
    const current = layers[layers.length - 1];
    const next: Uint8Array<ArrayBuffer>[] = [];
    for (let index = 0; index < current.length; index += 2) {
      const left = current[index];
      const right = current[index + 1] ?? current[index];
      next.push(combineHashes(left, right));
    }
    layers.push(next);
  }
  return { root: layers[layers.length - 1][0], layers };
}

export function merkleRoot(leaves: Uint8Array[]): Uint8Array<ArrayBuffer> {
  return buildMerkleTree(leaves).root;
}

export function merkleProof(
  tree: MerkleTree,
  leafIndex: number,
): MerkleProofStep[] {
  if (leafIndex < 0 || leafIndex >= (tree.layers[0]?.length ?? 0)) {
    throw new Error("Merkle leaf index is out of bounds.");
  }
  const proof: MerkleProofStep[] = [];
  let index = leafIndex;
  for (let level = 0; level < tree.layers.length - 1; level += 1) {
    const layer = tree.layers[level];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    const sibling = layer[siblingIndex] ?? layer[index];
    proof.push({
      hash: toHex(sibling),
      side: index % 2 === 0 ? "right" : "left",
    });
    index = Math.floor(index / 2);
  }
  return proof;
}

export function verifyMerkleProof(
  leaf: Uint8Array,
  proof: MerkleProofStep[],
  root: string,
): boolean {
  let hash = new Uint8Array(leaf);
  for (const step of proof) {
    const sibling = hexToBytes(step.hash);
    hash =
      step.side === "left"
        ? combineHashes(sibling, hash)
        : combineHashes(hash, sibling);
  }
  return toHex(hash) === root.toLowerCase();
}

export function hexToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2 !== 0) {
    throw new Error("Invalid hex value.");
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
