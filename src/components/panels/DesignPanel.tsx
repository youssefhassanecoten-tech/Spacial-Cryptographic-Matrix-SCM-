import {
  Anchor,
  ArrowDown,
  Box,
  CircleDot,
  Droplets,
  Gem,
  Grid3X3,
  Layers,
  Lock,
  Palette,
  Radar,
  Rotate3D,
  Route,
  ShieldAlert,
  Sparkles,
  Waypoints,
  Zap,
} from "lucide-react";
import type { GeometryStyle, MaterialType } from "../../types";
import { VOXEL_COUNT } from "../../types";
import { PALETTES } from "../../lib/palettes";
import { anchorPhysicalCenters } from "../../lib/scm";
import { useStudio } from "../../store/useStudio";
import {
  Badge,
  ColorInput,
  PanelSection,
  Segmented,
  Slider,
  StatRow,
  Toggle,
} from "../ui";

const GEOMETRY_HINTS: Record<GeometryStyle, string> = {
  classic: "Sharp voxel cells. Fastest to scan and the most literal matrix read.",
  maze: "Adjacent data voxels become continuous 3D pipes with joint nodes.",
  polyhedral: "Mixed prisms, pyramids, and faceted solids assigned by the PRNG.",
};

const MATERIAL_HINTS: Record<MaterialType, string> = {
  matte: "High-roughness surface tuned for physical scannability.",
  metallic: "Polished metal with directional specular highlights.",
  glass: "Refractive transmission with tinted depth and clearcoat.",
  neon: "Emissive instance glow routed through the bloom pipeline.",
};

