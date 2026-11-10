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

export function merkleRoot(leaves: Uint8Array[]): Uint8Array<ArrayBuffer> {
  if (leaves.length === 0) {
    return new Uint8Array(sha256(new Uint8Array(0)));
  }
  let level: Uint8Array<ArrayBuffer>[] = leaves.map(
    (leaf) => new Uint8Array(leaf),
  );
  while (level.length > 1) {
    const next: Uint8Array<ArrayBuffer>[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? level[index];
      next.push(combineHashes(left, right));
    }
    level = next;
  }
  return new Uint8Array(level[0]);
}
