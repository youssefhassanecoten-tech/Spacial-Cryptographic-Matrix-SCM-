# SCM Threat Model

Status: draft. This is not an audit.

## Assets

- Plaintext payload items.
- Private token and passphrase.
- Encrypted `.scm` package.
- Token shares.
- Package shards.
- Issuer provenance records and public keys.
- Device-local signing keys.

## Adversaries

1. **Passive network observer** — sees traffic, cannot modify it.
2. **Package-only attacker** — has one or more encrypted packages but no token.
3. **Token-only attacker** — has the private token but no package.
4. **Share attacker** — has fewer than the threshold number of token shares or package shards.
5. **Device attacker** — has local storage or the unlocked device.
6. **Malicious issuer impersonator** — tries to forge a provenance record.
7. **Physical attacker** — has a printed object or shard cards, possibly damaged or partial.

## Guarantees

- Package-only attacker cannot decrypt without the salt/content key from the token.
- Token-only attacker can read embedded text and metadata but not package file bytes.
- Share attacker below threshold cannot reconstruct the token/package.
- Tampered package chunks fail AEAD and Merkle verification.
- Tampered shards fail Merkle proof verification.
- Passphrase-locked tokens require both token and passphrase.
- Provenance signatures detect modification of the signed fields.
- Token shares are exported as separate files and carry checksums.

## Non-guarantees

- A token holder can decrypt by design; the token is a bearer credential.
- v1 legacy tokens are encrypted with an embedded application key. The application source makes that key public; v1 tokens do **not** protect against an attacker who has the token and the source.
- JS implementations are not constant-time. Side-channel resistance is not claimed.
- A compromised device can capture plaintext, passphrases, or keys from memory.
- The app does not provide forward secrecy, post-quantum security, or multi-party authenticated messaging.
- QR/photo recovery is best-effort; print quality, lighting, occlusion, and camera resolution matter.
- The app does not prevent a user from sharing a token, passphrase, or shard with the wrong person.
- External audit has not been performed.

## Assumptions

- The browser/WebView and OS are not compromised.
- `crypto.getRandomValues` and WebCrypto behave correctly.
- PBKDF2 passphrases have sufficient entropy.
- Users store token shares, package shards, and passphrases separately.
- OPFS, when used, is available and not tampered with by another origin.

## Recommended hardening

- Independent audit of the token envelope, package format, HKDF derivation, Shamir implementation, Reed-Solomon encoding, and Merkle proofs.
- Constant-time or native implementations for secret-dependent operations.
- Hardware-backed key storage for signing keys.
- Passphrase policy and migration away from v1 legacy tokens.
- Reproducible builds and signed release artifacts.
