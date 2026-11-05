import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Hash,
  KeyRound,
  Link2,
  LoaderCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { VOXEL_COUNT } from "../../types";
import { copyText } from "../../lib/clipboard";
import {
  buildShareLink,
  tokenFingerprint,
} from "../../lib/crypto";
import { downloadText, safeFilename } from "../../lib/download";
import { useStudio } from "../../store/useStudio";
import {
  Badge,
  Button,
  Field,
  PanelSection,
  StatRow,
  TextInput,
} from "../ui";

export function TokenPanel() {
  const matrix = useStudio((state) => state.matrix);
  const token = useStudio((state) => state.token);
  const tokenStatus = useStudio((state) => state.tokenStatus);
  const tokenError = useStudio((state) => state.tokenError);
  const payload = useStudio((state) => state.payload);
  const loadToken = useStudio((state) => state.loadToken);
  const generateNewToken = useStudio((state) => state.generateNewToken);
  const notify = useStudio((state) => state.notify);
  const [input, setInput] = useState(token);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);

  useEffect(() => {
    setInput(token);
  }, [token]);

  const link = token ? buildShareLink(token) : "";
  const fingerprint = token ? tokenFingerprint(token) : "—";

  const handleLoad = async () => {
    setLoadingToken(true);
    await loadToken(input);
    setLoadingToken(false);
  };

  const handleGenerate = async () => {
    setBusy(true);
    await generateNewToken(label);
    setBusy(false);
    setLabel("");
  };

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<KeyRound className="h-3.5 w-3.5" />}
        title="Encrypted SCM Token"
        hint="AES-GCM sealed payload containing the PRNG seed and the three alignment anchors."
        action={
          <Badge
            tone={
              tokenStatus === "ready"
                ? "emerald"
                : tokenStatus === "syncing"
                  ? "amber"
                  : "rose"
            }
          >
            {tokenStatus}
          </Badge>
        }
      >
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
          <StatRow label="matrix id" value={matrix.id} tone="cyan" />
          <StatRow label="label" value={matrix.label} />
          <StatRow
            label="seed"
            value={`0x${matrix.seed.toString(16).padStart(8, "0")}`}
            tone="violet"
          />
          <StatRow
            label="created"
            value={new Date(matrix.createdAt).toLocaleDateString()}
          />
          <StatRow
            label="anchors"
            value={matrix.anchors.map((anchor) => `[${anchor.coord.join(",")}]`).join(" ")}
          />
          <StatRow label="active" value={`${matrix.activeCount} / ${VOXEL_COUNT}`} />
          <StatRow
            label="payload"
            value={
              payload
                ? `${payload.kind} · ${payload.mode} · ${(payload.size / 1024).toFixed(1)} KB`
                : "none"
            }
            tone={payload ? "violet" : "slate"}
          />
          <StatRow label="token" value={`${token.length} chars`} />
          <StatRow label="fingerprint" value={fingerprint} tone="emerald" />
        </div>
        {tokenError ? (
          <p className="mt-2 rounded-md border border-rose-400/25 bg-rose-400/10 p-2 text-[10px] leading-relaxed text-rose-200">
            {tokenError}
          </p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await copyText(token);
              notify(ok ? "Token copied." : "Clipboard denied.", ok ? "success" : "error");
            }}
          >
            <Copy className="h-3 w-3" />
            Copy token
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await copyText(link);
              notify(ok ? "Deep link copied." : "Clipboard denied.", ok ? "success" : "error");
            }}
          >
            <Link2 className="h-3 w-3" />
            Copy link
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadText(token, `${safeFilename(matrix.label)}.scm.txt`)
            }
            disabled={!token}
          >
            <Download className="h-3 w-3" />
            Save file
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(link || "#", "_blank", "noopener,noreferrer")}
            disabled={!token}
          >
            <ExternalLink className="h-3 w-3" />
            Open viewer
          </Button>
        </div>
      </PanelSection>

      <PanelSection
        icon={<QrCode className="h-3.5 w-3.5" />}
        title="Load Token"
        hint="Paste an SCM1 token to decrypt the seed, rebuild the matrix, and launch the assembly cascade."
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={5}
          spellCheck={false}
          placeholder="SCM1.eyJ2IjoxLCJuIjoi..."
          className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[9px] leading-relaxed text-slate-300 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
        />
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
          <Button
            size="sm"
            variant="primary"
            onClick={() => void handleLoad()}
            disabled={loadingToken || tokenStatus === "syncing" || !input.trim()}
          >
            {loadingToken ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            Decrypt & load matrix
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInput(token)}
            disabled={!token}
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </Button>
        </div>
        <p className="mt-2 break-all rounded-md border border-white/[0.05] bg-black/25 p-2 font-mono text-[8px] leading-relaxed text-slate-500">
          {link || "Deep link will appear after the token is sealed."}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] leading-relaxed text-slate-500">
          <Check className="h-3 w-3 shrink-0 text-emerald-300" />
          Scanning the digital card opens this app with the token pre-filled and auto-loads
          the 3D viewer.
        </div>
      </PanelSection>

      <PanelSection
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Forge New Token"
        hint="Generates a fresh PRNG seed, three hidden anchors, and a new encrypted SCM1 token locally."
      >
        <Field label="Matrix label" hint="optional">
          <TextInput
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Obsidian Relay"
            maxLength={48}
          />
        </Field>
        <Button
          variant="primary"
          size="sm"
          className="mt-2 w-full"
          onClick={() => void handleGenerate()}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate & seal token
        </Button>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
          A new matrix triggers the Layer Wave assembly automatically. Every render setting
          remains non-destructive.
        </p>
      </PanelSection>

      <PanelSection
        icon={<Hash className="h-3.5 w-3.5" />}
        title="Duo System Notes"
        hint="The QR layer is a standard 2D code. The 3D structure lives entirely in the decrypted token."
      >
        <ul className="space-y-1.5 text-[10px] leading-relaxed text-slate-400">
          <li className="flex gap-1.5">
            <span className="text-cyan-300">01</span>
            The token seals a 32-bit PRNG seed plus three anchor coordinates.
          </li>
          <li className="flex gap-1.5">
            <span className="text-cyan-300">02</span>
            The same seed deterministically rebuilds 729 bits and the execution order.
          </li>
          <li className="flex gap-1.5">
            <span className="text-cyan-300">03</span>
            Anchor paths are carved into the bitstream so trajectory rendering is always
            verifiable.
          </li>
          <li className="flex gap-1.5">
            <span className="text-cyan-300">04</span>
            Visual layers never mutate the seed, bitstream, anchor centers, or path.
          </li>
        </ul>
      </PanelSection>
    </div>
  );
}
