import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {
  AnimationLayer,
  DesignState,
  SCMMatrix,
  Vec3,
} from "../../types";
import { GRID_HALF, VOXEL_COUNT } from "../../types";
import {
  computeVoxelAnimation,
  type VoxelAnimation,
} from "../../lib/animation";
import {
  rgbToHex,
  sampleContrastRgb,
  sampleGradient,
} from "../../lib/color";
import { hashCell } from "../../lib/rng";
import {
  contrastScores,
  indexToCoord,
  voxelIndex,
} from "../../lib/scm";
import { shapeMask } from "../../lib/shapes";
import { useStudio } from "../../store/useStudio";
import { useVoxelMaterial } from "./useVoxelMaterial";

export interface ActiveVoxel {
  index: number;
  x: number;
  y: number;
  z: number;
  coord: Vec3;
  base: Vec3;
  variant: number;
  contrast: number;
  shapeMask: number;
  seed: number;
}

interface GeometrySet {
  box: THREE.BufferGeometry;
  joint: THREE.BufferGeometry;
  pipe: THREE.BufferGeometry;
  variants: THREE.BufferGeometry[];
}

function buildGeometries(): GeometrySet {
  return {
    box: new THREE.BoxGeometry(0.8, 0.8, 0.8),
    joint: new THREE.BoxGeometry(0.42, 0.42, 0.42),
    pipe: new THREE.CylinderGeometry(0.075, 0.075, 1, 8, 1, false),
    variants: [
      new RoundedBoxGeometry(0.82, 0.82, 0.82, 2, 0.12),
      new THREE.OctahedronGeometry(0.56, 0),
      new THREE.CylinderGeometry(0.4, 0.4, 0.82, 6, 1),
      new THREE.ConeGeometry(0.5, 0.9, 4, 1),
      new THREE.DodecahedronGeometry(0.48, 0),
    ],
  };
}

interface VoxelGroupProps {
  voxels: ActiveVoxel[];
  geometry: THREE.BufferGeometry;
  matrix: SCMMatrix;
  design: DesignState;
  layers: AnimationLayer[];
  timeRef: { current: number };
  material: THREE.Material;
  baseScale: number;
}

function baseColorFor(voxel: ActiveVoxel, design: DesignState): THREE.Color {
  if (design.contrastGuard) {
    const rgb = sampleContrastRgb(voxel.contrast);
    return new THREE.Color(rgbToHex(rgb));
  }
  return new THREE.Color(sampleGradient(design, voxel.coord));
}

