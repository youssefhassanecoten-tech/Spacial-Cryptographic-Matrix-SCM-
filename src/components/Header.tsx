import { useState } from "react";
import {
  Boxes,
  KeyRound,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Share2,
} from "lucide-react";
import { copyText } from "../lib/clipboard";
import { getAppBaseUrl } from "../lib/crypto";
import { buildGuestLink } from "../lib/vault";
import { useStudio } from "../store/useStudio";
import { Badge, Button, IconButton } from "./ui";

export function Header() {
  const matrix = useStudio((state) => state.matrix);
  const shapeToken = useStudio((state) => state.shapeToken);
  const tokenStatus = useStudio((state) => state.tokenStatus);
  const sealed = useStudio((state) => state.sealed);
  const guestMode = useStudio((state) => state.guestMode);
  const sidebarCollapsed = useStudio((state) => state.sidebarCollapsed);
  const setTab = useStudio((state) => state.setTab);
  const newSCM = useStudio((state) => state.newSCM);
  const toggleSidebar = useStudio((state) => state.toggleSidebar);
  const notify = useStudio((state) => state.notify);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!shapeToken) {
      notify("Shape token is still being generated.", "error");
      return;
    }
    const ok = await copyText(buildGuestLink(shapeToken));
    notify(
      ok
        ? "Guest shape link copied. Recipients still need the private ID token to unlock content."
        : "Clipboard access denied.",
      ok ? "success" : "error",
    );
  };

  const create = async () => {
    setBusy(true);
    await newSCM();
    setBusy(false);
  };

  const goHome = () => {
    if (guestMode) {
      window.location.href = getAppBaseUrl();
      return;
    }
    setTab("design");
  };

  const statusTone =
    tokenStatus === "ready"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : tokenStatus === "syncing"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
        : tokenStatus === "idle"
          ? "border-slate-400/25 bg-slate-400/10 text-slate-300"
          : "border-rose-400/25 bg-rose-400/10 text-rose-200";

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#060a12]/85 px-3 backdrop-blur-xl md:gap-3 md:px-4">
      <button
        type="button"
        onClick={goHome}
        title={guestMode ? "Return to SCM Studio home" : "Studio home"}
        className="flex min-w-0 items-center gap-2.5 rounded-xl text-left transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 via-violet-400/10 to-rose-400/20 ring-1 ring-cyan-300/30">
          <Boxes className="h-4 w-4 text-cyan-200" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_2px] shadow-emerald-300/50" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[13px] font-bold tracking-[0.16em] text-slate-100">
            SCM STUDIO
          </h1>
          <p className="hidden truncate font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500 sm:block">
            3D cryptographic matrix · phase 7
          </p>
        </div>
      </button>

      {!guestMode ? (
        <div className="ml-2 hidden items-center gap-2 lg:flex">
          <Badge tone="cyan">{matrix.gridSize}³ lattice</Badge>
          <Badge tone="violet">{matrix.activeCount} voxels</Badge>
          <span className="max-w-40 truncate font-mono text-[9px] text-slate-500">
            {matrix.label}
          </span>
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        {!guestMode ? (
          <>
            <IconButton
              label={sidebarCollapsed ? "Open studio sidebar" : "Collapse studio sidebar"}
              onClick={toggleSidebar}
              active={!sidebarCollapsed}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" />
              )}
            </IconButton>
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-wider sm:flex ${statusTone}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  tokenStatus === "ready"
                    ? "bg-emerald-300"
                    : tokenStatus === "syncing"
                      ? "animate-pulse bg-amber-300"
                      : tokenStatus === "idle"
                        ? "bg-slate-300"
                        : "bg-rose-300"
                }`}
              />
              {sealed ? "SCM sealed" : tokenStatus === "ready" ? "shape ready" : tokenStatus}
            </span>
            <IconButton label="Share guest shape link" onClick={() => void share()}>
              <Share2 className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label="Unlock with ID token"
              onClick={() => setTab("decrypt")}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </IconButton>
            <Button
              size="sm"
              variant="primary"
              className="max-sm:hidden"
              onClick={() => void create()}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              New SCM
            </Button>
            <IconButton
              label="Create new SCM"
              className="sm:hidden"
              onClick={() => void create()}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </IconButton>
          </>
        ) : (
          <Badge tone="cyan">guest viewer</Badge>
        )}
      </div>
    </header>
  );
}
