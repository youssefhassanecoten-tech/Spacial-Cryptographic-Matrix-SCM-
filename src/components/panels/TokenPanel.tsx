import {
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileKey,
  Hash,
  KeyRound,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { copyText } from "../../lib/clipboard";
import { tokenFingerprint } from "../../lib/crypto";
import { downloadBlob, downloadText, safeFilename } from "../../lib/download";
import { buildGuestLink } from "../../lib/vault";
import { useStudio } from "../../store/useStudio";
import { Badge, Button, PanelSection, StatRow } from "../ui";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
import { useUpdates } from "../../store/useUpdates";

export function TokenPanel() {
  const matrix = useStudio((state) => state.matrix);
  const token = useStudio((state) => state.token);
  const shapeToken = useStudio((state) => state.shapeToken);
  const tokenStatus = useStudio((state) => state.tokenStatus);
  const sealed = useStudio((state) => state.sealed);
  const sealedStats = useStudio((state) => state.sealedStats);
  const packageBlob = useStudio((state) => state.packageBlob);
  const previousVersions = useStudio((state) => state.previousVersions);
  const newSCM = useStudio((state) => state.newSCM);
  const setTab = useStudio((state) => state.setTab);
  const notify = useStudio((state) => state.notify);
  const currentVersion = useUpdates((state) => state.currentVersion);
  const manifest = useUpdates((state) => state.manifest);
  const kind = useUpdates((state) => state.kind);
  const checking = useUpdates((state) => state.checking);
  const error = useUpdates((state) => state.error);
  const check = useUpdates((state) => state.check);

  const guestLink = shapeToken ? buildGuestLink(shapeToken) : "";
  const fingerprint = token ? tokenFingerprint(token) : "—";

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<KeyRound className="h-3.5 w-3.5" />}
        title="Private ID Token"
        hint="This is the decryption key. It is never placed in the QR code or guest link."
        action={
          <Badge
            tone={
              tokenStatus === "ready"
                ? sealed
                  ? "emerald"
                  : "cyan"
                : tokenStatus === "syncing"
                  ? "amber"
                  : tokenStatus === "idle"
                    ? "slate"
                    : "rose"
            }
          >
            {sealed ? "sealed" : tokenStatus}
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
            label="active"
            value={`${matrix.activeCount} / ${matrix.voxelCount}`}
          />
          <StatRow
            label="payload"
            value={
              sealedStats
                ? `${sealedStats.count} items · ${formatBytes(sealedStats.totalSize)}`
                : "draft / empty"
            }
            tone={sealedStats ? "emerald" : "slate"}
          />
          <StatRow label="private token" value={`${token.length} chars`} />
          <StatRow label="fingerprint" value={fingerprint} tone="emerald" />
          <StatRow
            label="shape token"
            value={shapeToken ? `${shapeToken.length} chars` : "—"}
          />
          <StatRow
            label="previous versions"
            value={previousVersions.length}
            tone={previousVersions.length > 0 ? "amber" : "slate"}
          />
        </div>

        <textarea
          readOnly
          value={token || "No private ID token yet. Seal content first."}
          rows={4}
          spellCheck={false}
          className="scm-scroll mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/35 p-2 font-mono text-[8px] leading-relaxed text-slate-400 focus:outline-none"
        />

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="primary"
            disabled={!token}
            onClick={async () => {
              const ok = await copyText(token);
              notify(
                ok ? "Private ID token copied." : "Clipboard access denied.",
                ok ? "success" : "error",
              );
            }}
          >
            <Copy className="h-3 w-3" />
            Copy private token
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!token}
            onClick={() =>
              void downloadText(token, `${safeFilename(matrix.label)}.scm1.txt`)
            }
          >
            <Download className="h-3 w-3" />
            Save ID token
          </Button>
        </div>
      </PanelSection>

      <PanelSection
        icon={<Link2 className="h-3.5 w-3.5" />}
        title="Public Shape Link"
        hint="This is the QR payload. It opens the guest viewer with the exact 3D shape but no content."
        action={<Badge tone="cyan">public</Badge>}
      >
        <p className="break-all rounded-md border border-white/[0.05] bg-black/25 p-2 font-mono text-[8px] leading-relaxed text-slate-500">
          {guestLink || "Shape link will appear after the token engine finishes."}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={!guestLink}
            onClick={async () => {
              const ok = await copyText(guestLink);
              notify(
                ok ? "Guest shape link copied." : "Clipboard access denied.",
                ok ? "success" : "error",
              );
            }}
          >
            <Copy className="h-3 w-3" />
            Copy shape link
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!guestLink}
            onClick={() => window.open(guestLink, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3 w-3" />
            Open guest page
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] leading-relaxed text-slate-500">
          <QrCode className="h-3 w-3 shrink-0 text-cyan-300" />
          The private ID token must be entered on the guest page to unlock content.
        </div>
      </PanelSection>

      <PanelSection
        icon={<FileArchive className="h-3.5 w-3.5" />}
        title="Encrypted Package"
        hint="Needed only when images, video, or documents are sealed. The QR never contains it."
        action={
          <Badge tone={packageBlob ? "emerald" : sealedStats?.packageSize ? "amber" : "slate"}>
            {packageBlob ? "available" : sealedStats?.packageSize ? "missing" : "not needed"}
          </Badge>
        }
      >
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!packageBlob}
          onClick={() => {
            if (!packageBlob) return;
            void downloadBlob(packageBlob, `${safeFilename(matrix.label)}.scm`);
          }}
        >
          <Download className="h-3 w-3" />
          Download .scm package
        </Button>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
          Share the package separately from the QR. The token is the key; the package
          is the encrypted content.
        </p>
      </PanelSection>

      <PanelSection
        icon={<FileKey className="h-3.5 w-3.5" />}
        title="Workflow"
        hint="Seal once, then decrypt or edit through deliberate token entry."
        action={<Badge tone="violet">vault</Badge>}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setTab("payload")}>
            <ShieldCheck className="h-3 w-3" />
            Payload
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTab("decrypt")}>
            <KeyRound className="h-3 w-3" />
            Decrypt
          </Button>
        </div>
        <div className="mt-2 flex items-start gap-1.5 text-[9px] leading-relaxed text-slate-500">
          <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
          Re-sealing reshapes the matrix because the seed is derived from the content
          root and a new salt. Previous tokens remain valid for previous packages.
        </div>
        <Button
          size="sm"
          variant="primary"
          className="mt-2 w-full"
          onClick={() => void newSCM()}
        >
          <Plus className="h-3 w-3" />
          Start new SCM
        </Button>
      </PanelSection>

      <PanelSection
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        title="App Update"
        hint="Web applies minor updates automatically. Windows, Android, and iOS prompt before installing."
        action={
          <Badge
            tone={
              checking
                ? "amber"
                : kind === "major"
                  ? "violet"
                  : kind === "minor"
                    ? "cyan"
                    : "slate"
            }
          >
            {checking ? "checking" : kind}
          </Badge>
        }
      >
        <StatRow label="Current version" value={`v${currentVersion}`} />
        <StatRow
          label="Latest version"
          value={manifest ? `v${manifest.version}` : "not checked"}
        />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={checking}
          onClick={() => void check()}
        >
          <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking for updates" : "Check for updates"}
        </Button>
        {error && (
          <p className="mt-2 text-[9px] leading-relaxed text-amber-300/80">
            {error}
          </p>
        )}
      </PanelSection>

      <PanelSection
        icon={<Hash className="h-3.5 w-3.5" />}
        title="Security Notes"
        hint="Offline encryption cannot revoke a token once it has left the device."
      >
        <ul className="space-y-1.5 text-[10px] leading-relaxed text-slate-400">
          <li className="flex gap-1.5">
            <span className="text-cyan-300">01</span>
            The QR carries only the public shape token, seed, and anchors.
          </li>
          <li className="flex gap-1.5">
            <span className="text-cyan-300">02</span>
            Embedded text is encrypted inside the private ID token.
          </li>
          <li className="flex gap-1.5">
            <span className="text-cyan-300">03</span>
            Files are encrypted into the separate .scm package.
          </li>
          <li className="flex gap-1.5">
            <span className="text-cyan-300">04</span>
            Editing archives the old version locally, but external copies stay valid.
          </li>
        </ul>
      </PanelSection>
    </div>
  );
}
