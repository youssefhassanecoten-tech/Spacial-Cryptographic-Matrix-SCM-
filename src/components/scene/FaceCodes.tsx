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
  isInBounds,
  voxelIndex,
  worldSpacing,
} from "../../lib/scm";
import { shapeMask } from "../../lib/shapes";

interface CodeFace {
  index: number;
  x: number;
  y: number;
  z: number;
  base: Vec3;
  seed: number;
  mask: number;
  normal: Vec3;
  quaternion: THREE.Quaternion;
}

const FACE_DIRECTIONS: Array<{
  normal: Vec3;
  quaternion: THREE.Quaternion;
}> = [
  { normal: [0, 0, 1], quaternion: new THREE.Quaternion() },
  {
    normal: [0, 0, -1],
    quaternion: new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI,
    ),
  },
  {
    normal: [1, 0, 0],
    quaternion: new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2,
    ),
  },
  {
    normal: [-1, 0, 0],
    quaternion: new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -Math.PI / 2,
    ),
  },
  {
    normal: [0, 1, 0],
    quaternion: new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2,
    ),
  },
  {
    normal: [0, -1, 0],
    quaternion: new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      Math.PI / 2,
    ),
  },
];

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
  uniform float uInfo;
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
    float cells = mix(8.0, 15.0, uInfo);
    vec2 codeUv = (uv - 0.08) / 0.84;
    vec2 grid = floor(codeUv * cells);
    vec2 cell = fract(codeUv * cells);
    float h = hash21(grid);
    float finderA = step(grid.x, 1.0) * step(grid.y, 1.0);
    float finderB = step(cells - 2.0, grid.x) * step(cells - 2.0, grid.y);
    float ring = step(0.27, cell.x) * step(cell.x, 0.73) *
                 step(0.27, cell.y) * step(cell.y, 0.73);
    float finder = step(0.5, max(finderA, finderB));
    float threshold = mix(0.61, 0.48, uInfo);
    float module = mix(step(threshold, h), 1.0 - ring, finder);
    return step(0.5, module);
  }

  float constellationStyle(vec2 uv) {
    vec2 a = vec2(0.14 + hash21(vec2(vSeed, 1.0)) * 0.72,
                  0.16 + hash21(vec2(vSeed, 2.0)) * 0.68);
    vec2 b = vec2(0.14 + hash21(vec2(vSeed, 3.0)) * 0.72,
                  0.16 + hash21(vec2(vSeed, 4.0)) * 0.68);
    vec2 c = vec2(0.14 + hash21(vec2(vSeed, 5.0)) * 0.72,
                  0.16 + hash21(vec2(vSeed, 6.0)) * 0.68);
    vec2 d = vec2(0.14 + hash21(vec2(vSeed, 7.0)) * 0.72,
                  0.16 + hash21(vec2(vSeed, 8.0)) * 0.68);
    vec2 e = vec2(0.14 + hash21(vec2(vSeed, 9.0)) * 0.72,
                  0.16 + hash21(vec2(vSeed, 10.0)) * 0.68);
    vec2 f = vec2(0.14 + hash21(vec2(vSeed, 11.0)) * 0.72,
                  0.16 + hash21(vec2(vSeed, 12.0)) * 0.68);
    float lines = max(lineMask(uv, a, b, 0.011), max(lineMask(uv, b, c, 0.011), lineMask(uv, c, a, 0.011)));
    float nodes = max(nodeMask(uv, a, 0.032), max(nodeMask(uv, b, 0.032), nodeMask(uv, c, 0.032)));
    float extra = step(0.42, uInfo);
    float extra2 = step(0.72, uInfo);
    lines = max(lines, extra * max(lineMask(uv, c, d, 0.011), lineMask(uv, d, e, 0.011)));
    lines = max(lines, extra2 * max(lineMask(uv, e, f, 0.011), lineMask(uv, f, a, 0.011)));
    nodes = max(nodes, extra * max(nodeMask(uv, d, 0.032), nodeMask(uv, e, 0.032)));
    nodes = max(nodes, extra2 * nodeMask(uv, f, 0.032));
    return step(0.5, max(lines, nodes));
  }

  float circuitStyle(vec2 uv) {
    float cells = mix(6.0, 11.0, uInfo);
    vec2 grid = floor(uv * cells);
    vec2 f = fract(uv * cells) - 0.5;
    float h = hash21(grid);
    float hx = hash21(vec2(grid.y, vSeed * 11.0));
    float hy = hash21(vec2(grid.x, vSeed * 13.0));
    float threshold = mix(0.62, 0.42, uInfo);
    float traceX = (1.0 - smoothstep(0.055, 0.09, abs(f.y))) * step(threshold, hx);
    float traceY = (1.0 - smoothstep(0.055, 0.09, abs(f.x))) * step(threshold, hy);
    float node = (1.0 - step(0.16, max(abs(f.x), abs(f.y)))) * step(0.68, h);
    return step(0.5, max(max(traceX, traceY), node));
  }

  float runeStyle(vec2 uv) {
    float mask = lineMask(uv, vec2(0.5, 0.14), vec2(0.5, 0.86), 0.018);
    float branches = mix(2.0, 6.0, uInfo);
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      if (fi < branches) {
        float y = 0.2 + fi * 0.12;
        float side = hash21(vec2(vSeed, fi + 20.0)) > 0.5 ? 1.0 : -1.0;
        float reach = 0.12 + hash21(vec2(vSeed, fi + 30.0)) * 0.2;
        vec2 start = vec2(0.5, y);
        vec2 end = vec2(0.5 + side * reach, y + 0.06);
        mask = max(mask, lineMask(uv, start, end, 0.012));
      }
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

  const info = useMemo(() => {
    const fill = matrix.activeCount / Math.max(1, matrix.voxelCount);
    const scale = (matrix.gridSize - 3) / 18;
    return Math.max(0, Math.min(1, fill * 0.35 + scale * 0.65));
  }, [matrix]);

  const faces = useMemo(() => {
    if (design.faceCodeMode === "off") {
      return [];
    }
    const all: CodeFace[] = [];
    const seen = new Set<number>();
    const shapeSeed = hashString(design.shape);
    const maskAt = (x: number, y: number, z: number): number => {
      if (!isInBounds([x, y, z], matrix.gridSize)) {
        return 0;
      }
      const index = voxelIndex(x, y, z, matrix.gridSize);
      if (!matrix.bits[index]) {
        return 0;
      }
      return shapeMask(design.shape, [x, y, z], matrix.gridSize);
    };
    const addVoxel = (index: number) => {
      if (seen.has(index) || !matrix.bits[index]) {
        return;
      }
      const coord = indexToCoord(index, matrix.gridSize);
      const mask = shapeMask(design.shape, coord, matrix.gridSize);
      if (mask < 0.12) {
        return;
      }
      seen.add(index);
      const [x, y, z] = coord;
      for (let faceIndex = 0; faceIndex < FACE_DIRECTIONS.length; faceIndex += 1) {
        const face = FACE_DIRECTIONS[faceIndex];
        const [nx, ny, nz] = face.normal;
        if (design.faceCodeMode === "auto") {
          const neighborMask = maskAt(x + nx, y + ny, z + nz);
          if (neighborMask >= 0.12) {
            continue;
          }
        }
        const seed = hashCell(
          matrix.seed ^
            hashString(matrix.id) ^
            shapeSeed ^
            Math.imul(faceIndex + 1, 0x9e3779b9),
          x,
          y,
          z,
        );
        all.push({
          index,
          x,
          y,
          z,
          base: coordToWorld(coord, matrix.gridSize),
          seed: seed / 0xffffffff,
          mask,
          normal: face.normal,
          quaternion: face.quaternion,
        });
      }
    };

    if (design.faceCodeMode === "all") {
      for (let index = 0; index < matrix.voxelCount; index += 1) {
        addVoxel(index);
      }
      return all;
    }

    for (let index = 0; index < matrix.voxelCount; index += 1) {
      if (!matrix.bits[index]) {
        continue;
      }
      addVoxel(index);
    }
    return all;
  }, [matrix, design.faceCodeMode, design.shape]);

  const instanceGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const seeds = new Float32Array(faces.length);
    for (let i = 0; i < faces.length; i += 1) {
      seeds[i] = faces[i].seed;
    }
    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    return geometry;
  }, [faces]);

  useEffect(() => () => instanceGeometry.dispose(), [instanceGeometry]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uInfo: { value: info },
        },
        side: THREE.FrontSide,
        transparent: false,
        depthWrite: true,
      }),
    [],
  );

  useEffect(() => {
    material.uniforms.uInfo.value = info;
  }, [material, info]);

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
    }),
    [],
  );

  const writeInstances = () => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const { anim, matrix: scratchMatrix, position, scale } = scratch;
    const time = timeRef.current;
    const planeSize = spacing * 0.62;
    for (let i = 0; i < faces.length; i += 1) {
      const face = faces[i];
      computeVoxelAnimation(face, matrix, layers, time, anim);
      const offset = spacing * 0.415 * anim.scale * face.mask + 0.002;
      position.set(
        face.base[0] + anim.offsetX + face.normal[0] * offset,
        face.base[1] + anim.offsetY + face.normal[1] * offset,
        face.base[2] + anim.offsetZ + face.normal[2] * offset,
      );
      const size = Math.max(0.0001, planeSize * anim.scale * face.mask);
      scale.set(size, size, size);
      scratchMatrix.compose(position, face.quaternion, scale);
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
  }, [faces, instanceGeometry, matrix, layers]);

  useFrame(() => {
    writeInstances();
  });

  if (faces.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[instanceGeometry, material, faces.length]}
      frustumCulled={false}
    />
  );
}
