# SCM Audit Readiness

Status: not audited.

## Scope for an external reviewer

- Token envelope v1 and v2.
- PBKDF2 parameters and passphrase handling.
- Package `SCMP2` chunk layout, HKDF per-chunk keys, AEAD AAD, Merkle root.
- Shard format `SCMSH3` and block format `SCMSH4`.
- Shamir secret sharing and checksum handling.
- Reed-Solomon GF(256) encode/decode.
- Ed25519 provenance and local key storage.
- OPFS package/shard handling and cleanup.
- QR/photo recovery assumptions and error handling.

## Current test coverage

- Matrix determinism, anchors, path, token round-trip.
- Package chunking, compression, tamper rejection, Merkle proofs.
- Shamir token shares, checksums, wrong-subset rejection.
- Reed-Solomon shard recovery.
- v4 block shard recovery.
- Ed25519 provenance sign/verify.
- Printability and payload-size warnings.

## Missing before a serious audit

- Independent review of the GF(256) and Shamir/Reed-Solomon implementations.
- Constant-time analysis of secret-dependent code.
- Fuzzing of package and shard parsers.
- Large-file tests on real Android, iOS, Electron, and desktop browsers.
- OPFS failure and cleanup tests.
- QR camera/photo recovery tests under lighting, angle, and occlusion.
- Test vectors for every format, including package headers and HKDF outputs.
- Reproducible builds and signed release artifacts.
- A written security claim and non-goals document reviewed by counsel.

## Known non-goals

- Not a replacement for Signal, age, or AES.
- Not forward-secret.
- Not post-quantum.
- Not constant-time.
- Not a substitute for an audited hardware token.
