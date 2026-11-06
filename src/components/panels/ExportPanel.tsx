import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileBox,
  FileText,
  Grid3X3,
  Image,
  LoaderCircle,
  QrCode,
  ScanText,
  Share2,
} from "lucide-react";
import type { ExportOptions } from "../../types";
import type { FaceId } from "../../lib/exporters/vector";
import { buildGuestLink } from "../../lib/vault";
import { copyText } from "../../lib/clipboard";
import {
  downloadBlob,
  downloadDataUrl,
  downloadText,
  safeFilename,
} from "../../lib/download";
import {
  estimateExport,
  exportObj,
  exportStl,
} from "../../lib/exporters/model";
import {
  buildAllFaceMaps,
  contactSheetPngDataUrl,
  faceMapPngDataUrl,
  faceMapSvg,
  faceMapSvgDataUrl,
} from "../../lib/exporters/vector";
import {
  buildDigitalCardDataUrl,
  generateQrDataUrl,
  generateQrSvg,
} from "../../lib/qr";
import { useStudio } from "../../store/useStudio";
import {
  Badge,
  Button,
  PanelSection,
  Segmented,
  Slider,
  StatRow,
  Toggle,
} from "../ui";

const FACE_OPTIONS: Array<{ value: FaceId; label: string }> = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

