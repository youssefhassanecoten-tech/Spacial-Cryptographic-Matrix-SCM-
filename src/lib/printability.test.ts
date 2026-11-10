import { describe, expect, it } from "vitest";
import {
  footprintPrintWarning,
  packagePrintWarning,
  PRINTABLE_SHARD_LIMIT_BYTES,
  shapePrintWarning,
} from "./printability";

describe("printability disclaimers", () => {
  it("warns for thin or overhanging shapes", () => {
    expect(shapePrintWarning("cube")).toBeNull();
    expect(shapePrintWarning("pyramid")).toBeNull();
    expect(shapePrintWarning("shell")).toMatch(/perforated/);
    expect(shapePrintWarning("star")).toMatch(/thin points/);
    expect(shapePrintWarning("crystal")).toMatch(/sharp tapered points/);
  });

  it("warns when the footprint exceeds a common print bed", () => {
    expect(footprintPrintWarning(9, 4)).toBeNull();
    expect(footprintPrintWarning(33, 12)).toMatch(/above a common 220 mm/);
  });

  it("warns when a payload exceeds the printable shard limit", () => {
    expect(packagePrintWarning(PRINTABLE_SHARD_LIMIT_BYTES)).toBeNull();
    expect(packagePrintWarning(PRINTABLE_SHARD_LIMIT_BYTES + 1)).toMatch(
      /above the printable shard-net limit/,
    );
  });
});
