import type { DesignState, SCMMatrix, Vec3 } from "../../types";
import { GRID_SIZE } from "../../types";
import { sampleGradient } from "../color";
import { indexToCoord, voxelIndex } from "../scm";

export type FaceId = "front" | "back" | "left" | "right" | "top" | "bottom";

export interface FaceDef {
  id: FaceId;
  label: string;
  subtitle: string;
  depthFrom: number;
  depthTo: number;
  coordFor: (u: number, v: number, depth: number) => Vec3;
}

export interface FaceCell {
  u: number;
  v: number;
  active: boolean;
  color: string;
  coord: Vec3;
}

export interface FaceMap {
  def: FaceDef;
  cells: FaceCell[];
  activeCount: number;
}

export const FACE_DEFS: FaceDef[] = [
  {
    id: "front",
    label: "Front",
    subtitle: "Z-MAX ORTHOGRAPHIC",
    depthFrom: GRID_SIZE - 1,
    depthTo: 0,
    coordFor: (u, v, depth) => [u, GRID_SIZE - 1 - v, depth],
  },
  {
    id: "back",
    label: "Back",
    subtitle: "Z-MIN ORTHOGRAPHIC",
    depthFrom: 0,
    depthTo: GRID_SIZE - 1,
    coordFor: (u, v, depth) => [GRID_SIZE - 1 - u, GRID_SIZE - 1 - v, depth],
  },
  {
    id: "right",
    label: "Right",
    subtitle: "X-MAX ORTHOGRAPHIC",
    depthFrom: GRID_SIZE - 1,
    depthTo: 0,
    coordFor: (u, v, depth) => [depth, GRID_SIZE - 1 - v, GRID_SIZE - 1 - u],
  },
  {
    id: "left",
    label: "Left",
    subtitle: "X-MIN ORTHOGRAPHIC",
    depthFrom: 0,
    depthTo: GRID_SIZE - 1,
    coordFor: (u, v, depth) => [depth, GRID_SIZE - 1 - v, u],
  },
  {
    id: "top",
    label: "Top",
    subtitle: "Y-MAX ORTHOGRAPHIC",
    depthFrom: GRID_SIZE - 1,
    depthTo: 0,
    coordFor: (u, v, depth) => [u, depth, GRID_SIZE - 1 - v],
  },
  {
    id: "bottom",
    label: "Bottom",
    subtitle: "Y-MIN ORTHOGRAPHIC",
    depthFrom: 0,
    depthTo: GRID_SIZE - 1,
    coordFor: (u, v, depth) => [u, depth, v],
  },
];

export function buildFaceMap(
  matrix: SCMMatrix,
  design: DesignState,
  face: FaceDef,
): FaceMap {
  const cells: FaceCell[] = [];
  let activeCount = 0;
  for (let v = 0; v < GRID_SIZE; v += 1) {
    for (let u = 0; u < GRID_SIZE; u += 1) {
      const step = face.depthFrom <= face.depthTo ? 1 : -1;
      let active = false;
      let coord = face.coordFor(u, v, face.depthFrom);
      for (let depth = face.depthFrom; ; depth += step) {
        const candidate = face.coordFor(u, v, depth);
        const index = voxelIndex(candidate[0], candidate[1], candidate[2]);
        if (matrix.bits[index] === 1) {
          active = true;
          coord = candidate;
          break;
        }
        if (depth === face.depthTo) {
          break;
        }
      }
      if (active) {
        activeCount += 1;
      }
      cells.push({
        u,
        v,
        active,
        color: sampleGradient(design, coord),
        coord,
      });
    }
  }
  return { def: face, cells, activeCount };
}

