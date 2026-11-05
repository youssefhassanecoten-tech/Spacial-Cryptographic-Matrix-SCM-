import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { DesignState } from "../../types";
import { PATTERN_INDEX } from "../../lib/patterns";

export interface VoxelUniforms {
  uGlow: { value: number };
  uPatternMode: { value: number };
  uPatternScale: { value: number };
  uPatternIntensity: { value: number };
  uPatternColor: { value: THREE.Color };
  uTime: { value: number };
}

export interface VoxelMaterialResult {
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  uniforms: VoxelUniforms;
}

function createMaterial(
  design: DesignState,
  uniforms: VoxelUniforms,
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
          metalness:
            design.material === "metallic" ? 0.92 : design.material === "neon" ? 0.28 : 0.08,
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 1,
        });

  base.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      attribute float aSeed;
      varying float vSeed;
      varying vec2 vScmUv;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vSeed = aSeed;
      vScmUv = uv;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `uniform float uGlow;
      uniform float uPatternMode;
      uniform float uPatternScale;
      uniform float uPatternIntensity;
      uniform vec3 uPatternColor;
      uniform float uTime;
      varying float vSeed;
      varying vec2 vScmUv;
      void main() {`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float scmPattern = 0.0;
      vec2 scmUv = vScmUv * max(1.0, uPatternScale);
      float scmSeed = vSeed * 6.2831853;
      if (uPatternMode > 0.5) {
        if (uPatternMode < 1.5) {
          scmPattern = smoothstep(0.15, 0.45, abs(sin((vScmUv.x + vScmUv.y) * uPatternScale * 3.14159 + scmSeed + uTime * 0.5)));
        } else if (uPatternMode < 2.5) {
          scmPattern = mod(floor(scmUv.x) + floor(scmUv.y) + floor(vSeed * 11.0), 2.0);
        } else if (uPatternMode < 3.5) {
          vec2 dotCell = fract(scmUv + vSeed) - 0.5;
          scmPattern = smoothstep(0.32, 0.12, length(dotCell));
        } else if (uPatternMode < 4.5) {
          vec2 gridCell = abs(fract(scmUv + vSeed) - 0.5);
          scmPattern = smoothstep(0.07, 0.01, min(gridCell.x, gridCell.y));
        } else if (uPatternMode < 5.5) {
          float lane = step(0.82, fract(sin((floor(scmUv.x) + floor(scmUv.y) * 13.0 + vSeed * 31.0) * 12.9898) * 43758.5453));
          float lines = smoothstep(0.42, 0.5, abs(sin(vScmUv.y * uPatternScale * 6.28318 + scmSeed)));
          scmPattern = lane * lines;
        } else if (uPatternMode < 6.5) {
          float radial = length(vScmUv - 0.5);
          scmPattern = smoothstep(0.15, 0.8, abs(sin(radial * uPatternScale * 12.0 - uTime * 1.2 + scmSeed)));
        } else {
          vec2 glyphCell = floor(scmUv + vSeed * 3.0);
          float glyph = fract(sin(dot(glyphCell, vec2(12.9898, 78.233)) + vSeed * 19.19) * 43758.5453);
          scmPattern = step(0.55, glyph);
        }
      }
      diffuseColor.rgb = mix(diffuseColor.rgb, uPatternColor, scmPattern * uPatternIntensity);`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      #ifdef USE_INSTANCING_COLOR
        totalEmissiveRadiance += vColor.rgb * uGlow;
      #endif
      totalEmissiveRadiance += uPatternColor * scmPattern * uPatternIntensity * 0.9;`,
    );
  };
  base.customProgramCacheKey = () => `scm-voxel-${design.material}`;
  return base;
}

export function useVoxelMaterial(design: DesignState): VoxelMaterialResult {
  const uniforms = useMemo<VoxelUniforms>(
    () => ({
      uGlow: { value: design.glow * 2 },
      uPatternMode: { value: PATTERN_INDEX[design.pattern] },
      uPatternScale: { value: design.patternScale },
      uPatternIntensity: { value: design.pattern === "none" ? 0 : design.patternIntensity },
      uPatternColor: { value: new THREE.Color(design.patternColor) },
      uTime: { value: 0 },
    }),
    [],
  );
  const material = useMemo(
    () => createMaterial(design, uniforms),
    [design.material, uniforms],
  );

  useEffect(() => {
    const glowBase =
      design.material === "neon" ? 2.25 : design.material === "glass" ? 0.32 : 0.24;
    uniforms.uGlow.value = design.glow * glowBase;
    uniforms.uPatternMode.value = PATTERN_INDEX[design.pattern];
    uniforms.uPatternScale.value = Math.max(0.1, design.patternScale);
    uniforms.uPatternIntensity.value =
      design.pattern === "none" ? 0 : Math.min(1.2, design.patternIntensity);
    uniforms.uPatternColor.value.set(design.patternColor);
    material.roughness =
      design.material === "matte"
        ? Math.max(design.roughness, 0.7)
        : design.roughness;
    material.metalness =
      design.material === "metallic"
        ? Math.max(design.metalness, 0.82)
        : design.metalness;
    material.opacity =
      design.material === "glass" ? Math.min(design.opacity, 0.82) : design.opacity;
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
  }, [design, material, uniforms]);

  useEffect(() => () => material.dispose(), [material]);

  return { material, uniforms };
}
