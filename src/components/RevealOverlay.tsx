import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  FileArchive,
  FileText,
  Image,
  ShieldCheck,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import type { RevealedItem, RevealResult } from "../types";
import { downloadBlob } from "../lib/download";
import { EXPLOSION_LABELS } from "../lib/reveal";
import { useStudio } from "../store/useStudio";
import { Badge, Button } from "./ui";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function ScrambleText({ text }: { text: string }) {
  const safeText = useMemo(() => text.slice(0, 3000), [text]);
  const [display, setDisplay] = useState("");
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*+/\\";

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1500);
      const revealed = Math.floor(progress * safeText.length);
      const scrambled = Array.from(
        { length: Math.max(0, safeText.length - revealed) },
        () => glyphs[Math.floor(Math.random() * glyphs.length)],
      ).join("");
      setDisplay(safeText.slice(0, revealed) + scrambled);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [safeText]);

  return (
    <pre className="scm-scroll max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-cyan-50">
      {display}
    </pre>
  );
}

function RevealItemCard({ item }: { item: RevealedItem }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const isImage = item.kind === "image";
  const isVideo = item.kind === "video";
  const isText = item.kind === "text";

  useEffect(() => {
    if (isText && item.blob) {
      item.blob.text().then(setText);
    }
  }, [item, isText]);

  useEffect(() => {
    if (!item.blob || (!isImage && !isVideo)) {
      return;
    }
    const next = URL.createObjectURL(item.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [item, isImage, isVideo]);

  return (
    <article className="animate-[scm-card-in_420ms_ease-out_both] overflow-hidden rounded-xl border border-cyan-400/15 bg-[#06101c]/90">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="text-cyan-300">
          {isImage ? (
            <Image className="h-4 w-4" />
          ) : isVideo ? (
            <Video className="h-4 w-4" />
          ) : isText ? (
            <FileText className="h-4 w-4" />
          ) : (
            <FileArchive className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-slate-100">
            {item.name}
          </p>
          <p className="truncate font-mono text-[8px] text-slate-500">
            {item.path !== item.name ? `${item.path} · ` : ""}
            {formatBytes(item.size)} · {item.mime}
          </p>
        </div>
        <Badge tone={item.mode === "embedded" ? "emerald" : "amber"}>
          {item.mode === "embedded" ? "token" : "package"}
        </Badge>
      </div>
      <div className="p-2.5">
        {isText ? (
          <ScrambleText text={text} />
        ) : isImage && url ? (
          <img
            src={url}
            alt={item.name}
            className="max-h-64 w-full rounded-lg object-contain"
          />
        ) : isVideo && url ? (
          <video src={url} controls className="max-h-64 w-full rounded-lg bg-black" />
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/25 p-3 text-slate-400">
            <FileText className="h-7 w-7 text-cyan-300" />
            <div>
              <p className="text-[10px] text-slate-200">{item.name}</p>
              <p className="font-mono text-[8px] text-slate-500">
                Decrypted document ready
              </p>
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 font-mono text-[8px] text-emerald-300">
            <Check className="h-3 w-3" />
            SHA-256 verified
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (item.blob) {
                void downloadBlob(item.blob, item.name);
              }
            }}
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
        </div>
      </div>
    </article>
  );
}

function RevealOverlayInner({ reveal }: { reveal: RevealResult }) {
  const closeReveal = useStudio((state) => state.closeReveal);
  const revealStyle = useStudio((state) => state.revealStyle);
  const [stage, setStage] = useState<"solving" | "reveal">("solving");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let value = 0;
    const interval = window.setInterval(() => {
      value = Math.min(100, value + 3);
      setProgress(value);
      if (value >= 100) {
        window.clearInterval(interval);
        window.setTimeout(() => setStage("reveal"), 350);
      }
    }, 40);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReveal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeReveal]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-colors duration-500 ${
        stage === "solving"
          ? "bg-[#02050b]/25"
          : "bg-[#02050b]/78 backdrop-blur-sm"
      }`}
    >
      {stage === "solving" ? (
        <div className="w-full max-w-sm animate-[scm-gate_320ms_ease-out] rounded-2xl border border-cyan-400/25 bg-[#06101c]/95 p-6 text-center shadow-2xl shadow-cyan-950/40">
          <span className="mx-auto flex h-14 w-14 animate-[scm-spin_4s_linear_infinite] items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
            <Sparkles className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Solving matrix
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            {reveal.shape?.label ?? "SCM Vault"}
          </h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Verifying commitments, expanding the 3D lattice, and decrypting{" "}
            {reveal.items.length} item{reveal.items.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-rose-400 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[9px] text-cyan-300">
            {progress.toString().padStart(3, "0")}%
          </p>
        </div>
      ) : (
        <div className="animate-[scm-gate_320ms_ease-out] flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#040a13]/95 shadow-2xl shadow-cyan-950/50">
          <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                SCM solved
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-slate-100">
                {reveal.shape?.label ?? "SCM Vault"}
              </h2>
              <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                {reveal.items.length} item{reveal.items.length === 1 ? "" : "s"} ·{" "}
                {reveal.packageLoaded ? "token + package" : "token only"}{" / "}
                {EXPLOSION_LABELS[revealStyle]} ·{" "}
                {reveal.shape?.shapeId.slice(0, 12)}
              </p>
            </div>
            <button
              type="button"
              onClick={closeReveal}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Close reveal"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="scm-scroll min-h-0 flex-1 overflow-y-auto p-3">
            {reveal.items.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <ShieldCheck className="mx-auto h-7 w-7 text-emerald-300" />
                <p className="mt-2 text-[11px]">Token verified. No content items were attached.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {reveal.items.map((item) => (
                  <RevealItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-2">
            <span className="inline-flex items-center gap-1 font-mono text-[8px] text-slate-500">
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              AES-GCM · SHA-256 · verified
            </span>
            <Button size="sm" variant="outline" onClick={closeReveal}>
              Reassemble & close
            </Button>
          </footer>
        </div>
      )}
    </div>
  );
}

export function RevealOverlay() {
  const reveal = useStudio((state) => state.reveal);
  if (!reveal) {
    return null;
  }
  return (
    <RevealOverlayInner
      key={`${reveal.shape?.shapeId ?? "scm"}-${reveal.items.length}`}
      reveal={reveal}
    />
  );
}
