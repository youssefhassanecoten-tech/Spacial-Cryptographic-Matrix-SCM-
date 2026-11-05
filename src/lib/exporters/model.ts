import type { ExportOptions, SCMMatrix } from "../../types";
import { GRID_HALF, GRID_SIZE } from "../../types";
import { indexToCoord } from "../scm";

type TriangleSoup = {
  positions: number[];
  normals: number[];
  triangles: number;
};

function pushTriangle(
  soup: TriangleSoup,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  for (const point of [a, b, c]) {
    soup.positions.push(point[0], point[1], point[2]);
    soup.normals.push(nx, ny, nz);
  }
  soup.triangles += 1;
}

function pushQuad(
  soup: TriangleSoup,
  v0: [number, number, number],
  v1: [number, number, number],
  v2: [number, number, number],
  v3: [number, number, number],
): void {
  pushTriangle(soup, v0, v1, v2);
  pushTriangle(soup, v0, v2, v3);
}

function pushBox(
  soup: TriangleSoup,
  center: [number, number, number],
  size: [number, number, number],
): void {
  const x0 = center[0] - size[0] / 2;
  const x1 = center[0] + size[0] / 2;
  const y0 = center[1] - size[1] / 2;
  const y1 = center[1] + size[1] / 2;
  const z0 = center[2] - size[2] / 2;
  const z1 = center[2] + size[2] / 2;

  pushQuad(soup, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  pushQuad(soup, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  pushQuad(soup, [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
  pushQuad(soup, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  pushQuad(soup, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  pushQuad(soup, [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
}

export function buildModelSoup(matrix: SCMMatrix, options: ExportOptions): TriangleSoup {
  const soup: TriangleSoup = { positions: [], normals: [], triangles: 0 };
  const scale = Math.max(0.5, options.scale);
  const baseThickness = Math.max(0.2, options.baseThickness);
  const margin = scale * 0.6;
  const baseSize = GRID_SIZE * scale + margin * 2;

  if (options.includeBasePlate) {
    pushBox(soup, [0, -baseThickness / 2, 0], [baseSize, baseThickness, baseSize]);
  }

  const voxelSize = scale * 0.78;
  for (let index = 0; index < matrix.bits.length; index += 1) {
    if (!matrix.bits[index]) {
      continue;
    }
    const [x, y, z] = indexToCoord(index);
    pushBox(
      soup,
      [
        (x - GRID_HALF) * scale,
        y * scale + scale / 2,
        (z - GRID_HALF) * scale,
      ],
      [voxelSize, voxelSize, voxelSize],
    );
  }
  return soup;
}

export function exportStl(matrix: SCMMatrix, options: ExportOptions): Blob {
  const soup = buildModelSoup(matrix, options);
  const buffer = new ArrayBuffer(84 + soup.triangles * 50);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  const header = encoder.encode("SCM Studio binary lattice export");
  new Uint8Array(buffer, 0, 80).set(header.subarray(0, 80));
  view.setUint32(80, soup.triangles, true);
  let offset = 84;
  for (let triangle = 0; triangle < soup.triangles; triangle += 1) {
    const n = triangle * 9;
    view.setFloat32(offset, soup.normals[n], true);
    view.setFloat32(offset + 4, soup.normals[n + 1], true);
    view.setFloat32(offset + 8, soup.normals[n + 2], true);
    offset += 12;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const p = n + vertex * 3;
      view.setFloat32(offset, soup.positions[p], true);
      view.setFloat32(offset + 4, soup.positions[p + 1], true);
      view.setFloat32(offset + 8, soup.positions[p + 2], true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "model/stl" });
}

export function exportObj(matrix: SCMMatrix, options: ExportOptions): string {
  const soup = buildModelSoup(matrix, options);
  const lines: string[] = ["o SCM_Lattice"];
  const vertexMap = new Map<string, number>();
  let nextVertex = 1;

  const vertexIndex = (offset: number): number => {
    const x = soup.positions[offset];
    const y = soup.positions[offset + 1];
    const z = soup.positions[offset + 2];
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    const existing = vertexMap.get(key);
    if (existing) {
      return existing;
    }
    lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
    vertexMap.set(key, nextVertex);
    nextVertex += 1;
    return nextVertex - 1;
  };

  for (let triangle = 0; triangle < soup.triangles; triangle += 1) {
    const base = triangle * 9;
    const a = vertexIndex(base);
    const b = vertexIndex(base + 3);
    const c = vertexIndex(base + 6);
    lines.push(`f ${a} ${b} ${c}`);
  }
  return `${lines.join("\n")}\n`;
}

export function estimateExport(matrix: SCMMatrix, options: ExportOptions): {
  voxels: number;
  triangles: number;
  vertices: number;
} {
  const boxes = matrix.activeCount + (options.includeBasePlate ? 1 : 0);
  return {
    voxels: matrix.activeCount,
    triangles: boxes * 12,
    vertices: boxes * 8,
  };
}
