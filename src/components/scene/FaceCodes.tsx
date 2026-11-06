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

  void main() {
    vec2 uv = vUv;
    float border = step(0.05, uv.x) * step(uv.x, 0.95) *
                   step(0.05, uv.y) * step(uv.y, 0.95);
    vec2 codeUv = (uv - 0.07) / 0.86;
    vec2 grid = floor(codeUv * 8.0);
    vec2 cell = fract(codeUv * 8.0);
    float h = hash21(grid);

    float finderA = step(grid.x, 1.0) * step(grid.y, 1.0);
    float finderB = step(6.0, grid.x) * step(6.0, grid.y);
    float ring = step(0.25, cell.x) * step(cell.x, 0.75) *
                 step(0.25, cell.y) * step(cell.y, 0.75);
    float finder = step(0.5, max(finderA, finderB));
    float module = mix(h, 1.0 - ring, finder);

    vec3 ink = mix(vec3(0.015, 0.035, 0.055), vec3(0.82, 0.99, 1.0), step(0.5, module));
    vec3 accent = mix(vec3(0.08, 0.9, 0.92), vec3(0.75, 0.45, 1.0), vSeed);
    vec3 color = mix(vec3(0.015, 0.03, 0.05), ink, border);
    color += accent * (1.0 - border) * 0.35;
    color += accent * step(0.5, module) * border * 0.16;
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
