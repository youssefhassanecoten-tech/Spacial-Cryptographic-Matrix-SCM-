import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AnimationLayer, DesignState, SCMMatrix, Vec3 } from "../../types";
import {
  computeVoxelAnimation,
  type VoxelAnimation,
} from "../../lib/animation";
import { hashCell, hashString } from "../../lib/rng";
import {
  coordToWorld,
  indexToCoord,
  voxelIndex,
  worldSpacing,
} from "../../lib/scm";
import { shapeMask } from "../../lib/shapes";

interface CodeVoxel {
  index: number;
  x: number;
  y: number;
  z: number;
  base: Vec3;
  seed: number;
  mask: number;
}

const vertexShader = `
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec4 transformed = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * transformed;
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying float vSeed;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 43.0) * 43758.5453);
  }

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
    return length(pa - ba * h);
  }

  float lineMask(vec2 p, vec2 a, vec2 b, float width) {
    return 1.0 - smoothstep(width, width + 0.008, segDist(p, a, b));
  }

  float nodeMask(vec2 p, vec2 center, float size) {
    vec2 d = abs(p - center);
    return 1.0 - step(size, max(d.x, d.y));
  }

  float qrStyle(vec2 uv) {
    vec2 codeUv = (uv - 0.08) / 0.84;
    vec2 grid = floor(codeUv * 10.0);
    vec2 cell = fract(codeUv * 10.0);
    float h = hash21(grid);
    float finderA = step(grid.x, 1.0) * step(grid.y, 1.0);
    float finderB = step(8.0, grid.x) * step(8.0, grid.y);
    float ring = step(0.27, cell.x) * step(cell.x, 0.73) *
                 step(0.27, cell.y) * step(cell.y, 0.73);
    float finder = step(0.5, max(finderA, finderB));
    float module = mix(step(0.52, h), 1.0 - ring, finder);
    return step(0.5, module);
  }

  float constellationStyle(vec2 uv) {
    vec2 a = vec2(0.16 + hash21(vec2(vSeed, 1.0)) * 0.68,
                  0.18 + hash21(vec2(vSeed, 2.0)) * 0.64);
    vec2 b = vec2(0.16 + hash21(vec2(vSeed, 3.0)) * 0.68,
                  0.18 + hash21(vec2(vSeed, 4.0)) * 0.64);
    vec2 c = vec2(0.16 + hash21(vec2(vSeed, 5.0)) * 0.68,
                  0.18 + hash21(vec2(vSeed, 6.0)) * 0.64);
    float lines = max(lineMask(uv, a, b, 0.011), max(lineMask(uv, b, c, 0.011), lineMask(uv, c, a, 0.011)));
    float nodes = max(nodeMask(uv, a, 0.035), max(nodeMask(uv, b, 0.035), nodeMask(uv, c, 0.035)));
    return step(0.5, max(lines, nodes));
  }

  float circuitStyle(vec2 uv) {
    vec2 grid = floor(uv * 7.0);
    vec2 f = fract(uv * 7.0) - 0.5;
    float h = hash21(grid);
    float hx = hash21(vec2(grid.y, vSeed * 11.0));
    float hy = hash21(vec2(grid.x, vSeed * 13.0));
    float traceX = (1.0 - smoothstep(0.055, 0.09, abs(f.y))) * step(0.55, hx);
    float traceY = (1.0 - smoothstep(0.055, 0.09, abs(f.x))) * step(0.55, hy);
    float node = (1.0 - step(0.16, max(abs(f.x), abs(f.y)))) * step(0.7, h);
    return step(0.5, max(max(traceX, traceY), node));
  }

  float runeStyle(vec2 uv) {
    float mask = lineMask(uv, vec2(0.5, 0.16), vec2(0.5, 0.84), 0.018);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float y = 0.26 + fi * 0.16;
      float side = hash21(vec2(vSeed, fi + 20.0)) > 0.5 ? 1.0 : -1.0;
      float reach = 0.12 + hash21(vec2(vSeed, fi + 30.0)) * 0.18;
      vec2 start = vec2(0.5, y);
      vec2 end = vec2(0.5 + side * reach, y + 0.07);
      mask = max(mask, lineMask(uv, start, end, 0.012));
    }
    return step(0.5, mask);
  }

  void main() {
    vec2 uv = vUv;
    float border = step(0.055, uv.x) * step(uv.x, 0.945) *
                   step(0.055, uv.y) * step(uv.y, 0.945);
    float inner = step(0.085, uv.x) * step(uv.x, 0.915) *
                  step(0.085, uv.y) * step(uv.y, 0.915);
    float frame = border * (1.0 - inner);

    float style = floor(vSeed * 4.0);
    float inkMask = 0.0;
    if (style < 0.5) {
      inkMask = qrStyle(uv);
    } else if (style < 1.5) {
      inkMask = constellationStyle(uv);
    } else if (style < 2.5) {
      inkMask = circuitStyle(uv);
    } else {
      inkMask = runeStyle(uv);
    }

    vec3 background = vec3(0.012, 0.025, 0.045);
    vec3 ink = mix(vec3(0.02, 0.06, 0.09), vec3(0.84, 0.99, 1.0), inkMask);
    vec3 accent = mix(vec3(0.08, 0.9, 0.92), vec3(0.78, 0.42, 1.0), vSeed);
    vec3 color = mix(background, ink, border);
    color += accent * inkMask * border * 0.34;
    color += accent * frame * 0.8;
    color += accent * (1.0 - border) * 0.18;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function FaceCodes({
  matrix,
  design,
  layers,
  timeRef,
}: {
  matrix: SCMMatrix;
  design: DesignState;
  layers: AnimationLayer[];
  timeRef: { current: number };
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const spacing = worldSpacing(matrix.gridSize);

  const voxels = useMemo(() => {
    if (design.faceCodeMode === "off") {
      return [];
    }
    const all: CodeVoxel[] = [];
    const seen = new Set<number>();
    const addVoxel = (index: number) => {
      if (seen.has(index) || !matrix.bits[index]) {
        return;
      }
      const coord = indexToCoord(index, matrix.gridSize);
      const mask = shapeMask(design.shape, coord, matrix.gridSize);
      if (mask < 0.08) {
        return;
      }
      seen.add(index);
      const seed = hashCell(
        matrix.seed ^ hashString(matrix.id),
        coord[0],
        coord[1],
        coord[2],
      );
      all.push({
        index,
        x: coord[0],
        y: coord[1],
        z: coord[2],
        base: coordToWorld(coord, matrix.gridSize),
        seed: seed / 0xffffffff,
        mask,
      });
    };

    if (design.faceCodeMode === "all") {
      for (let index = 0; index < matrix.voxelCount; index += 1) {
        addVoxel(index);
      }
      return all;
    }

    if (matrix.gridSize < 9) {
      for (let index = 0; index < matrix.voxelCount; index += 1) {
        addVoxel(index);
      }
      return all;
    }

    for (const anchor of matrix.anchors) {
      addVoxel(
        voxelIndex(
          anchor.coord[0],
          anchor.coord[1],
          anchor.coord[2],
          matrix.gridSize,
        ),
      );
    }
    return all;
  }, [matrix, design.faceCodeMode, design.shape]);

  const instanceGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const seeds = new Float32Array(voxels.length);
    for (let i = 0; i < voxels.length; i += 1) {
      seeds[i] = voxels[i].seed;
    }
    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    return geometry;
  }, [voxels]);

  useEffect(() => () => instanceGeometry.dispose(), [instanceGeometry]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.FrontSide,
        transparent: false,
        depthWrite: true,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  const scratch = useMemo(
    () => ({
      anim: {
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        scale: 1,
        glow: 1,
      } as VoxelAnimation,
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
    }),
    [],
  );

  const writeInstances = () => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const { anim, matrix: scratchMatrix, position, scale, quaternion } = scratch;
    const time = timeRef.current;
    const planeSize = spacing * 0.62;
    const planeZ = spacing * 0.415;
    for (let i = 0; i < voxels.length; i += 1) {
      const voxel = voxels[i];
      computeVoxelAnimation(voxel, matrix, layers, time, anim);
      position.set(
        voxel.base[0] + anim.offsetX,
        voxel.base[1] + anim.offsetY,
        voxel.base[2] + anim.offsetZ + planeZ * anim.scale,
      );
      const size = Math.max(
        0.0001,
        planeSize * anim.scale * voxel.mask,
      );
      scale.set(size, size, size);
      scratchMatrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, scratchMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    writeInstances();
  }, [voxels, instanceGeometry, matrix, layers]);

  useFrame(() => {
    writeInstances();
  });

  if (voxels.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[instanceGeometry, material, voxels.length]}
      frustumCulled={false}
    />
  );
}
