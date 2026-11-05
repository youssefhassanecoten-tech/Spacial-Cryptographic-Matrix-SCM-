import type { ReactNode } from "react";
import {
  Activity,
  Download,
  FlaskConical,
  KeyRound,
  Palette,
} from "lucide-react";
import type { StudioTab } from "../types";
import { VOXEL_COUNT } from "../types";
import { useStudio } from "../store/useStudio";
import { AnimatePanel } from "./panels/AnimatePanel";
import { DesignPanel } from "./panels/DesignPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { TokenPanel } from "./panels/TokenPanel";
import { VerifyPanel } from "./panels/VerifyPanel";
import { Badge } from "./ui";

const TABS: Array<{ id: StudioTab; label: string; icon: ReactNode }> = [
  { id: "design", label: "Design", icon: <Palette className="h-3.5 w-3.5" /> },
  { id: "animate", label: "Animate", icon: <Activity className="h-3.5 w-3.5" /> },
  { id: "export", label: "Export", icon: <Download className="h-3.5 w-3.5" /> },
  { id: "verify", label: "Verify", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { id: "token", label: "Token", icon: <KeyRound className="h-3.5 w-3.5" /> },
];

function TabContent({ tab }: { tab: StudioTab }) {
  switch (tab) {
    case "design":
      return <DesignPanel />;
    case "animate":
      return <AnimatePanel />;
    case "export":
      return <ExportPanel />;
    case "verify":
      return <VerifyPanel />;
    case "token":
      return <TokenPanel />;
    default:
      return null;
  }
}

export function StudioPanel() {
  const activeTab = useStudio((state) => state.activeTab);
  const setTab = useStudio((state) => state.setTab);
  const matrix = useStudio((state) => state.matrix);
  const tokenStatus = useStudio((state) => state.tokenStatus);
  const design = useStudio((state) => state.design);
  const layers = useStudio((state) => state.layers);
  const enabledLayers = layers.filter((layer) => layer.enabled).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.06] px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-400">
                Studio Control Deck
              </span>
            </div>
            <h2 className="mt-1 truncate text-sm font-semibold text-slate-100">
              {matrix.label}
            </h2>
            <p className="mt-0.5 truncate font-mono text-[9px] text-slate-500">
              {matrix.id} · {matrix.activeCount}/{VOXEL_COUNT} active · {enabledLayers} layers
            </p>
          </div>
          <Badge
            tone={
              tokenStatus === "ready"
                ? "emerald"
                : tokenStatus === "syncing"
                  ? "amber"
                  : "rose"
            }
          >
            {tokenStatus === "ready" ? "sealed" : tokenStatus}
          </Badge>
        </div>
      </div>

      <div className="border-b border-white/[0.06] p-1.5">
        <div className="grid grid-cols-5 gap-1">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] font-medium transition-all ${
                  active
                    ? "bg-cyan-400/12 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.28)]"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                }`}
              >
                <span className={active ? "text-cyan-300" : "text-slate-600"}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="scm-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <TabContent tab={activeTab} />
      </div>

      <div className="border-t border-white/[0.06] px-3 py-1.5">
        <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-slate-600">
          <span>{design.geometry} · {design.material} · {design.gradient}</span>
          <span>local-first</span>
        </div>
      </div>
    </div>
  );
}
