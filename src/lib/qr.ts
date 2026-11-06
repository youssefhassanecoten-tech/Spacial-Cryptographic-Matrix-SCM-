import QRCode from "qrcode";
import type { SCMMatrix } from "../types";
import { tokenFingerprint } from "./crypto";

export async function generateQrDataUrl(link: string, size = 512): Promise<string> {
  return QRCode.toDataURL(link, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: {
      dark: "#e2e8f0",
      light: "#070a12",
    },
  });
}

export async function generateQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: {
      dark: "#e2e8f0",
      light: "#070a12",
    },
  });
}

function roundRect(
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

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the generated QR image."));
    image.src = source;
  });
}

export interface CardOptions {
  link: string;
  shapeToken: string;
  matrix: SCMMatrix;
}

export async function buildDigitalCardDataUrl(options: CardOptions): Promise<string> {
  const { link, shapeToken, matrix } = options;
  const width = 1000;
  const height = 1400;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas is unavailable in this browser.");
  }

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#04060c");
  background.addColorStop(0.5, "#070c18");
  background.addColorStop(1, "#0d1024");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  const accent = ctx.createLinearGradient(0, 0, width, 0);
  accent.addColorStop(0, "#22d3ee");
  accent.addColorStop(0.55, "#a78bfa");
  accent.addColorStop(1, "#fb7185");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, 6);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 52px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("SCM DIGITAL SHAPE CARD", 72, 110);
  ctx.fillStyle = "#5eead4";
  ctx.font = "500 22px ui-monospace, monospace";
  ctx.fillText("PUBLIC SHAPE · SCAN TO VIEW · ENTER ID TOKEN TO UNLOCK", 72, 152);

  const qrSize = 720;
  const qrX = (width - qrSize) / 2;
  const qrY = 220;
  roundRect(ctx, qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 48);
  ctx.fillStyle = "#0a1220";
  ctx.fill();
  ctx.strokeStyle = "rgba(94,234,212,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const qr = await loadImage(await generateQrDataUrl(link, qrSize));
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 44px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(matrix.label.slice(0, 34), 72, 1075);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 22px ui-monospace, monospace";
  ctx.fillText(`MATRIX ID · ${matrix.id}`, 72, 1118);
  ctx.fillText(
    `ANCHORS · ${matrix.anchors.map((anchor) => `[${anchor.coord.join(",")}]`).join("  ")}`,
    72,
    1156,
  );
  ctx.fillStyle = "#5eead4";
  ctx.font = "500 22px ui-monospace, monospace";
  ctx.fillText(`SHAPE FINGERPRINT · ${tokenFingerprint(shapeToken)}`, 72, 1194);

  roundRect(ctx, 72, 1240, width - 144, 80, 18);
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.16)";
  ctx.stroke();
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 17px ui-monospace, monospace";
  const shortToken = `${shapeToken.slice(0, 62)}…${shapeToken.slice(-18)}`;
  ctx.fillText(shortToken, 96, 1288);

  ctx.fillStyle = "#475569";
  ctx.font = "500 18px ui-monospace, monospace";
  ctx.fillText("SCM STUDIO · LOCAL-FIRST 3D CRYPTOGRAPHIC INFORMATION", 72, 1356);
  ctx.textAlign = "right";
  ctx.fillText("SCAN · INSPECT · UNLOCK", width - 72, 1356);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}