export function buildAllFaceMaps(matrix: SCMMatrix, design: DesignState): FaceMap[] {
  return FACE_DEFS.map((face) => buildFaceMap(matrix, design, face));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function faceMapSvg(map: FaceMap, size = 1024): string {
  const padding = size * 0.1;
  const titleHeight = size * 0.12;
  const gridSize = size - padding * 2;
  const originX = padding;
  const originY = titleHeight;
  const gap = gridSize * 0.009;
  const cell = (gridSize - gap * (GRID_SIZE - 1)) / GRID_SIZE;
  const cells = map.cells
    .map((entry) => {
      const x = originX + entry.u * (cell + gap);
      const y = originY + entry.v * (cell + gap);
      const fill = entry.active ? entry.color : "#0b1422";
      const stroke = entry.active ? "rgba(255,255,255,0.12)" : "rgba(148,163,184,0.08)";
      const rx = Math.max(4, cell * 0.13);
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(
        2,
      )}" height="${cell.toFixed(2)}" rx="${rx.toFixed(
        2,
      )}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(
        1,
        cell * 0.012,
      ).toFixed(2)}"${entry.active ? ' opacity="0.96"' : ' opacity="0.55"'}/>`;
    })
    .join("");
  const footerY = originY + gridSize + size * 0.055;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050810"/>
      <stop offset="0.55" stop-color="#070d18"/>
      <stop offset="1" stop-color="#0b1020"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.65">
      <stop offset="0" stop-color="#22d3ee" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  <g fill="none" stroke="#22d3ee" stroke-opacity="0.35" stroke-width="${size * 0.002}">
    <path d="M${padding * 0.5} ${padding * 0.7}h${size * 0.06}M${padding * 0.5} ${
      padding * 0.7
    }v${size * 0.06}"/>
    <path d="M${size - padding * 0.5} ${padding * 0.7}h-${size * 0.06}M${
      size - padding * 0.5
    } ${padding * 0.7}v${size * 0.06}"/>
  </g>
  <text x="${padding}" y="${size * 0.055}" fill="#e2e8f0" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${size * 0.038}" font-weight="700" letter-spacing="${size * 0.004}">SCM · ${escapeXml(
    map.def.label.toUpperCase(),
  )}</text>
  <text x="${padding}" y="${size * 0.086}" fill="#5eead4" font-family="ui-monospace, monospace" font-size="${size * 0.018}" letter-spacing="${size * 0.002}">${escapeXml(
    map.def.subtitle,
  )}</text>
  <text x="${size - padding}" y="${size * 0.055}" text-anchor="end" fill="#94a3b8" font-family="ui-monospace, monospace" font-size="${size * 0.018}">${map.activeCount} ACTIVE</text>
  <g>${cells}</g>
  <text x="${padding}" y="${footerY}" fill="#94a3b8" font-family="ui-monospace, monospace" font-size="${size * 0.017}" letter-spacing="${size * 0.0015}">SCM STUDIO · 9×9×9 MATRIX · ORTHOGRAPHIC PROJECTION</text>
  <text x="${size - padding}" y="${footerY}" text-anchor="end" fill="#475569" font-family="ui-monospace, monospace" font-size="${size * 0.015}">${map.def.label.toUpperCase()} / ${map.def.subtitle.split(" ")[0]}</text>
