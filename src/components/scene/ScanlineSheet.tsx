import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AnimationLayer } from "../../types";
import { getScanlineState } from "../../lib/animation";

export function ScanlineSheet({
  layers,
  timeRef,
}: {
  layers: AnimationLayer[];
  timeRef: { current: number };
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    const state = getScanlineState(layers, timeRef.current);
    group.visible = state.active;
    if (!state.active) {
      return;
    }
    const extent = 8.8;
    const travel = -4.4 + state.progress * extent;
    group.rotation.set(0, 0, 0);
    if (state.axis === "x") {
      group.rotation.y = Math.PI / 2;
      group.position.set(travel, 0, 0);
    } else if (state.axis === "y") {
      group.rotation.x = Math.PI / 2;
      group.position.set(0, travel, 0);
    } else {
      group.position.set(0, 0, travel);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh>
        <planeGeometry args={[9.5, 9.5]} />
        <meshBasicMaterial
          color="#5eead4"
          transparent
          opacity={0.075}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[9.5, 0.035]} />
        <meshBasicMaterial
          color="#ccfbf1"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[9.5, 0.035]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
