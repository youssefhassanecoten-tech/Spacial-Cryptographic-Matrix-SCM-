import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MAGIC = Buffer.from("SCMEXP01");
const SALT_SIZE = 16;
const NONCE_SIZE = 16;
const LENGTH_SIZE = 8;
const HEADER_SIZE = MAGIC.length + SALT_SIZE + NONCE_SIZE + LENGTH_SIZE;
const BLOCK_SIZE = 64;
const HALF_BLOCK = 32;
const ROUNDS = 16;
const TAG_SIZE = 32;

function deriveMaster(passphrase, salt) {
  return scryptSync(passphrase, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

function deriveRoundKeys(master, salt) {
  const keys = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    keys.push(
      Buffer.from(
        hkdfSync(
          "sha256",
          master,
          salt,
          `scm-local-v0-round-${round}`,
          HALF_BLOCK,
        ),
      ),
    );
  }
  return keys;
}

function deriveSbox(master) {
  const scores = Array.from({ length: 256 }, (_, value) => ({
    value,
    score: createHash("sha256")
      .update(master)
      .update("scm-local-v0-sbox")
      .update(Buffer.from([value]))
      .digest()
      .readUInt32BE(0),
  }));
  scores.sort((left, right) => left.score - right.score);
  return Uint8Array.from(scores, (entry) => entry.value);
}

function spatialPermute(input) {
  const output = Buffer.alloc(HALF_BLOCK);
  for (let z = 0; z < 2; z += 1) {
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        const from = x + 4 * y + 16 * z;
        const to = y + 4 * x + 16 * z;
        output[to] = input[from];
      }
    }
  }
  return output;
}

function roundFunction(right, roundKey, sbox) {
  const mixed = Buffer.alloc(HALF_BLOCK);
  for (let index = 0; index < HALF_BLOCK; index += 1) {
    mixed[index] = sbox[right[index] ^ roundKey[index]];
  }
  const permuted = spatialPermute(mixed);
  const output = Buffer.alloc(HALF_BLOCK);
  for (let index = 0; index < HALF_BLOCK; index += 1) {
    output[index] =
      permuted[index] ^
      permuted[(index + 1) & 31] ^
      permuted[(index + 7) & 31] ^
      permuted[(index + 13) & 31];
  }
  return output;
}

function encryptBlock(block, roundKeys, sbox) {
  let left = Buffer.from(block.subarray(0, HALF_BLOCK));
  let right = Buffer.from(block.subarray(HALF_BLOCK));
  for (let round = 0; round < ROUNDS; round += 1) {
    const nextLeft = right;
    const nextRight = Buffer.alloc(HALF_BLOCK);
    const mixed = roundFunction(right, roundKeys[round], sbox);
    for (let index = 0; index < HALF_BLOCK; index += 1) {
      nextRight[index] = left[index] ^ mixed[index];
    }
    left = nextLeft;
    right = nextRight;
  }
  return Buffer.concat([left, right]);
}

function counterBlock(nonce, counter) {
  const block = Buffer.alloc(BLOCK_SIZE);
  nonce.copy(block, 0);
  block.writeBigUInt64LE(BigInt(counter), NONCE_SIZE);
  return block;
}

function cryptCtr(data, nonce, roundKeys, sbox) {
  const output = Buffer.alloc(data.length);
  let counter = 0;
  for (let offset = 0; offset < data.length; offset += BLOCK_SIZE) {
    const stream = encryptBlock(counterBlock(nonce, counter), roundKeys, sbox);
    const end = Math.min(data.length, offset + BLOCK_SIZE);
    for (let index = offset; index < end; index += 1) {
      output[index] = data[index] ^ stream[index - offset];
    }
    counter += 1;
  }
  return output;
}

function deriveKeys(passphrase, salt) {
  const master = deriveMaster(passphrase, salt);
  return {
    roundKeys: deriveRoundKeys(master, salt),
    sbox: deriveSbox(master),
    macKey: Buffer.from(
      hkdfSync("sha256", master, salt, "scm-local-v0-mac", 32),
    ),
  };
}

export function encryptBuffer(plaintext, passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters.");
  }
  const salt = randomBytes(SALT_SIZE);
  const nonce = randomBytes(NONCE_SIZE);
  const { roundKeys, sbox, macKey } = deriveKeys(passphrase, salt);
  const ciphertext = cryptCtr(plaintext, nonce, roundKeys, sbox);
  const header = Buffer.alloc(HEADER_SIZE);
  MAGIC.copy(header, 0);
  salt.copy(header, MAGIC.length);
  nonce.copy(header, MAGIC.length + SALT_SIZE);
  header.writeBigUInt64LE(BigInt(plaintext.length), MAGIC.length + SALT_SIZE + NONCE_SIZE);
  const tag = createHmac("sha256", macKey)
    .update(header)
    .update(ciphertext)
    .digest();
  return Buffer.concat([header, ciphertext, tag]);
}

export function decryptBuffer(container, passphrase) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters.");
  }
  if (container.length < HEADER_SIZE + TAG_SIZE) {
    throw new Error("SCM experimental container is truncated.");
  }
  if (!container.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("This is not an SCM experimental container.");
  }
  const salt = container.subarray(MAGIC.length, MAGIC.length + SALT_SIZE);
  const nonce = container.subarray(
    MAGIC.length + SALT_SIZE,
    MAGIC.length + SALT_SIZE + NONCE_SIZE,
  );
  const length = Number(
    container.readBigUInt64LE(MAGIC.length + SALT_SIZE + NONCE_SIZE),
  );
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new Error("SCM experimental length field is invalid.");
  }
  const header = container.subarray(0, HEADER_SIZE);
  const ciphertextEnd = HEADER_SIZE + length;
  if (ciphertextEnd + TAG_SIZE !== container.length) {
    throw new Error("SCM experimental container length is invalid.");
  }
  const ciphertext = container.subarray(HEADER_SIZE, ciphertextEnd);
  const tag = container.subarray(ciphertextEnd);
  const { roundKeys, sbox, macKey } = deriveKeys(passphrase, salt);
  const expected = createHmac("sha256", macKey)
    .update(header)
    .update(ciphertext)
    .digest();
  if (tag.length !== expected.length || !timingSafeEqual(tag, expected)) {
    throw new Error("SCM experimental authentication failed.");
  }
  return cryptCtr(ciphertext, nonce, roundKeys, sbox);
}

function usage() {
  process.stderr.write(
    [
      "SCM experimental local cipher (unaudited)",
      "Usage:",
      "  SCM_PASSPHRASE='...' node scripts/scm-local-cipher.mjs encrypt input output.scmexp",
      "  SCM_PASSPHRASE='...' node scripts/scm-local-cipher.mjs decrypt input.scmexp output",
      "",
      "Use only for local experiments. Do not use for valuable secrets.",
      "",
    ].join("\n"),
  );
}

if (process.argv[1] && process.argv[1].endsWith("scm-local-cipher.mjs")) {
  const [, , mode, input, output] = process.argv;
  const passphrase = process.env.SCM_PASSPHRASE;
  if (!mode || !input || !output || !passphrase) {
    usage();
    process.exitCode = 1;
  } else {
    try {
      const data = readFileSync(input);
      if (mode === "encrypt") {
        writeFileSync(output, encryptBuffer(data, passphrase));
      } else if (mode === "decrypt") {
        writeFileSync(output, decryptBuffer(data, passphrase));
      } else {
        usage();
        process.exitCode = 1;
      }
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
