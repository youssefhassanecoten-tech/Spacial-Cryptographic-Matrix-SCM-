import { useState } from "react";
import {
  Boxes,
  KeyRound,
  LoaderCircle,
  Plus,
  Share2,
} from "lucide-react";
import { copyText } from "../lib/clipboard";
import { buildShareLink } from "../lib/crypto";
import { useStudio } from "../store/useStudio";
import { Badge, Button, IconButton } from "./ui";

export function Header() {
  const matrix = useStudio((state) => state.matrix);
  const token = useStudio((state) => state.token);
  const tokenStatus = useStudio((state) => state.tokenStatus);
  const setTab = useStudio((state) => state.setTab);
  const generateNewToken = useStudio((state) => state.generateNewToken);
  const notify = useStudio((state) => state.notify);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!token) {
      notify("Token is still sealing. Try again in a moment.", "error");
      return;
    }
    const ok = await copyText(buildShareLink(token));
    notify(
      ok ? "Share link copied — scanning it opens the 3D viewer." : "Clipboard access denied.",
      ok ? "success" : "error",
    );
  };

  const create = async () => {
    setBusy(true);
    await generateNewToken(`Lattice ${new Date().toLocaleDateString()}`);
    setBusy(false);
  };

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#060a12]/85 px-3 backdrop-blur-xl md:gap-3 md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 via-violet-400/10 to-rose-400/20 ring-1 ring-cyan-300/30">
          <Boxes className="h-4 w-4 text-cyan-200" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_2px] shadow-emerald-300/50" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[13px] font-bold tracking-[0.16em] text-slate-100">
            SCM STUDIO
          </h1>
          <p className="hidden truncate font-mono text-[8px] uppercase tracking-[0.18em] text-slate-500 sm:block">
            3D cryptographic matrix · phase 4
          </p>
        </div>
      </div>

      <div className="ml-2 hidden items-center gap-2 lg:flex">
        <Badge tone="cyan">9³ lattice</Badge>
        <Badge tone="violet">{matrix.activeCount} voxels</Badge>
        <span className="max-w-40 truncate font-mono text-[9px] text-slate-500">
          {matrix.label}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span
          className={`hidden items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-wider sm:flex ${
            tokenStatus === "ready"
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
              : tokenStatus === "syncing"
                ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
                : "border-rose-400/25 bg-rose-400/10 text-rose-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              tokenStatus === "ready"
                ? "bg-emerald-300"
                : tokenStatus === "syncing"
                  ? "animate-pulse bg-amber-300"
                  : "bg-rose-300"
            }`}
          />
          {tokenStatus === "ready" ? "token sealed" : tokenStatus}
        </span>
        <IconButton label="Share digital card" onClick={() => void share()}>
          <Share2 className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Load token" onClick={() => setTab("token")}>
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
          New token
        </Button>
        <IconButton
          label="Generate new token"
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
      </div>
    </header>
  );
}
