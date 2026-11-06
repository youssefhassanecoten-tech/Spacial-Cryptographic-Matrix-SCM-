import { useEffect } from "react";
import {
  ArrowUpRight,
  Download,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { refreshPwaForUpdate, updateDownloadUrl } from "../lib/updates";
import { useStudio } from "../store/useStudio";
import { useUpdates } from "../store/useUpdates";
import { Badge, Button } from "./ui";

function openUpdate(): void {
  const state = useUpdates.getState();
  if (!state.manifest) {
    return;
  }
  if (state.platform === "web") {
    void refreshPwaForUpdate();
    return;
  }
  const url = updateDownloadUrl(state.manifest, state.platform);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function UpdateManager() {
  const platform = useUpdates((state) => state.platform);
  const manifest = useUpdates((state) => state.manifest);
  const kind = useUpdates((state) => state.kind);
  const checking = useUpdates((state) => state.checking);
  const dismissed = useUpdates((state) => state.dismissed);
  const check = useUpdates((state) => state.check);
  const dismiss = useUpdates((state) => state.dismiss);
  const notify = useStudio((state) => state.notify);

  useEffect(() => {
    void check();
    const interval = window.setInterval(() => void check(), 6 * 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [check]);

  useEffect(() => {
    if (platform !== "web" || kind !== "minor" || !manifest) {
      return;
    }
    const key = `scm-auto-update-${manifest.version}`;
    try {
      if (window.sessionStorage.getItem(key)) {
        return;
      }
      window.sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    notify(`Updating SCM Studio to v${manifest.version}…`, "info");
    const timer = window.setTimeout(() => {
      void refreshPwaForUpdate();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [platform, kind, manifest, notify]);

  if (!manifest || kind === "none" || dismissed || platform === "desktop") {
    return null;
  }

  if (kind === "major") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#02050b]/80 p-4 backdrop-blur-md">
        <div className="w-full max-w-md rounded-2xl border border-violet-400/25 bg-[#071018]/97 p-5 shadow-2xl shadow-violet-950/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-violet-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                  Major update available
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">
                  SCM Studio {manifest.version}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="text-slate-500 hover:text-slate-200"
              aria-label="Dismiss major update"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            {manifest.notes || "A new major version is available. Update to get the latest SCM features."}
          </p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Badge tone="violet">v{manifest.version}</Badge>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Later
              </Button>
              <Button size="sm" variant="primary" onClick={() => openUpdate()}>
                <Download className="h-3 w-3" />
                Update now
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-3 z-50 flex max-w-sm items-start gap-2 rounded-xl border border-cyan-400/25 bg-[#06101c]/95 px-3 py-2.5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
      <span className="mt-0.5 text-cyan-300">
        <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-slate-100">
          Update v{manifest.version} available
        </p>
        <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
          {platform === "android"
            ? "One-tap install. Android requires a confirmation screen."
            : "A newer build is available."}
        </p>
        <button
          type="button"
          onClick={() => openUpdate()}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-cyan-300 hover:text-cyan-200"
        >
          Update now <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-slate-500 hover:text-slate-200"
        aria-label="Dismiss update"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
