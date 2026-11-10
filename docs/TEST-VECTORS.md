# SCM Test Vectors

These vectors are deterministic and intended for conformance tests. They do not constitute an audit.

## SHA-256

```
input: empty
sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Merkle root

Leaves are `SHA-256` of the UTF-8 strings `"a"` and `"b"`, in that order. The tree duplicates the last node on odd levels.

```
leaf_a: ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb
leaf_b: 3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d
root:   e5a01fee14e0ed5c48714f22180f25ad8365b53f9779f79dc4a3d7e93963f94a
```

## PBKDF2-SHA256

```
passphrase: password
salt:       salt (UTF-8)
iterations: 310000
length:     32 bytes
output:     66fb3eadeac9a027142642b593359613d587ca1be360b8b53d84eda5c784574e
```

## Ed25519

```
secret key: 0101010101010101010101010101010101010101010101010101010101010101
message:    SCM-TEST-VECTOR
public key: 8a88e3dd7409f195fd52db2d3cba5d72ca6709bf1d94121bf3748801b40f6f5c
signature:  491afb9a540c6ce4a0b3edb223c3ed0d7fc71730a23d8e537e39e3d8c4a79f093e829a6490e5f6cec63b3735b57aeeb6615cd9aae5231f6e28e7e3a93473ed08
```

## Required future vectors

- Package `SCMP2` header and chunk layout with fixed salt/content root.
- HKDF-SHA256 per-chunk key for fixed token/file/index values.
- Shamir 3-of-5 reconstruction with fixed share bytes.
- Reed-Solomon 3-of-5 encode/decode with fixed shard bytes.
- v3 and v4 shard headers with fixed Merkle roots.
