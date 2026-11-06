import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { worldSpacing } from "../../lib/scm";

export function BlockGrid({ gridSize }: { gridSize: number }) {
  const geometry = useMemo(() => {
    const spacing = worldSpacing(gridSize);
    const half = (gridSize - 1) / 2;
    const blockSize = 3 * spacing * 0.97;
    const blocksPerAxis = Math.floor(gridSize / 3);
    const outerSize = (gridSize - 1) * spacing + 0.8 * spacing;
    const blockEdges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(blockSize, blockSize, blockSize),
    );
    const outerEdges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(outerSize, outerSize, outerSize),
    );
    const blockArray = blockEdges.attributes.position.array as Float32Array;
    const outerArray = outerEdges.attributes.position.array as Float32Array;
    const blockCount = blocksPerAxis ** 3;
    const positions = new Float32Array(
      blockArray.length * blockCount + outerArray.length,
    );
    let offset = 0;
    for (let bz = 0; bz < blocksPerAxis; bz += 1) {
      for (let by = 0; by < blocksPerAxis; by += 1) {
        for (let bx = 0; bx < blocksPerAxis; bx += 1) {
          const cx = (bx * 3 + 1 - half) * spacing;
          const cy = (by * 3 + 1 - half) * spacing;
          const cz = (bz * 3 + 1 - half) * spacing;
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
  }, [gridSize]);

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
