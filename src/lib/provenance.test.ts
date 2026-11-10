import { describe, expect, it } from "vitest";
import { createProvenanceRecord, verifyProvenanceRecord } from "./provenance";

describe("Ed25519 provenance", () => {
  it("signs and verifies a provenance record", async () => {
    const record = await createProvenanceRecord({
      keyType: "device",
      issuerName: "Test Issuer",
      shapeId: "shape-123",
      tokenId: "token-123",
      packageBlob: new Blob(["package-bytes"]),
    });
    expect(record.algorithm).toBe("Ed25519");
    expect(await verifyProvenanceRecord(record)).toBe(true);
    const tampered = { ...record, packageHash: "00" };
    expect(await verifyProvenanceRecord(tampered)).toBe(false);
  });
});