function VoxelGroup({
  voxels,
  geometry,
  matrix,
  design,
  layers,
  timeRef,
  material,
  baseScale,
}: VoxelGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(
    () => ({
      anim: { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, glow: 1 } as VoxelAnimation,
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
    }),
    [],
  );

  const instanceGeometry = useMemo(() => {
    const clone = geometry.clone();
    const seeds = new Float32Array(voxels.length);
    for (let i = 0; i < voxels.length; i += 1) {
      seeds[i] = voxels[i].seed;
    }
    clone.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    return clone;
  }, [geometry, voxels]);

  useEffect(() => () => instanceGeometry.dispose(), [instanceGeometry]);

  const baseColors = useMemo(
    () => voxels.map((voxel) => baseColorFor(voxel, design)),
    [voxels, design],
  );

  const baseQuaternions = useMemo(() => {
    if (design.geometry !== "polyhedral") {
      return voxels.map(() => new THREE.Quaternion());
    }
    return voxels.map((voxel) => {
      const hash = hashCell(matrix.seed, voxel.x, voxel.y, voxel.z);
      const angleA = ((hash & 0xffff) / 0xffff) * Math.PI * 2;
      const angleB = (((hash >>> 16) & 0xffff) / 0xffff - 0.5) * 0.9;
      return new THREE.Quaternion().setFromEuler(
        new THREE.Euler(angleB, angleA, angleB * 0.4, "XYZ"),
      );
    });
  }, [voxels, design.geometry, matrix.seed]);

  const writeInstances = () => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const time = timeRef.current;
    const { anim, matrix: scratchMatrix, position, scale, color } = scratch;
    for (let i = 0; i < voxels.length; i += 1) {
      const voxel = voxels[i];
      computeVoxelAnimation(voxel, matrix, layers, time, anim);
      position.set(
        voxel.base[0] + anim.offsetX,
        voxel.base[1] + anim.offsetY,
        voxel.base[2] + anim.offsetZ,
      );
      scale.setScalar(
        Math.max(0.0001, anim.scale * baseScale * voxel.shapeMask),
      );
      scratchMatrix.compose(position, baseQuaternions[i], scale);
      mesh.setMatrixAt(i, scratchMatrix);
      color.copy(baseColors[i]).multiplyScalar(Math.min(2.4, anim.glow));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  };

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < baseColors.length; i += 1) {
      mesh.setColorAt(i, baseColors[i]);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    writeInstances();
  }, [voxels, baseColors, baseQuaternions, matrix, design.geometry]);

  useFrame(() => {
    writeInstances();
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[instanceGeometry, material, voxels.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}

interface PipeConnection {
  a: number;
  b: number;
  colorSeed: Vec3;
  contrast: number;
  seed: number;
}

function PipeField({
  matrix,
  design,
  layers,
  timeRef,
  material,
  geometry,
  voxelByIndex,
}: {
  matrix: SCMMatrix;
  design: DesignState;
  layers: AnimationLayer[];
  timeRef: { current: number };
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
  voxelByIndex: Map<number, ActiveVoxel>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const connections = useMemo(() => {
    const list: PipeConnection[] = [];
    for (let index = 0; index < VOXEL_COUNT; index += 1) {
      if (!matrix.bits[index]) {
        continue;
      }
      const [x, y, z] = indexToCoord(index);
      const neighbors: Array<[number, Vec3]> = [];
      if (x < 8 && matrix.bits[voxelIndex(x + 1, y, z)]) {
        neighbors.push([voxelIndex(x + 1, y, z), [x + 0.5, y, z]]);
      }
      if (y < 8 && matrix.bits[voxelIndex(x, y + 1, z)]) {
        neighbors.push([voxelIndex(x, y + 1, z), [x, y + 0.5, z]]);
      }
      if (z < 8 && matrix.bits[voxelIndex(x, y, z + 1)]) {
        neighbors.push([voxelIndex(x, y, z + 1), [x, y, z + 0.5]]);
      }
      for (const [neighbor, midpoint] of neighbors) {
        const voxelA = voxelByIndex.get(index);
        const voxelB = voxelByIndex.get(neighbor);
        if (!voxelA || !voxelB) {
          continue;
        }
        list.push({
          a: index,
          b: neighbor,
          colorSeed: midpoint,
          contrast: (voxelA.contrast + voxelB.contrast) / 2,
          seed: (voxelA.seed + voxelB.seed) / 2,
        });
      }
    }
    return list;
  }, [matrix, voxelByIndex]);

  const instanceGeometry = useMemo(() => {
    const clone = geometry.clone();
    const seeds = new Float32Array(connections.length);
    for (let i = 0; i < connections.length; i += 1) {
      seeds[i] = connections[i].seed;
    }
    clone.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    return clone;
  }, [geometry, connections]);

  useEffect(() => () => instanceGeometry.dispose(), [instanceGeometry]);

  const baseColors = useMemo(
    () =>
      connections.map((connection) => {
        if (design.contrastGuard) {
          return new THREE.Color(rgbToHex(sampleContrastRgb(connection.contrast)));
        }
        return new THREE.Color(sampleGradient(design, connection.colorSeed));
      }),
    [connections, design],
  );

  const scratch = useMemo(
    () => ({
      animA: { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, glow: 1 } as VoxelAnimation,
      animB: { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, glow: 1 } as VoxelAnimation,
      matrix: new THREE.Matrix4(),
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      color: new THREE.Color(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  const writeInstances = () => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const time = timeRef.current;
    const {
      animA,
      animB,
      matrix: scratchMatrix,
      start,
      end,
      mid,
      direction,
      scale,
      quaternion,
      color,
      up,
    } = scratch;
    for (let i = 0; i < connections.length; i += 1) {
      const connection = connections[i];
      const voxelA = voxelByIndex.get(connection.a);
      const voxelB = voxelByIndex.get(connection.b);
      if (!voxelA || !voxelB) {
        continue;
      }
      computeVoxelAnimation(voxelA, matrix, layers, time, animA);
      computeVoxelAnimation(voxelB, matrix, layers, time, animB);
      start.set(
        voxelA.base[0] + animA.offsetX,
        voxelA.base[1] + animA.offsetY,
        voxelA.base[2] + animA.offsetZ,
      );
      end.set(
        voxelB.base[0] + animB.offsetX,
        voxelB.base[1] + animB.offsetY,
        voxelB.base[2] + animB.offsetZ,
      );
      mid.copy(start).add(end).multiplyScalar(0.5);
      direction.copy(end).sub(start);
      const length = direction.length();
      const visibility = Math.min(
        animA.scale * voxelA.shapeMask,
        animB.scale * voxelB.shapeMask,
      );
      if (length < 1e-4 || visibility < 0.06) {
        scale.set(0, 0, 0);
      } else {
        direction.divideScalar(length);
        quaternion.setFromUnitVectors(up, direction);
        const radius = Math.min(1, Math.sqrt(visibility));
        scale.set(radius, length, radius);
      }
      scratchMatrix.compose(mid, quaternion, scale);
      mesh.setMatrixAt(i, scratchMatrix);
      const glow = ((animA.glow + animB.glow) / 2) * Math.min(1, visibility * 1.4);
      color.copy(baseColors[i]).multiplyScalar(Math.min(2.2, glow));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  };

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < baseColors.length; i += 1) {
      mesh.setColorAt(i, baseColors[i]);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    writeInstances();
  }, [connections, baseColors, matrix, layers]);

  useFrame(() => {
    writeInstances();
  });

  if (connections.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[instanceGeometry, material, connections.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}

export function VoxelField({
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
  const { material, uniforms } = useVoxelMaterial(design);
  const geometries = useMemo(() => buildGeometries(), []);
  const revealPulse = useStudio((state) => state.revealPulse);
  const [burstLayer, setBurstLayer] = useState<AnimationLayer | null>(null);

  useEffect(() => {
    if (!revealPulse) {
      return;
    }
    const start = timeRef.current;
    setBurstLayer({
      id: `reveal-burst-${revealPulse}`,
      type: "explode",
      name: "Reveal Burst",
      enabled: true,
      delay: start,
      duration: 2.8,
      easing: "easeInOutCubic",
      repeat: 1,
      intensity: 1.35,
      axis: "z",
      mode: "slice",
    });
    const timer = window.setTimeout(() => setBurstLayer(null), 3100);
    return () => window.clearTimeout(timer);
  }, [revealPulse, timeRef]);

  const animationLayers = useMemo(
    () => (burstLayer ? [...layers, burstLayer] : layers),
    [layers, burstLayer],
  );

  useFrame(() => {
    uniforms.uTime.value = timeRef.current;
  });

  useEffect(
    () => () => {
      geometries.box.dispose();
      geometries.joint.dispose();
      geometries.pipe.dispose();
      for (const geometry of geometries.variants) {
        geometry.dispose();
      }
    },
    [geometries],
  );

  const activeVoxels = useMemo(() => {
    const scores = contrastScores(matrix);
    const voxels: ActiveVoxel[] = [];
    for (let index = 0; index < VOXEL_COUNT; index += 1) {
      if (!matrix.bits[index]) {
        continue;
      }
      const coord = indexToCoord(index);
      const seed = hashCell(matrix.seed, coord[0], coord[1], coord[2]);
      voxels.push({
        index,
        x: coord[0],
        y: coord[1],
        z: coord[2],
        coord,
        base: [
          coord[0] - GRID_HALF,
          coord[1] - GRID_HALF,
          coord[2] - GRID_HALF,
        ],
        variant: seed % geometries.variants.length,
        contrast: scores[index],
        shapeMask: shapeMask(design.shape, coord),
        seed: seed / 0xffffffff,
      });
    }
    return voxels;
  }, [matrix, geometries.variants.length, design.shape]);

  const voxelByIndex = useMemo(
    () => new Map(activeVoxels.map((voxel) => [voxel.index, voxel])),
    [activeVoxels],
  );

  const groups = useMemo(() => {
    if (design.geometry === "classic") {
      return [{ key: "classic", geometry: geometries.box, voxels: activeVoxels, scale: 1 }];
    }
    if (design.geometry === "maze") {
      return [{ key: "maze-joints", geometry: geometries.joint, voxels: activeVoxels, scale: 1 }];
    }
    return geometries.variants.map((geometry, variant) => ({
      key: `poly-${variant}`,
      geometry,
      voxels: activeVoxels.filter((voxel) => voxel.variant === variant),
      scale: 1,
    }));
  }, [activeVoxels, design.geometry, geometries]);

  return (
    <group>
      {groups.map((group) =>
        group.voxels.length > 0 ? (
          <VoxelGroup
            key={`${matrix.id}-${group.key}-${group.voxels.length}`}
            geometry={group.geometry}
            voxels={group.voxels}
            matrix={matrix}
            design={design}
            layers={animationLayers}
            timeRef={timeRef}
            material={material}
            baseScale={group.scale}
          />
        ) : null,
      )}
      {design.geometry === "maze" ? (
        <PipeField
          key={`${matrix.id}-pipes`}
          matrix={matrix}
          design={design}
          layers={animationLayers}
          timeRef={timeRef}
          material={material}
          geometry={geometries.pipe}
          voxelByIndex={voxelByIndex}
        />
      ) : null}
    </group>
  );
}
