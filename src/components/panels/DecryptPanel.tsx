import { useState } from "react";
import {
  Copy,
  FileArchive,
  FileText,
  Image,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Split,
  Video,
} from "lucide-react";
import { copyText } from "../../lib/clipboard";
import { downloadBlob } from "../../lib/download";
import { EXPLOSION_LABELS } from "../../lib/reveal";
import {
  recoverPackageFromShardFiles,
  recoverTokenFromShares,
} from "../../lib/sharding";
import { useStudio } from "../../store/useStudio";
import { UnlockForm } from "../UnlockForm";
import { Badge, Button, PanelSection, StatRow } from "../ui";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DecryptPanel() {
  const sealedStats = useStudio((state) => state.sealedStats);
  const packageBlob = useStudio((state) => state.packageBlob);
  const drafts = useStudio((state) => state.drafts);
  const revealStyle = useStudio((state) => state.revealStyle);
  const setTab = useStudio((state) => state.setTab);
  const [shareText, setShareText] = useState("");
  const [recoveredToken, setRecoveredToken] = useState("");
  const [shardFiles, setShardFiles] = useState<File[]>([]);
  const [recoveredPackage, setRecoveredPackage] = useState<Blob | null>(null);

  return (
    <div className="space-y-3">
      {sealedStats ? (
        <PanelSection
          icon={<LockKeyhole className="h-3.5 w-3.5" />}
          title="Sealed SCM in this session"
          hint="These counts come from the manifest held in memory after sealing. They are not read from the shape token."
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
            <StatRow
              label="Reveal"
              value={EXPLOSION_LABELS[revealStyle]}
              tone="violet"
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
      ) : (
        <PanelSection
          icon={<LockKeyhole className="h-3.5 w-3.5" />}
          title="Decrypt SCM"
          hint="No manifest is visible yet. Paste the private ID token below to verify the shape and decrypt the content."
        >
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] p-4 text-center">
            <KeyRound className="mx-auto h-6 w-6 text-slate-600" />
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              {drafts.length > 0
                ? "This SCM is still a draft. Seal it, or paste an existing token to decrypt."
                : "Nothing is decrypted yet. Paste a private token below, or add content in Payload."}
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
      )}

      <PanelSection
        icon={<KeyRound className="h-3.5 w-3.5" />}
        title="Input Token"
        hint="Paste the private SCM1 ID token. The public shape QR never includes it."
        action={<Badge tone="amber">required</Badge>}
      >
        <UnlockForm mode="view" compact />
      </PanelSection>

      <PanelSection
        icon={<Split className="h-3.5 w-3.5" />}
        title="Recover Token from Shares"
        hint="Paste k token shares, one per line, to reconstruct the private ID token."
        action={<Badge tone="violet">k-of-n</Badge>}
      >
        <textarea
          value={shareText}
          onChange={(event) => setShareText(event.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="SCMSHARE1..."
          className="scm-scroll w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[8px] leading-relaxed text-slate-300 focus:border-cyan-400/50 focus:outline-none"
        />
        <input
          type="file"
          multiple
          accept=".txt,text/plain"
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []);
            const contents = await Promise.all(files.map((file) => file.text()));
            if (contents.length > 0) {
              setShareText((current) =>
                [current, ...contents]
                  .map((value) => value.trim())
                  .filter(Boolean)
                  .join("\n"),
              );
            }
          }}
          className="mt-2 block w-full text-[9px] text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-400/15 file:px-2 file:py-1 file:text-[9px] file:text-cyan-200"
        />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={!shareText.trim()}
            onClick={() => {
              try {
                const token = recoverTokenFromShares(shareText.split(/\s+/));
                setRecoveredToken(token);
              } catch (error) {
                setRecoveredToken("");
                useStudio.getState().notify(
                  error instanceof Error
                    ? error.message
                    : "Unable to recover token.",
                  "error",
                );
              }
            }}
          >
            <KeyRound className="h-3 w-3" />
            Recover token
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!recoveredToken}
            onClick={async () => {
              const ok = await copyText(recoveredToken);
              useStudio.getState().notify(
                ok ? "Recovered token copied." : "Clipboard access denied.",
                ok ? "success" : "error",
              );
            }}
          >
            <Copy className="h-3 w-3" />
            Copy recovered
          </Button>
        </div>
        {recoveredToken ? (
          <p className="mt-2 break-all rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-2 font-mono text-[8px] leading-relaxed text-emerald-200">
            {recoveredToken}
          </p>
        ) : null}
      </PanelSection>

      <PanelSection
        icon={<FileArchive className="h-3.5 w-3.5" />}
        title="Recover .scm from Shards"
        hint="Select at least k .scmshard files to rebuild the encrypted package."
        action={<Badge tone="cyan">v3</Badge>}
      >
        <input
          type="file"
          multiple
          accept=".scmshard,application/x-scm-shard"
          onChange={(event) =>
            setShardFiles(Array.from(event.target.files ?? []))
          }
          className="block w-full text-[9px] text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-cyan-400/15 file:px-2 file:py-1 file:text-[9px] file:text-cyan-200"
        />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={shardFiles.length === 0}
            onClick={async () => {
              try {
                const recovered = await recoverPackageFromShardFiles(shardFiles);
                setRecoveredPackage(recovered);
                useStudio.getState().notify(
                  "Package reconstructed from shards.",
                  "success",
                );
              } catch (error) {
                setRecoveredPackage(null);
                useStudio.getState().notify(
                  error instanceof Error
                    ? error.message
                    : "Unable to recover package.",
                  "error",
                );
              }
            }}
          >
            <Split className="h-3 w-3" />
            Rebuild package
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!recoveredPackage}
            onClick={() => {
              if (!recoveredPackage) {
                return;
              }
              void downloadBlob(recoveredPackage, "recovered.scm");
            }}
          >
            <FileArchive className="h-3 w-3" />
            Download .scm
          </Button>
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
          Recovered packages still need the matching private token to unlock.
        </p>
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
            The matrix solves and plays the token's reveal explosion.
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
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-violet-400/15 bg-violet-400/[0.06] px-2 py-1.5 text-[9px] text-violet-200">
          <Sparkles className="h-3 w-3" />
          Reveal explosion: {EXPLOSION_LABELS[revealStyle]}
        </div>
      </PanelSection>
    </div>
  );
}
