import { Boxes, LockKeyhole, Orbit, ShieldAlert } from "lucide-react";
import { useStudio } from "../store/useStudio";
import { Scene } from "./scene/Scene";
import { UnlockForm } from "./UnlockForm";
import { Badge } from "./ui";

export function GuestView() {
  const guestShape = useStudio((state) => state.guestShape);
  const matrix = useStudio((state) => state.matrix);
  const reveal = useStudio((state) => state.reveal);

  return (
    <main className="relative min-h-0 flex-1 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(14,116,144,0.16),transparent_58%)]" />
      <Scene />

      <div className="pointer-events-none absolute inset-0 z-10 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-[#050910]/75 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan-200 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              guest viewer
            </span>
            <span className="rounded-lg border border-white/10 bg-[#050910]/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400 backdrop-blur">
              {guestShape?.label ?? matrix.label}
            </span>
            <span className="rounded-lg border border-white/10 bg-[#050910]/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-400 backdrop-blur">
              {matrix.activeCount} voxels
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone="cyan">
              <LockKeyhole className="h-2.5 w-2.5" />
              content locked
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#050910]/65 px-1.5 py-0.5 font-mono text-[8px] text-slate-500 backdrop-blur">
              <Orbit className="h-2.5 w-2.5" />
              orbit to inspect
            </span>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex justify-center md:inset-x-auto md:bottom-4 md:right-4 md:justify-end">
        <div className="scm-scroll max-h-[calc(100dvh-5rem)] w-full max-w-[390px] overflow-y-auto">
          {!reveal ? (
            <UnlockForm
              mode="view"
              compact
              title="Input Token"
              description="This guest link reveals only the 3D shape and animation. Paste the private SCM1 ID token — and load the .scm package when files are attached — to unlock the content."
            />
          ) : null}
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-white/[0.06] bg-[#050910]/70 p-2 text-[8px] leading-relaxed text-slate-500 backdrop-blur">
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
            The QR and guest URL never contain the private ID token. A valid token is
            verified against this shape before any content is decrypted.
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1 font-mono text-[8px] text-slate-600">
            <Boxes className="h-3 w-3" />
            {matrix.id}
          </div>
        </div>
      </div>
    </main>
  );
}
