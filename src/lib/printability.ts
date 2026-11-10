import type { ShapeType } from "../types";

export const PRINTABLE_SHARD_LIMIT_BYTES = 6 * 1024;
export const COMMON_PRINT_BED_MM = 220;

const HARD_SHAPES: ShapeType[] = [
  "shell",
  "star",
  "crystal",
  "icosahedron",
  "dodecahedron",
  "sphere",
  "torus",
  "cylinder",
];

export function shapePrintWarning(shape: ShapeType): string | null {
  if (!HARD_SHAPES.includes(shape)) {
    return null;
  }
  if (shape === "shell") {
    return "Shell uses thin perforated walls and internal faces. It may need supports, a resin printer, or a larger scale.";
  }
  if (shape === "star") {
    return "Star has thin points and steep overhangs. Small scales may fail or break; expect supports.";
  }
  if (shape === "crystal") {
    return "Crystal has sharp tapered points and overhangs. Print at a larger scale or with supports.";
  }
  if (shape === "icosahedron" || shape === "dodecahedron") {
    return "This faceted solid has steep overhangs on most faces. Supports or a resin printer are recommended.";
  }
  return "This legacy curved shape may need supports and a larger scale for a reliable print.";
}

export function footprintPrintWarning(
  gridSize: number,
  scale: number,
): string | null {
  const footprint = gridSize * scale + 2 * scale * 0.6;
  if (footprint > COMMON_PRINT_BED_MM) {
    return `Footprint is about ${footprint.toFixed(1)} mm, above a common ${COMMON_PRINT_BED_MM} mm print bed. Reduce cell scale or use a larger printer.`;
  }
  return null;
}

export function packagePrintWarning(size: number | null | undefined): string | null {
  if (!size || size <= PRINTABLE_SHARD_LIMIT_BYTES) {
    return null;
  }
  return "Payload is above the printable shard-net limit (~6 KB). The printed object can show the shape, but it cannot carry this package's data. Use the digital .scm file or multiple objects.";
}
