import type { ExplosionType, RevealDirective } from "../types";

export const EXPLOSION_TYPES: ExplosionType[] = [
  "radial",
  "vortex",
  "shatter",
  "cascade",
  "prism",
  "implode",
];

export const EXPLOSION_LABELS: Record<ExplosionType, string> = {
  radial: "Radial",
  vortex: "Vortex",
  shatter: "Shatter",
  cascade: "Cascade",
  prism: "Prism",
  implode: "Implode",
};

export const EXPLOSION_HINTS: Record<ExplosionType, string> = {
  radial: "Cubes burst outward from the center in every direction.",
  vortex: "Layers spiral outward while the matrix twists around Y.",
  shatter: "Each cube breaks on its own vector for a fragmented debris field.",
  cascade: "Top layers lift and fall away as a sequenced vertical wave.",
  prism: "Cubes split into axis-aligned planes and slide apart.",
  implode: "Cubes collapse toward the core before the content reveal.",
};

export function isExplosionType(value: string): value is ExplosionType {
  return (EXPLOSION_TYPES as string[]).includes(value);
}

export function resolveExplosionType(
  reveal?: RevealDirective | string | null,
): ExplosionType {
  if (!reveal) {
    return "radial";
  }
  if (typeof reveal === "string") {
    return isExplosionType(reveal) ? reveal : "radial";
  }
  return isExplosionType(reveal.type) ? reveal.type : "radial";
}

export function revealDirective(type: ExplosionType): RevealDirective {
  return { v: 1, type };
}
