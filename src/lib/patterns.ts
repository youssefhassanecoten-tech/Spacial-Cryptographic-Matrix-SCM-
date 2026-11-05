import type { PatternType } from "../types";

export const PATTERN_TYPES: PatternType[] = [
  "none",
  "stripes",
  "checker",
  "dots",
  "grid",
  "circuit",
  "waves",
  "glyph",
];

export const PATTERN_LABELS: Record<PatternType, string> = {
  none: "None",
  stripes: "Stripes",
  checker: "Checker",
  dots: "Dots",
  grid: "Grid",
  circuit: "Circuit",
  waves: "Waves",
  glyph: "Glyph",
};

export const PATTERN_INDEX: Record<PatternType, number> = {
  none: 0,
  stripes: 1,
  checker: 2,
  dots: 3,
  grid: 4,
  circuit: 5,
  waves: 6,
  glyph: 7,
};

export const PATTERN_HINTS: Record<PatternType, string> = {
  none: "Clean material faces with no surface drawing.",
  stripes: "Animated diagonal ink bands across every individual block face.",
  checker: "Per-block checkerboard tiles with a unique phase per instance.",
  dots: "A halftone dot field wrapped around each geometry face.",
  grid: "Fine etched grid lines on every exposed block surface.",
  circuit: "Rectilinear circuit traces that vary per voxel seed.",
  waves: "Animated radial interference rings across each block.",
  glyph: "A unique procedural glyph tile on every individual voxel.",
};
