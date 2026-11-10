# SCM Format Specification

Status: draft. This document describes the implemented formats. It is not an audit.

## 1. Token envelopes

Prefix: `SCM1.`

### v1 legacy

```
{ "v": 1, "n": "<base64url iv>", "c": "<base64url AES-GCM ciphertext>" }
```

- AES-256-GCM.
- Key = SHA-256 of the embedded application constant.
- This is **not** confidential against an attacker who has the application source.
- The token itself is the bearer secret.

### v2 passphrase-locked

```
{
  "v": 2,
  "kdf": "PBKDF2-SHA256",
  "i": 310000,
  "s": "<base64url 16-byte salt>",
  "n": "<base64url 12-byte iv>",
  "c": "<base64url AES-GCM ciphertext>"
}
```

- Key = PBKDF2-SHA256(passphrase, salt, iterations, 32 bytes).
- AES-256-GCM.
- The passphrase must be shared separately from the token.

## 2. Payload manifest

The private token payload contains:

```
{
  "v": 1,
  "id": "matrix id",
  "seed": 32-bit integer,
  "label": "string",
  "createdAt": "ISO timestamp",
  "gridSize": 3..33,
  "anchors": [[x,y,z], ...],
  "fill": "full" | "data",
  "fillCount": number,
  "reveal": { "v": 1, "type": "radial|vortex|shatter|cascade|prism|implode" },
  "shapeId": "hex",
  "salt": "base64url",
  "contentRoot": "sha-256 hex",
  "manifest": { ... },
  "payload": { ... legacy only ... }
}
```

## 3. Package format `SCMP2`

Layout:

```
magic       5 bytes   "SCMP2"
headerLen   4 bytes   uint32 LE
header      headerLen bytes JSON
manifest    manifestSize bytes AES-GCM ciphertext
chunks      repeated chunk records
```

Header:

```
{
  "v": 2,
  "tokenId": "...",
  "shapeId": "...",
  "contentRoot": "sha-256 hex",
  "manifestIv": "base64url",
  "manifestSize": number,
  "chunkSize": 4194304,
  "chunks": [number],
  "compression": "gzip" | "none",
  "kdf": "hkdf-chunk-v1",
  "chunkRoot": "merkle root hex"
}
```

Chunk record:

```
cipherLen   4 bytes uint32 LE
iv          12 bytes
cipher      cipherLen bytes AES-GCM ciphertext
```

- Manifest key = SHA-256(`scm-content-v2:${salt}:${contentRoot}`).
- Chunk key = HKDF-SHA256(contentKey, salt=tokenId, info=`scm-chunk-v1:${fileId}:${chunkIndex}`, 32).
- AAD = `SCMP2:${tokenId}:${fileId}:${chunkIndex}`.
- Chunk leaf = SHA-256(length || iv || ciphertext).
- `chunkRoot` = Merkle root over chunk leaves in package order.
- Manifest AAD = `SCMP2:manifest:${tokenId}`.
- Compression is per file with gzip before encryption when supported.
- Legacy `SCMP1` packages remain readable.

## 4. Shard formats

### v3 small shards (`SCMSH3`)

```
magic       6 bytes   "SCMSH3"
headerLen   4 bytes   uint32 LE
header      JSON
data        shard bytes
```

Header:

```
{
  "v": 3,
  "k": number,
  "n": number,
  "index": number,
  "packageSize": number,
  "shardLength": number,
  "packageHash": "sha-256 hex",
  "shardRoot": "merkle root hex",
  "proof": [{"hash": "hex", "side": "left|right"}]
}
```

- Reed-Solomon over GF(256) with generator matrix `G[i][d] = (i+1)^d`.
- Small shard export is limited to 16 MB.

### v4 block shards (`SCMSH4`)

```
magic       6 bytes   "SCMSH4"
headerLen   4 bytes   uint32 LE
header      JSON
data        concatenated shard segments
```

Header adds:

```
{
  "v": 4,
  "blockSize": number,
  "blockLengths": [number],
  "shardLengths": [number],
  "packageHash": "sha-256 hex",
  "shardRoot": "merkle root hex",
  "proof": [...]
}
```

- Package is split into blocks of at most `blockSize` bytes.
- Each block is independently Reed-Solomon encoded into `n` shards.
- Shard file `i` contains block 0 shard `i`, block 1 shard `i`, and so on.
- Large exports use OPFS when available; otherwise they are limited to 64 MB in memory.

## 5. Token shares

Prefix: `SCMSHARE1.`

```
{
  "v": 1,
  "k": threshold,
  "n": total,
  "x": share index (1..n),
  "data": "base64url share bytes",
  "check": "first 16 hex chars of SHA-256(share bytes)"
}
```

- Shamir secret sharing over GF(256) with polynomial evaluation at `x = 1..n`.
- Any `k` shares reconstruct the token.
- Each share is a separate file in the UI.
