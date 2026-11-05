import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GRID_HALF } from "../../types";

export function BlockGrid() {
  const geometry = useMemo(() => {
    const blockEdges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(2.92, 2.92, 2.92),
    );
    const outerEdges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(GRID_HALF * 2 + 1.4, GRID_HALF * 2 + 1.4, GRID_HALF * 2 + 1.4),
    );
    const blockArray = blockEdges.attributes.position.array as Float32Array;
    const outerArray = outerEdges.attributes.position.array as Float32Array;
    const blockCount = 27;
    const positions = new Float32Array(
      blockArray.length * blockCount + outerArray.length,
    );
    let offset = 0;
    for (let bz = 0; bz < 3; bz += 1) {
      for (let by = 0; by < 3; by += 1) {
        for (let bx = 0; bx < 3; bx += 1) {
          const cx = bx * 3 + 1 - GRID_HALF;
          const cy = by * 3 + 1 - GRID_HALF;
          const cz = bz * 3 + 1 - GRID_HALF;
          for (let i = 0; i < blockArray.length; i += 3) {
            positions[offset] = blockArray[i] + cx;
            positions[offset + 1] = blockArray[i + 1] + cy;
            positions[offset + 2] = blockArray[i + 2] + cz;
            offset += 3;
          }
        }
      }
    }
    positions.set(outerArray, offset);
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    blockEdges.dispose();
    outerEdges.dispose();
    return merged;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#0e7490" transparent opacity={0.26} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#0891b2" transparent opacity={0.1} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
