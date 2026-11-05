import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { DesignState } from "../../types";

export interface VoxelMaterialResult {
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  glowUniform: { value: number };
}

function createMaterial(
  design: DesignState,
  glowUniform: { value: number },
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const base =
    design.material === "glass"
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.08,
          metalness: 0,
          transmission: 0.9,
          thickness: 1.2,
          ior: 1.45,
          attenuationDistance: 4,
          attenuationColor: new THREE.Color("#bae6fd"),
          transparent: true,
          opacity: 0.86,
          clearcoat: 0.4,
          clearcoatRoughness: 0.1,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: design.material === "matte" ? 0.86 : 0.24,
          metalness: design.material === "metallic" ? 0.92 : design.material === "neon" ? 0.28 : 0.08,
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 1,
        });

  base.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glowUniform;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      #ifdef USE_INSTANCING_COLOR
        totalEmissiveRadiance += vColor.rgb * uGlow;
      #endif`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      "uniform float uGlow;\nvoid main() {",
    );
  };
  base.customProgramCacheKey = () => `scm-voxel-${design.material}`;
  return base;
}

export function useVoxelMaterial(design: DesignState): VoxelMaterialResult {
  const glowUniform = useMemo(() => ({ value: design.glow * 2 }), []);
  const material = useMemo(
    () => createMaterial(design, glowUniform),
    [design.material, glowUniform],
  );

  useEffect(() => {
    const glowBase = design.material === "neon" ? 2.25 : design.material === "glass" ? 0.32 : 0.24;
    glowUniform.value = design.glow * glowBase;
    material.roughness = design.material === "matte" ? Math.max(design.roughness, 0.7) : design.roughness;
    material.metalness = design.material === "metallic" ? Math.max(design.metalness, 0.82) : design.metalness;
    material.opacity = design.material === "glass" ? Math.min(design.opacity, 0.82) : design.opacity;
    material.transparent = design.material === "glass" || design.opacity < 1;
    material.flatShading = design.geometry === "polyhedral";
    material.needsUpdate = true;
    if (material instanceof THREE.MeshPhysicalMaterial) {
      material.transmission = 0.9;
      material.thickness = 0.6 + design.roughness * 1.6;
      material.ior = 1.35 + design.metalness * 0.2;
      material.clearcoat = 0.3 + design.glow * 0.5;
      material.clearcoatRoughness = Math.min(0.6, design.roughness);
    }
  }, [design, material, glowUniform]);

  useEffect(() => () => material.dispose(), [material]);

  return { material, glowUniform };
}