export function DesignPanel() {
  const design = useStudio((state) => state.design);
  const matrix = useStudio((state) => state.matrix);
  const setDesign = useStudio((state) => state.setDesign);
  const centers = anchorPhysicalCenters(matrix, 1);

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<Box className="h-3.5 w-3.5" />}
        title="Geometry Style"
        hint={GEOMETRY_HINTS[design.geometry]}
      >
        <Segmented
          value={design.geometry}
          onChange={(geometry) => setDesign({ geometry })}
          options={[
            { value: "classic", label: "Voxel", icon: <Box className="h-3.5 w-3.5" /> },
            { value: "maze", label: "Maze", icon: <Waypoints className="h-3.5 w-3.5" /> },
            { value: "polyhedral", label: "Poly", icon: <Gem className="h-3.5 w-3.5" /> },
          ]}
        />
      </PanelSection>

      <PanelSection
        icon={<Layers className="h-3.5 w-3.5" />}
        title="Surface Fill"
        hint={MATERIAL_HINTS[design.material]}
      >
        <Segmented
          value={design.material}
          onChange={(material) => setDesign({ material })}
          options={[
            { value: "matte", label: "Matte", icon: <Layers className="h-3.5 w-3.5" /> },
            { value: "metallic", label: "Metal", icon: <Sparkles className="h-3.5 w-3.5" /> },
            { value: "glass", label: "Glass", icon: <Droplets className="h-3.5 w-3.5" /> },
            { value: "neon", label: "Neon", icon: <Zap className="h-3.5 w-3.5" /> },
          ]}
          columns={4}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Slider
            label="Roughness"
            value={design.roughness}
            min={0}
            max={1}
            onChange={(roughness) => setDesign({ roughness })}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="Metalness"
            value={design.metalness}
            min={0}
            max={1}
            onChange={(metalness) => setDesign({ metalness })}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="Opacity"
            value={design.opacity}
            min={0.35}
            max={1}
            onChange={(opacity) => setDesign({ opacity })}
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <Slider
            label="Emission"
            value={design.glow}
            min={0}
            max={1.2}
            onChange={(glow) => setDesign({ glow })}
            format={(value) => value.toFixed(2)}
          />
        </div>
      </PanelSection>

      <PanelSection
        icon={<Palette className="h-3.5 w-3.5" />}
        title="3D Gradient"
        hint="Spatial color fields are applied per voxel without altering any data bit."
      >
        <Segmented
          value={design.gradient}
          onChange={(gradient) => setDesign({ gradient })}
          options={[
            { value: "none", label: "Flat", icon: <CircleDot className="h-3.5 w-3.5" /> },
            { value: "linear", label: "Linear Z", icon: <ArrowDown className="h-3.5 w-3.5" /> },
            { value: "radial", label: "Radial", icon: <Radar className="h-3.5 w-3.5" /> },
          ]}
        />
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {PALETTES.map((palette) => {
            const selected =
              palette.a === design.colorA &&
              palette.b === design.colorB &&
              palette.c === design.colorC &&
              palette.base === design.colorBase;
            return (
              <button
                key={palette.name}
                type="button"
                title={palette.name}
                onClick={() =>
                  setDesign({
                    colorA: palette.a,
                    colorB: palette.b,
                    colorC: palette.c,
                    colorBase: palette.base,
                  })
                }
                className={`group rounded-lg border p-1 transition-all ${
                  selected
                    ? "border-cyan-400/60 bg-cyan-400/10"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <span
                  className="block h-5 w-full rounded"
                  style={{
                    background: `linear-gradient(135deg, ${palette.a}, ${palette.b}, ${palette.c})`,
                  }}
                />
                <span className="mt-1 block truncate text-center text-[8px] uppercase tracking-wider text-slate-500 group-hover:text-slate-300">
                  {palette.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ColorInput
            label="Base"
            value={design.colorBase}
            onChange={(colorBase) => setDesign({ colorBase })}
          />
          <ColorInput
            label="Stop A"
            value={design.colorA}
            onChange={(colorA) => setDesign({ colorA })}
          />
          <ColorInput
            label="Stop B"
            value={design.colorB}
            onChange={(colorB) => setDesign({ colorB })}
          />
          <ColorInput
            label="Stop C"
            value={design.colorC}
            onChange={(colorC) => setDesign({ colorC })}
          />
        </div>
      </PanelSection>

      <PanelSection
        icon={<Grid3X3 className="h-3.5 w-3.5" />}
        title="Viewport Overlays"
        hint="Studio diagnostics never feed back into the cryptographic layer."
      >
        <div className="space-y-1.5">
          <Toggle
            compact
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            label="Contrast guard"
            description="Heatmap low-exposure voxels"
            checked={design.contrastGuard}
            onChange={(contrastGuard) => setDesign({ contrastGuard })}
          />
          <Toggle
            compact
            icon={<Anchor className="h-3.5 w-3.5" />}
            label="Hidden anchors"
            description="Reveal alignment anchor markers"
            checked={design.showAnchors}
            onChange={(showAnchors) => setDesign({ showAnchors })}
          />
          <Toggle
            compact
            icon={<Route className="h-3.5 w-3.5" />}
            label="Token trajectory"
            description="Trace the decrypted anchor path"
            checked={design.showTrajectory}
            onChange={(showTrajectory) => setDesign({ showTrajectory })}
          />
          <Toggle
            compact
            icon={<Grid3X3 className="h-3.5 w-3.5" />}
            label="Macro block cage"
            description="27 × 3³ structural blocks"
            checked={design.showGrid}
            onChange={(showGrid) => setDesign({ showGrid })}
          />
          <Toggle
            compact
            icon={<Rotate3D className="h-3.5 w-3.5" />}
            label="Auto orbit"
            description="Slow cinematic camera rotation"
            checked={design.autoRotate}
            onChange={(autoRotate) => setDesign({ autoRotate })}
          />
        </div>
        {design.contrastGuard ? (
          <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2">
            <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider">
              <span className="text-rose-300">Low depth</span>
              <span className="text-amber-300">Mid</span>
              <span className="text-cyan-300">Exposed</span>
            </div>
            <div className="h-1.5 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-cyan-300" />
          </div>
        ) : null}
      </PanelSection>

      <PanelSection
        icon={<Lock className="h-3.5 w-3.5" />}
        title="Alignment Lock"
        hint="Anchor coordinates and physical centers are immutable under render customization."
        action={<Badge tone="emerald">locked</Badge>}
      >
        <div className="space-y-1">
          {matrix.anchors.map((anchor, index) => (
            <div
              key={anchor.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.05] bg-black/20 px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                <span className="text-[10px] text-slate-300">{anchor.label}</span>
              </div>
              <span className="font-mono text-[9px] text-slate-500">
                grid [{anchor.coord.join(",")}] · world [
                {centers[index].map((value) => value.toFixed(0)).join(",")}]
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <StatRow
            label="Active voxels"
            value={`${matrix.activeCount} / ${VOXEL_COUNT}`}
            tone="cyan"
          />
          <StatRow label="Alignment path" value={`${matrix.path.length} cells`} />
          <StatRow
            label="PRNG seed"
            value={`0x${matrix.seed.toString(16).padStart(8, "0")}`}
          />
        </div>
      </PanelSection>
    </div>
  );
}
