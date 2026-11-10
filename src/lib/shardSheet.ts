import QRCode from "qrcode";
import { bytesToBase64Url } from "./crypto";

const MAX_QR_TEXT_LENGTH = 2800;
const FACE_SIZE = 260;
const GAP = 18;
const PADDING = 10;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function qrSvg(text: string, x: number, y: number): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "L" });
  const modules = qr.modules.size;
  const moduleSize = (FACE_SIZE - PADDING * 2) / (modules + 8);
  const offset = PADDING + moduleSize * 4;
  const cells: string[] = [];
  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (qr.modules.data[row * modules + column]) {
        cells.push(
          `<rect x="${(x + offset + column * moduleSize).toFixed(2)}" y="${(
            y +
            offset +
            row * moduleSize
          ).toFixed(2)}" width="${moduleSize.toFixed(2)}" height="${moduleSize.toFixed(
            2,
          )}"/>`,
        );
      }
    }
  }
  return `<g fill="#0b1220">${cells.join("")}</g>`;
}

export async function buildShardCubeNetSvg(
  files: Blob[],
  label: string,
  threshold: number,
  total: number,
): Promise<Blob> {
  if (files.length > 6) {
    throw new Error("Printable cube nets support at most 6 shards.");
  }
  const texts = await Promise.all(
    files.map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = `SCMSHARDB64.${bytesToBase64Url(bytes)}`;
      if (text.length > MAX_QR_TEXT_LENGTH) {
        throw new Error(
          "Shard is too large for a printable QR. Use a smaller package or more shards.",
        );
      }
      return text;
    }),
  );

  const width = FACE_SIZE * 4 + GAP * 5;
  const height = FACE_SIZE * 3 + GAP * 4;
  const positions = [
    [GAP, GAP + FACE_SIZE + GAP],
    [GAP * 2 + FACE_SIZE, GAP],
    [GAP * 2 + FACE_SIZE, GAP + FACE_SIZE + GAP],
    [GAP * 2 + FACE_SIZE, (GAP + FACE_SIZE) * 2],
    [GAP * 3 + FACE_SIZE * 2, GAP + FACE_SIZE + GAP],
    [GAP * 4 + FACE_SIZE * 3, GAP + FACE_SIZE + GAP],
  ];

  const panels = texts.map((text, index) => {
    const [x, y] = positions[index];
    return [
      `<g>`,
      `<rect x="${x}" y="${y}" width="${FACE_SIZE}" height="${FACE_SIZE}" rx="10" fill="#f8fafc" stroke="#0e7490" stroke-width="2"/>`,
      qrSvg(text, x, y),
      `<text x="${x + 12}" y="${y + 22}" font-family="ui-monospace, monospace" font-size="13" fill="#0e7490">SCM SHARD ${index + 1}/${total}</text>`,
      `<text x="${x + 12}" y="${y + FACE_SIZE - 12}" font-family="ui-monospace, monospace" font-size="11" fill="#334155">${threshold}-of-${total} · ${escapeXml(label)}</text>`,
      `</g>`,
    ].join("");
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#e2e8f0"/>`,
    `<text x="${GAP}" y="18" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="700" fill="#0f172a">SCM SPATIAL SHARD NET</text>`,
    `<text x="${width - GAP}" y="18" text-anchor="end" font-family="ui-monospace, monospace" font-size="10" fill="#475569">${threshold}-of-${total} · print at 100% · fold on dashed edges</text>`,
    ...panels,
    `</svg>`,
  ].join("");

  return new Blob([svg], { type: "image/svg+xml" });
}

export function buildTokenShareSheetSvg(
  shares: string[],
  label: string,
  threshold: number,
  total: number,
): Blob {
  const cardWidth = 380;
  const cardHeight = 380;
  const gap = 16;
  const columns = 2;
  const rows = Math.ceil(shares.length / columns);
  const width = cardWidth * columns + gap * (columns + 1);
  const height = cardHeight * rows + gap * (rows + 1) + 22;

  const cards = shares.map((share, index) => {
    if (share.length > MAX_QR_TEXT_LENGTH) {
      throw new Error("Token share is too large for a printable QR card.");
    }
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = gap + column * (cardWidth + gap);
    const y = 22 + gap + row * (cardHeight + gap);
    const qrSize = 300;
    const qr = QRCode.create(share, { errorCorrectionLevel: "L" });
    const modules = qr.modules.size;
    const moduleSize = (qrSize - 20) / (modules + 8);
    const offset = 10 + moduleSize * 4;
    const cells: string[] = [];
    for (let moduleRow = 0; moduleRow < modules; moduleRow += 1) {
      for (let moduleColumn = 0; moduleColumn < modules; moduleColumn += 1) {
        if (qr.modules.data[moduleRow * modules + moduleColumn]) {
          cells.push(
            `<rect x="${(x + 40 + offset + moduleColumn * moduleSize).toFixed(2)}" y="${(
              y + 38 + offset + moduleRow * moduleSize
            ).toFixed(2)}" width="${moduleSize.toFixed(2)}" height="${moduleSize.toFixed(2)}"/>`,
          );
        }
      }
    }
    return [
      `<g>`,
      `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#f8fafc" stroke="#0e7490" stroke-width="2" stroke-dasharray="6 4"/>`,
      `<text x="${x + 14}" y="${y + 22}" font-family="ui-monospace, monospace" font-size="13" font-weight="700" fill="#0e7490">SCM TOKEN SHARE ${index + 1}/${total}</text>`,
      `<g fill="#0b1220">${cells.join("")}</g>`,
      `<text x="${x + 14}" y="${y + cardHeight - 30}" font-family="ui-monospace, monospace" font-size="11" fill="#334155">${threshold}-of-${total} required · cut and store separately</text>`,
      `<text x="${x + 14}" y="${y + cardHeight - 12}" font-family="ui-monospace, monospace" font-size="10" fill="#64748b">${escapeXml(label)}</text>`,
      `</g>`,
    ].join("");
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#e2e8f0"/>`,
    `<text x="${gap}" y="16" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="700" fill="#0f172a">SCM TOKEN SHARE CARDS · ${threshold}-of-${total}</text>`,
    ...cards,
    `</svg>`,
  ].join("");

  return new Blob([svg], { type: "image/svg+xml" });
}
