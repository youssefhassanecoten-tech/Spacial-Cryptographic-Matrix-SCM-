import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SCMAnchor } from "../../types";
import { coordToWorld } from "../../lib/scm";

function AnchorMarker({
  anchor,
  timeRef,
}: {
  anchor: SCMAnchor;
  timeRef: { current: number };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const ringCRef = useRef<THREE.Mesh>(null);
  const position = coordToWorld(anchor.coord);

  useFrame(() => {
    const time = timeRef.current;
    if (groupRef.current) {
      const pulse = 1 + Math.sin(time * 2.1 + anchor.id * 1.7) * 0.06;
      groupRef.current.scale.setScalar(pulse);
    }
    if (ringARef.current) {
      ringARef.current.rotation.z = time * 0.8 + anchor.id;
      ringARef.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.5) * 0.15;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.y = time * 0.65 + anchor.id;
    }
    if (ringCRef.current) {
      ringCRef.current.rotation.x = time * 0.55 + anchor.id;
      ringCRef.current.rotation.y = time * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color="#f8fafc" toneMapped={false} />
      </mesh>
      <mesh ref={ringARef}>
        <torusGeometry args={[0.48, 0.012, 8, 64]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={ringBRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.008, 8, 64]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh ref={ringCRef}>
        <torusGeometry args={[0.76, 0.006, 8, 64]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <Html
        center
        distanceFactor={14}
        position={[0, 0.95, 0]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[20, 0]}
      >
        <div className="whitespace-nowrap rounded-md border border-cyan-400/30 bg-[#050a13]/85 px-2 py-1 font-mono text-[10px] tracking-wider text-cyan-100 shadow-lg shadow-cyan-500/10 backdrop-blur">
          <span className="text-cyan-300">{anchor.label}</span>
          <span className="mx-1 text-slate-600">·</span>
          <span className="text-slate-300">[{anchor.coord.join(",")}]</span>
        </div>
      </Html>
    </group>
  );
}

export function AnchorMarkers({
  anchors,
  timeRef,
}: {
  anchors: SCMAnchor[];
  timeRef: { current: number };
}) {
  return (
    <group>
      {anchors.map((anchor) => (
        <AnchorMarker key={anchor.id} anchor={anchor} timeRef={timeRef} />
      ))}
    </group>
  );
}