</svg>`;
}

export function faceMapSvgDataUrl(map: FaceMap, size = 1024): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(faceMapSvg(map, size))}`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function paintFace(
  ctx: CanvasRenderingContext2D,
  map: FaceMap,
  size: number,
  compact = false,
): void {
  const padding = size * (compact ? 0.12 : 0.1);
  const titleHeight = size * (compact ? 0.14 : 0.12);
  const gridSize = size - padding * 2;
  const originX = padding;
  const originY = titleHeight;
  const gap = gridSize * 0.009;
  const cell = (gridSize - gap * (GRID_SIZE - 1)) / GRID_SIZE;
  ctx.save();
  const background = ctx.createLinearGradient(0, 0, size, size);
  background.addColorStop(0, "#050810");
  background.addColorStop(0.55, "#070d18");
  background.addColorStop(1, "#0b1020");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size / 2, size * 0.45, 0, size / 2, size * 0.45, size * 0.7);
  glow.addColorStop(0, "rgba(34,211,238,0.13)");
  glow.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `700 ${size * (compact ? 0.052 : 0.038)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(`SCM · ${map.def.label.toUpperCase()}`, padding, size * 0.058);
  ctx.fillStyle = "#5eead4";
  ctx.font = `500 ${size * (compact ? 0.026 : 0.018)}px ui-monospace, monospace`;
  ctx.fillText(map.def.subtitle, padding, size * 0.088);
  if (!compact) {
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText(`${map.activeCount} ACTIVE`, size - padding, size * 0.055);
    ctx.textAlign = "left";
  }
  for (const entry of map.cells) {
    const x = originX + entry.u * (cell + gap);
    const y = originY + entry.v * (cell + gap);
    roundedRect(ctx, x, y, cell, cell, cell * 0.13);
    if (entry.active) {
      ctx.shadowColor = entry.color;
      ctx.shadowBlur = compact ? cell * 0.16 : cell * 0.22;
      ctx.fillStyle = entry.color;
      ctx.globalAlpha = 0.96;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = Math.max(1, cell * 0.012);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#0b1422";
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(148,163,184,0.09)";
      ctx.lineWidth = Math.max(1, cell * 0.01);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#64748b";
  ctx.font = `500 ${size * (compact ? 0.022 : 0.017)}px ui-monospace, monospace`;
  ctx.fillText(
    "SCM STUDIO · 9×9×9 MATRIX · ORTHOGRAPHIC",
    padding,
    size * (compact ? 0.945 : 0.965),
  );
  const corner = size * 0.025;
  ctx.strokeStyle = "rgba(34,211,238,0.4)";
  ctx.lineWidth = Math.max(1, size * 0.002);
  ctx.beginPath();
  ctx.moveTo(padding * 0.5, padding * 0.7);
  ctx.lineTo(padding * 0.5 + corner, padding * 0.7);
  ctx.moveTo(padding * 0.5, padding * 0.7);
  ctx.lineTo(padding * 0.5, padding * 0.7 + corner);
  ctx.moveTo(size - padding * 0.5, padding * 0.7);
  ctx.lineTo(size - padding * 0.5 - corner, padding * 0.7);
  ctx.moveTo(size - padding * 0.5, padding * 0.7);
  ctx.lineTo(size - padding * 0.5, padding * 0.7 + corner);
  ctx.stroke();
  ctx.restore();
}

export function faceMapCanvas(map: FaceMap, size = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas is unavailable in this browser.");
  }
  paintFace(ctx, map, size, false);
  return canvas;
}

export function faceMapPngDataUrl(map: FaceMap, size = 1024): string {
  return faceMapCanvas(map, size).toDataURL("image/png");
}

export function contactSheetCanvas(maps: FaceMap[], width = 1800): HTMLCanvasElement {
  const columns = 3;
  const rows = Math.ceil(maps.length / columns);
  const panel = width / columns;
  const header = 120;
  const height = header + rows * panel + 40;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas is unavailable in this browser.");
  }
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#04060c");
  background.addColorStop(1, "#0a0f1d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 44px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("SCM STUDIO · ORTHOGRAPHIC FACE SHEET", 48, 72);
  ctx.fillStyle = "#5eead4";
  ctx.font = "500 20px ui-monospace, monospace";
  ctx.fillText("SIX-FACE CONTACT PROJECTION · 9×9×9 MATRIX", 48, 102);
  maps.forEach((map, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * panel;
    const y = header + row * panel;
    const panelCanvas = faceMapCanvas(map, 600);
    ctx.drawImage(panelCanvas, x + 12, y + 12, panel - 24, panel - 24);
    ctx.strokeStyle = "rgba(94,234,212,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 12, y + 12, panel - 24, panel - 24);
  });
  return canvas;
}

export function contactSheetPngDataUrl(maps: FaceMap[], width = 1800): string {
  return contactSheetCanvas(maps, width).toDataURL("image/png");
}

export function faceMapForCoord(matrix: SCMMatrix, coord: Vec3): FaceCell | undefined {
  const [x, y, z] = coord;
  const index = voxelIndex(x, y, z);
  if (!matrix.bits[index]) {
    return undefined;
  }
  return {
    u: x,
    v: GRID_SIZE - 1 - y,
    active: true,
    color: "#5eead4",
    coord,
  };
}

export function activeCoords(matrix: SCMMatrix): Vec3[] {
  const coords: Vec3[] = [];
  for (let index = 0; index < matrix.bits.length; index += 1) {
    if (matrix.bits[index]) {
      coords.push(indexToCoord(index));
    }
  }
  return coords;
}
