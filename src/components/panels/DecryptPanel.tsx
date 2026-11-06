import {
  FileArchive,
  FileText,
  Image,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useStudio } from "../../store/useStudio";
import { UnlockForm } from "../UnlockForm";
import { Badge, Button, PanelSection, StatRow } from "../ui";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function DecryptPanel() {
  const sealed = useStudio((state) => state.sealed);
  const sealedStats = useStudio((state) => state.sealedStats);
  const packageBlob = useStudio((state) => state.packageBlob);
  const drafts = useStudio((state) => state.drafts);
  const setTab = useStudio((state) => state.setTab);

  if (!sealed || !sealedStats) {
    return (
      <div className="space-y-3">
        <PanelSection
          icon={<LockKeyhole className="h-3.5 w-3.5" />}
          title="Decrypt SCM"
          hint="Seal content in the Payload tab first. Once sealed, content stays hidden until the private ID token is entered here."
        >
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] p-4 text-center">
            <KeyRound className="mx-auto h-6 w-6 text-slate-600" />
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              {drafts.length > 0
                ? "This SCM is still a draft. Seal it to generate its encrypted ID token."
                : "Nothing is sealed yet. Add text, images, video, or documents in Payload."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setTab("payload")}
          >
            <FileArchive className="h-3 w-3" />
            Open Payload vault
          </Button>
        </PanelSection>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<LockKeyhole className="h-3.5 w-3.5" />}
        title="Sealed SCM"
        hint="Content is locked. The private ID token is the only key that reveals it."
        action={<Badge tone="emerald">sealed</Badge>}
      >
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
          <StatRow label="Items" value={sealedStats.count} tone="cyan" />
          <StatRow label="Total size" value={formatBytes(sealedStats.totalSize)} />
          <StatRow
            label="Token-embedded"
            value={formatBytes(sealedStats.embeddedSize)}
          />
          <StatRow label="Packaged" value={formatBytes(sealedStats.packageSize)} />
          <StatRow
            label="Package"
            value={
              packageBlob
                ? "available in session"
                : sealedStats.packageSize > 0
                  ? "load .scm file"
                  : "not needed"
            }
            tone={
              packageBlob
                ? "emerald"
                : sealedStats.packageSize > 0
                  ? "amber"
                  : "slate"
            }
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {(
            [
              ["text", FileText, sealedStats.kinds.text],
              ["image", Image, sealedStats.kinds.image],
              ["video", Video, sealedStats.kinds.video],
              ["doc", FileArchive, sealedStats.kinds.document],
            ] as const
          ).map(([kind, Icon, count]) => (
            <div
              key={kind}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-1.5 text-center"
            >
              <Icon className="mx-auto h-3.5 w-3.5 text-cyan-300" />
              <p className="mt-1 font-mono text-[10px] text-slate-200">{count}</p>
              <p className="text-[7px] uppercase tracking-wider text-slate-600">
                {kind}
              </p>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection
        icon={<KeyRound className="h-3.5 w-3.5" />}
        title="Input Token"
        hint="Paste the private SCM1 ID token. The public shape QR never includes it."
        action={<Badge tone="amber">required</Badge>}
      >
        <UnlockForm mode="view" compact />
      </PanelSection>

      <PanelSection
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        title="Decryption Sequence"
        hint="A valid token triggers the solved-matrix burst and decrypts every item."
      >
        <ol className="space-y-1.5 text-[10px] leading-relaxed text-slate-400">
          <li className="flex gap-2">
            <span className="font-mono text-cyan-300">01</span>
            Token commitment is verified against the public shape.
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-cyan-300">02</span>
            The matrix solves and explodes to reveal its interior.
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-cyan-300">03</span>
            Embedded text decrypts from the token; files decrypt from the .scm
            package.
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-cyan-300">04</span>
            SHA-256 integrity is checked for every item.
          </li>
        </ol>
      </PanelSection>
    </div>
  );
}