export function ExportPanel() {
  const matrix = useStudio((state) => state.matrix);
  const design = useStudio((state) => state.design);
  const token = useStudio((state) => state.token);
  const shapeToken = useStudio((state) => state.shapeToken);
  const sealedStats = useStudio((state) => state.sealedStats);
  const packageBlob = useStudio((state) => state.packageBlob);
  const notify = useStudio((state) => state.notify);
  const [modelOptions, setModelOptions] = useState<ExportOptions>({
    includeBasePlate: true,
    baseThickness: 1.2,
    scale: 4,
  });
  const [faceId, setFaceId] = useState<FaceId>("front");
  const [qrUrl, setQrUrl] = useState("");
  const [qrState, setQrState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [cardUrl, setCardUrl] = useState("");
  const [cardState, setCardState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [copied, setCopied] = useState(false);

  const link = useMemo(
    () => (shapeToken ? buildGuestLink(shapeToken) : ""),
    [shapeToken],
  );
  const faceMaps = useMemo(() => buildAllFaceMaps(matrix, design), [matrix, design]);
  const selectedFace = faceMaps.find((map) => map.def.id === faceId) ?? faceMaps[0];
  const facePreview = useMemo(
    () => faceMapSvgDataUrl(selectedFace, 900),
    [selectedFace],
  );
  const estimate = useMemo(
    () => estimateExport(matrix, modelOptions),
    [matrix, modelOptions],
  );
  const baseName = safeFilename(matrix.label);

  useEffect(() => {
    setCardUrl("");
    setCardState("idle");
  }, [shapeToken]);

  useEffect(() => {
    if (!link) {
      return;
    }
    let cancelled = false;
    setQrState("loading");
    generateQrDataUrl(link, 560)
      .then((url) => {
        if (!cancelled) {
          setQrUrl(url);
          setQrState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  const handleCopy = async (value: string, label: string) => {
    if (!value) {
      notify("Nothing to copy yet.", "error");
      return;
    }
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      notify(`${label} copied to clipboard.`, "success");
    } else {
      notify("Clipboard access was denied.", "error");
    }
  };

  const downloadCard = async () => {
    if (!shapeToken) {
      return;
    }
    setCardState("loading");
    try {
      const url =
        cardUrl ||
        (await buildDigitalCardDataUrl({ link, shapeToken, matrix }));
      setCardUrl(url);
      setCardState("ready");
      downloadDataUrl(url, `${baseName}-digital-card.png`);
      notify("Digital card exported.", "success");
    } catch {
      setCardState("error");
      notify("Could not render the digital card.", "error");
    }
  };

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<FileBox className="h-3.5 w-3.5" />}
        title="3D Print Export"
        hint="Exports active voxels as solid raised blocks on an optional base plate."
        action={<Badge tone="cyan">{estimate.triangles} tri</Badge>}
      >
        <div className="space-y-2.5">
          <Toggle
            compact
            label="Base plate"
            description="Solid plinth sized to the 9 × 9 footprint"
            checked={modelOptions.includeBasePlate}
            onChange={(includeBasePlate) =>
              setModelOptions((options) => ({ ...options, includeBasePlate }))
            }
          />
          <div className="grid grid-cols-2 gap-2.5">
            <Slider
              label="Cell scale"
              value={modelOptions.scale}
              min={1}
              max={12}
              step={0.5}
              onChange={(scale) => setModelOptions((options) => ({ ...options, scale }))}
              format={(value) => `${value.toFixed(1)} mm`}
            />
            <Slider
              label="Plate depth"
              value={modelOptions.baseThickness}
              min={0.4}
              max={4}
              step={0.1}
              onChange={(baseThickness) =>
                setModelOptions((options) => ({ ...options, baseThickness }))
              }
              format={(value) => `${value.toFixed(1)} mm`}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                downloadBlob(
                  exportStl(matrix, modelOptions),
                  `${baseName}.stl`,
                );
                notify("Binary STL exported.", "success");
              }}
            >
              <Download className="h-3 w-3" />
              STL
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                downloadText(
                  exportObj(matrix, modelOptions),
                  `${baseName}.obj`,
                  "text/plain;charset=utf-8",
                );
                notify("Wavefront OBJ exported.", "success");
              }}
            >
              <Download className="h-3 w-3" />
              OBJ
            </Button>
          </div>
          <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
            <StatRow label="Active voxels" value={estimate.voxels} tone="cyan" />
            <StatRow label="Triangles" value={estimate.triangles} />
            <StatRow label="Vertices" value={estimate.vertices} />
            <StatRow
              label="Footprint"
              value={`${(9 * modelOptions.scale + 2 * modelOptions.scale * 0.6).toFixed(
                1,
              )} × ${(9 * modelOptions.scale + 2 * modelOptions.scale * 0.6).toFixed(1)} mm`}
            />
          </div>
        </div>
      </PanelSection>

      <PanelSection
        icon={<ScanText className="h-3.5 w-3.5" />}
        title="2D Face Projections"
        hint="Distinct orthogonal face maps rendered from the current gradient and material palette."
      >
        <Segmented
          value={faceId}
          onChange={setFaceId}
          options={FACE_OPTIONS}
          columns={3}
        />
        <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.08] bg-black/30">
          <img
            src={facePreview}
            alt={`${selectedFace.def.label} orthographic face map`}
            className="block w-full"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              downloadText(
                faceMapSvg(selectedFace, 2048),
                `${baseName}-${selectedFace.def.id}.svg`,
                "image/svg+xml;charset=utf-8",
              );
              notify("Face SVG exported.", "success");
            }}
          >
            <FileText className="h-3 w-3" />
            SVG
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              downloadDataUrl(
                faceMapPngDataUrl(selectedFace, 2048),
                `${baseName}-${selectedFace.def.id}.png`,
              );
              notify("2048px face PNG exported.", "success");
            }}
          >
            <Image className="h-3 w-3" />
            PNG
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-1.5 w-full"
          onClick={() => {
            downloadDataUrl(
              contactSheetPngDataUrl(faceMaps, 2400),
              `${baseName}-face-sheet.png`,
            );
            notify("Six-face contact sheet exported.", "success");
          }}
        >
          <Grid3X3 className="h-3 w-3" />
          All six faces · contact sheet
        </Button>
      </PanelSection>

      <PanelSection
        icon={<QrCode className="h-3.5 w-3.5" />}
        title="SCM Digital Card"
        hint="A public shape QR. Scanning opens the guest viewer, assembles the matrix, and locks all content behind the Input Token window."
        action={
          <Badge tone={qrState === "ready" ? "emerald" : qrState === "error" ? "rose" : "amber"}>
            {qrState === "ready" ? "ready" : qrState === "loading" ? "sealing" : "pending"}
          </Badge>
        }
      >
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="relative min-h-24 overflow-hidden rounded-lg border border-white/[0.08] bg-[#070a12] p-2">
            {qrUrl ? (
              <img src={qrUrl} alt="SCM digital card QR code" className="mx-auto w-full max-w-[210px]" />
            ) : (
              <div className="flex h-full min-h-24 items-center justify-center text-slate-600">
                {qrState === "error" ? (
                  <span className="text-[10px] text-rose-300">QR generation failed</span>
                ) : (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!qrUrl) return;
                downloadDataUrl(qrUrl, `${baseName}-qr.png`);
                notify("QR PNG exported.", "success");
              }}
            >
              <Download className="h-3 w-3" />
              PNG
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const svg = await generateQrSvg(link);
                  downloadText(svg, `${baseName}-qr.svg`, "image/svg+xml;charset=utf-8");
                  notify("QR SVG exported.", "success");
                } catch {
                  notify("QR SVG generation failed.", "error");
                }
              }}
            >
              <Download className="h-3 w-3" />
              SVG
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => handleCopy(link, "Share link")}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Link
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={downloadCard}
            disabled={!shapeToken || cardState === "loading"}
          >
            {cardState === "loading" ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <Share2 className="h-3 w-3" />
            )}
            Download digital card
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(link || "#", "_blank", "noopener,noreferrer")}
            disabled={!shapeToken}
          >
            <ExternalLink className="h-3 w-3" />
            Open guest page
          </Button>
        </div>
        <p className="mt-2 break-all rounded-md border border-white/[0.05] bg-black/25 p-2 font-mono text-[8px] leading-relaxed text-slate-500">
          {link || "Shape link will appear after the token engine finishes."}
        </p>
        <p className="mt-2 rounded-md border border-cyan-400/20 bg-cyan-400/[0.06] p-2 text-[9px] leading-relaxed text-cyan-100/80">
          The QR code contains only the public shape token. Content stays locked in the
          guest viewer until the private ID token is entered.
        </p>
        {sealedStats && sealedStats.packageSize > 0 ? (
          <p className="mt-2 rounded-md border border-amber-400/20 bg-amber-400/[0.06] p-2 text-[9px] leading-relaxed text-amber-200/80">
            This SCM has packaged file items. Share the encrypted{" "}
            <span className="font-mono">.scm</span> package with the QR code.
            {packageBlob ? "" : " The package is not in this session."}
          </p>
        ) : null}
        {cardUrl ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.08] bg-black/30">
            <img src={cardUrl} alt="SCM digital card preview" className="block w-full" />
          </div>
        ) : null}
      </PanelSection>

      <PanelSection
        icon={<FileText className="h-3.5 w-3.5" />}
        title="Private Token & Package"
        hint="Keep these separate from the public QR. The private token is the decryption key."
        action={<Badge tone="violet">{token ? `${token.length} chars` : "empty"}</Badge>}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => handleCopy(token, "Private token")}>
            <Copy className="h-3 w-3" />
            Copy private token
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadText(token, `${baseName}.scm1.txt`, "text/plain;charset=utf-8")
            }
            disabled={!token}
          >
            <Download className="h-3 w-3" />
            Save private token
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-1.5 w-full"
          disabled={!packageBlob}
          onClick={() => {
            if (!packageBlob) return;
            void downloadBlob(packageBlob, `${baseName}.scm`);
            notify("Encrypted package exported.", "success");
          }}
        >
          <Download className="h-3 w-3" />
          Download .scm package
        </Button>
      </PanelSection>
    </div>
  );
}
