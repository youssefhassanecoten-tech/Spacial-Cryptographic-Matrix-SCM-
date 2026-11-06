import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Line2, LineSegments2 } from "three-stdlib";
import type { AnimationLayer, SCMMatrix } from "../../types";
import {
  computeVoxelAnimation,
  type VoxelAnimation,
} from "../../lib/animation";
import { coordToWorld, indexToCoord } from "../../lib/scm";
import { buildTrajectory } from "../../lib/trajectory";

export function TrajectoryLine({
  matrix,
  layers,
  timeRef,
}: {
  matrix: SCMMatrix;
  layers: AnimationLayer[];
  timeRef: { current: number };
}) {
  const lineRef = useRef<Line2 | LineSegments2>(null);
  const trajectory = useMemo(() => buildTrajectory(matrix), [matrix]);
  const pathVoxels = useMemo(
    () =>
      matrix.path.map((index) => {
        const coord = indexToCoord(index, matrix.gridSize);
        return {
          index,
          x: coord[0],
          y: coord[1],
          z: coord[2],
          base: coordToWorld(coord, matrix.gridSize),
        };
      }),
    [matrix],
  );
  const scratch = useMemo(
    () => ({
      anim: { offsetX: 0, offsetY: 0, offsetZ: 0, scale: 1, glow: 1 } as VoxelAnimation,
      values: new Array(pathVoxels.length * 3).fill(0) as number[],
    }),
    [pathVoxels.length],
  );

  useFrame(() => {
    const line = lineRef.current;
    if (!line) {
      return;
    }
    const time = timeRef.current;
    const { anim, values } = scratch;
    for (let i = 0; i < pathVoxels.length; i += 1) {
      const voxel = pathVoxels[i];
      computeVoxelAnimation(voxel, matrix, layers, time, anim);
      values[i * 3] = voxel.base[0] + anim.offsetX;
      values[i * 3 + 1] = voxel.base[1] + anim.offsetY;
      values[i * 3 + 2] = voxel.base[2] + anim.offsetZ;
    }
    line.geometry.setPositions(values);
    line.computeLineDistances();
  });

  if (trajectory.points3D.length < 2) {
    return null;
  }

  return (
    <group>
      <Line
        ref={lineRef as never}
        points={trajectory.points3D}
        color="#5eead4"
        lineWidth={2.4}
        transparent
        opacity={0.94}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        renderOrder={12}
      />
      {trajectory.anchorPoints3D.map((point, index) => (
        <mesh key={index} position={point} renderOrder={13}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshBasicMaterial color="#f8fafc" depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
