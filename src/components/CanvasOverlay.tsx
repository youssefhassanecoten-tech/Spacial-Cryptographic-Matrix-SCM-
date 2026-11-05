import {
  Anchor,
  Grid3X3,
  Rotate3D,
  Route,
  ShieldAlert,
} from "lucide-react";
import { VOXEL_COUNT } from "../types";
import { useStudio } from "../store/useStudio";
import { IconButton } from "./ui";

const GEOMETRY_LABEL = {
  classic: "Classic voxel",
  maze: "Maze geometry",
  polyhedral: "Polyhedral art",
} as const;

const MATERIAL_LABEL = {
  matte: "Matte",
  metallic: "Metallic",
  glass: "Glass",
  neon: "Neon",
} as const;

export function CanvasOverlay() {
  const design = useStudio((state) => state.design);
  const matrix = useStudio((state) => state.matrix);
  const setDesign = useStudio((state) => state.setDesign);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#050910]/75 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-300 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
            live viewport
          </span>
          <span className="rounded-lg border border-white/10 bg-[#050910]/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400 backdrop-blur">
            lattice 9³ · {VOXEL_COUNT}
          </span>
          <span className="rounded-lg border border-white/10 bg-[#050910]/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400 backdrop-blur">
            active <span className="text-cyan-300">{matrix.activeCount}</span>
          </span>
          <span className="rounded-lg border border-white/10 bg-[#050910]/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400 backdrop-blur">
            {GEOMETRY_LABEL[design.geometry]} · {MATERIAL_LABEL[design.material]}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-[#050910]/75 p-1 backdrop-blur">
          <IconButton
            label="Contrast guard"
            active={design.contrastGuard}
            onClick={() => setDesign({ contrastGuard: !design.contrastGuard })}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Show hidden anchors"
            active={design.showAnchors}
            onClick={() => setDesign({ showAnchors: !design.showAnchors })}
          >
            <Anchor className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Token trajectory"
            active={design.showTrajectory}
            onClick={() => setDesign({ showTrajectory: !design.showTrajectory })}
          >
            <Route className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Macro block cage"
            active={design.showGrid}
            onClick={() => setDesign({ showGrid: !design.showGrid })}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Auto orbit"
            active={design.autoRotate}
            onClick={() => setDesign({ autoRotate: !design.autoRotate })}
          >
            <Rotate3D className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="pointer-events-none">
          {design.contrastGuard ? (
            <div className="rounded-lg border border-amber-400/20 bg-[#0b0803]/80 p-2 backdrop-blur">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-amber-200">
                <ShieldAlert className="h-3 w-3" />
                Contrast guard active
              </div>
              <div className="mt-1 h-1.5 w-40 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-cyan-300" />
              <div className="mt-1 flex justify-between font-mono text-[8px] text-slate-500">
                <span>buried / low depth</span>
                <span>exposed</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.07] bg-[#050910]/55 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-slate-500 backdrop-blur">
              {matrix.anchors.length} anchors ·{" "}
              {matrix.path.length} path cells · {design.gradient} gradient
            </div>
          )}
        </div>
        <div className="hidden rounded-lg border border-white/[0.07] bg-[#050910]/55 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-slate-500 backdrop-blur sm:block">
          drag orbit · scroll zoom · pitch bounded
        </div>
      </div>
    </div>
  );
}
