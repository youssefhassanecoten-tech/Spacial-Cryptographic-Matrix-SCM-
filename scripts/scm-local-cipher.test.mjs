import assert from "node:assert/strict";
import test from "node:test";
import { decryptBuffer, encryptBuffer } from "./scm-local-cipher.mjs";

const passphrase = "correct horse battery staple";

test("round-trips local experimental containers", () => {
  const plaintext = Buffer.from("SCM experimental local cipher test payload.");
  const container = encryptBuffer(plaintext, passphrase);
  assert.notDeepEqual(container.subarray(0, plaintext.length), plaintext);
  assert.equal(decryptBuffer(container, passphrase).toString(), plaintext.toString());
});

test("round-trips binary data with a non-block length", () => {
  const plaintext = Buffer.alloc(513);
  for (let index = 0; index < plaintext.length; index += 1) {
    plaintext[index] = (index * 37 + 11) & 0xff;
  }
  const container = encryptBuffer(plaintext, passphrase);
  assert.deepEqual(decryptBuffer(container, passphrase), plaintext);
});

test("rejects the wrong passphrase", () => {
  const container = encryptBuffer(Buffer.from("secret"), passphrase);
  assert.throws(
    () => decryptBuffer(container, "wrong passphrase"),
    /authentication failed/,
  );
});

test("rejects a tampered container", () => {
  const container = encryptBuffer(Buffer.from("secret data"), passphrase);
  container[container.length - 1] ^= 0xff;
  assert.throws(
    () => decryptBuffer(container, passphrase),
    /authentication failed/,
  );
});
