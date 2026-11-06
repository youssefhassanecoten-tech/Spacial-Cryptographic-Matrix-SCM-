import { useRef, useState } from "react";
import {
  FileArchive,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import type { UnlockResult } from "../store/useStudio";
import { useStudio } from "../store/useStudio";
import { Button, Field } from "./ui";

export function UnlockForm({
  mode,
  title = "Input Token",
  description = "Paste the private SCM1 ID token. The public shape link never contains this token.",
  compact = false,
  onSuccess,
}: {
  mode: "view" | "edit";
  title?: string;
  description?: string;
  compact?: boolean;
  onSuccess?: (result: UnlockResult) => void;
}) {
  const unlockPayload = useStudio((state) => state.unlockPayload);
  const unlockForEdit = useStudio((state) => state.unlockForEdit);
  const storedPackage = useStudio((state) => state.packageBlob);
  const notify = useStudio((state) => state.notify);
  const [token, setToken] = useState("");
  const [packageFile, setPackageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsPackage, setNeedsPackage] = useState(false);
  const packageRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!token.trim()) {
      setError("Paste the private SCM1 ID token first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result =
        mode === "view"
          ? await unlockPayload(token, packageFile)
          : await unlockForEdit(token, packageFile);
      if (!result.ok) {
        setError(result.error ?? "Unable to unlock this SCM.");
        setNeedsPackage(Boolean(result.needsPackage));
        return;
      }
      setToken("");
      setPackageFile(null);
      setNeedsPackage(false);
      notify(
        mode === "view"
          ? "SCM solved and content revealed."
          : "Edit Studio unlocked. Re-seal to reshape the matrix.",
        "success",
      );
      onSuccess?.(result);
    } finally {
      setBusy(false);
    }
  };

  const activePackage = packageFile ?? storedPackage;

  return (
    <div
      className={`rounded-xl border border-cyan-400/20 bg-[#071018]/90 ${
        compact ? "p-3" : "p-4"
      } shadow-2xl shadow-cyan-950/30 backdrop-blur-xl`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <KeyRound className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="text-[12px] font-semibold tracking-wide text-slate-100">
              {title}
            </h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
              {description}
            </p>
          </div>
        </div>
        {needsPackage ? (
          <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-amber-200">
            package needed
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <Field label="Private ID Token" hint="SCM1.…">
          <textarea
            value={token}
            onChange={(event) => setToken(event.target.value)}
            rows={compact ? 3 : 4}
            spellCheck={false}
            placeholder="SCM1.eyJ2IjoxLCJuIjoi…"
            className="w-full resize-none rounded-lg border border-white/10 bg-black/35 p-2 font-mono text-[9px] leading-relaxed text-slate-300 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
        </Field>

        <input
          ref={packageRef}
          type="file"
          className="hidden"
          accept=".scm,application/x-scm-package,application/octet-stream"
          onChange={(event) => {
            setPackageFile(event.target.files?.[0] ?? null);
            const input = event.target;
            if (input) input.value = "";
          }}
        />

        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-black/20 p-2">
          <FileArchive className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] text-slate-300">
              {activePackage
                ? packageFile
                  ? packageFile.name
                  : "Current encrypted package"
                : "No .scm package loaded"}
            </p>
            <p className="font-mono text-[8px] text-slate-500">
              Required for image, video, and document items
            </p>
          </div>
          {packageFile ? (
            <button
              type="button"
              onClick={() => setPackageFile(null)}
              className="text-slate-500 hover:text-rose-300"
              aria-label="Remove package"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => packageRef.current?.click()}
          >
            Load
          </Button>
        </div>

        {error ? (
          <div className="rounded-md border border-rose-400/25 bg-rose-400/10 p-2 text-[10px] leading-relaxed text-rose-200">
            {error}
            {needsPackage ? (
              <span className="mt-1 block text-amber-200/80">
                Load the matching encrypted <span className="font-mono">.scm</span>{" "}
                package, then submit again.
              </span>
            ) : null}
          </div>
        ) : null}

        <Button
          variant="primary"
          size={compact ? "sm" : "md"}
          className="w-full"
          onClick={() => void submit()}
          disabled={busy || !token.trim()}
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LockKeyhole className="h-3.5 w-3.5" />
          )}
          {busy
            ? "Verifying token…"
            : mode === "view"
              ? "Decrypt & Reveal"
              : "Unlock Edit Studio"}
        </Button>
        <div className="flex items-center gap-1.5 text-[9px] leading-relaxed text-slate-500">
          <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-300" />
          The token is verified against the public shape before any content is
          decrypted.
        </div>
      </div>
    </div>
  );
}
