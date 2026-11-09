import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Download,
  FileArchive,
  FileKey,
  FileText,
  FolderUp,
  Image,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Package,
  ShieldCheck,
  Trash,
  TriangleAlert,
  Type,
  Upload,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FillMode, GridSizeOption, PayloadKind } from "../../types";
import { GRID_SIZE_OPTIONS } from "../../types";
import { downloadBlob, safeFilename } from "../../lib/download";
import type { PayloadDraftItem } from "../../lib/vault";
import { capacityForGridSize } from "../../lib/scm";
import {
  autoGridSizeForDrafts,
  resolveGridSize,
  useStudio,
} from "../../store/useStudio";
import { UnlockForm } from "../UnlockForm";
import {
  Badge,
  Button,
  PanelSection,
  Segmented,
  StatRow,
  TextInput,
} from "../ui";

const KIND_ICON: Record<PayloadKind, LucideIcon> = {
  text: Type,
  image: Image,
  video: Video,
  document: FileText,
};

function DraftRow({
  draft,
  onRemove,
  onUpdate,
}: {
  draft: PayloadDraftItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}) {
  const Icon = KIND_ICON[draft.kind];
  const embedded = draft.kind === "text" && draft.size <= 2048;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() =>
    draft.kind === "text" ? new TextDecoder().decode(draft.bytes) : "",
  );

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20">
      <div className="flex items-center gap-2 p-1.5">
        <span className="text-cyan-300">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-slate-200">{draft.path}</p>
          <p className="font-mono text-[8px] text-slate-500">
            {draft.kind} · {formatBytes(draft.size)} ·{" "}
            {embedded ? "token" : "package"}
          </p>
        </div>
        <Badge tone={embedded ? "emerald" : "amber"}>
          {embedded ? "token" : "package"}
        </Badge>
        {draft.kind === "text" ? (
          <button
            type="button"
            onClick={() => {
              setValue(new TextDecoder().decode(draft.bytes));
              setEditing((open) => !open);
            }}
            className="text-slate-500 transition-colors hover:text-cyan-300"
            aria-label={`Edit ${draft.name}`}
          >
            <Type className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(draft.id)}
          className="text-slate-500 transition-colors hover:text-rose-300"
          aria-label={`Remove ${draft.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {editing ? (
        <div className="border-t border-white/[0.06] p-2">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 text-[10px] leading-relaxed text-slate-200 focus:border-cyan-400/50 focus:outline-none"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                onUpdate(draft.id, value);
                setEditing(false);
              }}
            >
              Save text
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function PayloadPanel() {
  const drafts = useStudio((state) => state.drafts);
  const sealed = useStudio((state) => state.sealed);
  const sealedStats = useStudio((state) => state.sealedStats);
  const packageBlob = useStudio((state) => state.packageBlob);
  const editing = useStudio((state) => state.editing);
  const previousVersions = useStudio((state) => state.previousVersions);
  const matrix = useStudio((state) => state.matrix);
  const design = useStudio((state) => state.design);
  const addTextDraft = useStudio((state) => state.addTextDraft);
  const addFiles = useStudio((state) => state.addFiles);
  const removeDraft = useStudio((state) => state.removeDraft);
  const updateTextDraft = useStudio((state) => state.updateTextDraft);
  const clearDrafts = useStudio((state) => state.clearDrafts);
  const sealPayload = useStudio((state) => state.sealPayload);
  const setTab = useStudio((state) => state.setTab);
  const notify = useStudio((state) => state.notify);
  const gridChoice = useStudio((state) => state.gridChoice);
  const setGridChoice = useStudio((state) => state.setGridChoice);
  const fillChoice = useStudio((state) => state.fillChoice);
  const setFillChoice = useStudio((state) => state.setFillChoice);

  const [text, setText] = useState("");
  const [label, setLabel] = useState(matrix.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(matrix.label);
  }, [matrix.id, matrix.label]);

  useEffect(() => {
    const input = folderInputRef.current;
    if (input) {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
    }
  }, []);

  const totalSize = drafts.reduce((sum, draft) => sum + draft.size, 0);
  const embeddedEstimate = drafts
    .filter((draft) => draft.kind === "text" && draft.size <= 2048)
    .reduce((sum, draft) => sum + draft.size, 0);
  const packageEstimate = totalSize - embeddedEstimate;
  const autoSize = autoGridSizeForDrafts(drafts);
  const effectiveSize = resolveGridSize(gridChoice, drafts);
  const dataTarget = Math.min(
    effectiveSize ** 3,
    Math.max(1, totalSize),
  );
  const tierCapacity = capacityForGridSize(effectiveSize);
  const gridOptions: Array<{ value: GridSizeOption; label: string }> = [
    { value: "auto", label: "Auto" },
    ...GRID_SIZE_OPTIONS.map((size) => ({
      value: String(size) as GridSizeOption,
      label: `${size}³`,
    })),
  ];

  const handleSeal = async () => {
    setBusy(true);
    setError("");
    const result = await sealPayload(label);
    if (!result.ok) {
      setError(result.error ?? "Unable to seal this SCM.");
      setBusy(false);
      return;
    }
    setText("");
    if (result.packageBlob) {
      await downloadBlob(
        result.packageBlob,
        `${safeFilename(label || matrix.label)}.scm`,
      );
      notify(
        "SCM sealed. The encrypted .scm package was downloaded; the private ID token is in the Token tab.",
        "success",
      );
    } else {
      notify(
        "SCM sealed. All items were embedded in the private ID token; share it from the Token tab.",
        "success",
      );
    }
    setBusy(false);
  };

  if (sealed && sealedStats) {
    return (
      <div className="space-y-3">
        <PanelSection
          icon={<LockKeyhole className="h-3.5 w-3.5" />}
          title="Sealed Vault"
          hint="Content is no longer visible or stored as plaintext in the studio. Only the private ID token can open it."
          action={<Badge tone="emerald">locked</Badge>}
        >
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
            <StatRow label="Items" value={sealedStats.count} tone="cyan" />
            <StatRow label="Total size" value={formatBytes(sealedStats.totalSize)} />
            <StatRow
              label="Embedded in token"
              value={formatBytes(sealedStats.embeddedSize)}
            />
            <StatRow
              label="In .scm package"
              value={formatBytes(sealedStats.packageSize)}
            />
            <StatRow
              label="Package"
              value={
                packageBlob
                  ? "in session"
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
                ["text", Type, sealedStats.kinds.text],
                ["image", Image, sealedStats.kinds.image],
                ["video", Video, sealedStats.kinds.video],
                ["doc", FileText, sealedStats.kinds.document],
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
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={() => setTab("decrypt")}
            >
              <KeyRound className="h-3 w-3" />
              Decrypt to view
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                packageBlob
                  ? void downloadBlob(
                      packageBlob,
                      `${safeFilename(matrix.label)}.scm`,
                    )
                  : notify(
                      "The .scm package is not in this session. Load it in Decrypt or Edit Studio.",
                      "info",
                    )
              }
            >
              <Download className="h-3 w-3" />
              .scm package
            </Button>
          </div>
          <Button
            size="sm"
            variant="subtle"
            className="mt-1.5 w-full"
            onClick={() => setEditOpen((open) => !open)}
          >
            <FileKey className="h-3 w-3" />
            {editOpen ? "Close Edit Studio" : "Edit Studio"}
          </Button>
          <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
            The private ID token is in the Token tab. The public QR only carries the
            shape.
          </p>
        </PanelSection>

        {editOpen ? (
          <PanelSection
            icon={<FileKey className="h-3.5 w-3.5" />}
            title="Unlock Edit Studio"
            hint="Enter the private ID token to load the decrypted items back into the draft. Re-sealing mints a new shape and token."
            action={<Badge tone="amber">token required</Badge>}
          >
            <UnlockForm mode="edit" compact />
          </PanelSection>
        ) : null}

        {previousVersions.length > 0 ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-2.5">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <p className="text-[9px] leading-relaxed text-amber-200/80">
                {previousVersions.length} previous sealed version
                {previousVersions.length === 1 ? "" : "s"} exist. Old tokens and
                packages remain valid on other devices. This app cannot revoke
                offline copies.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<Package className="h-3.5 w-3.5" />}
        title={editing ? "Edit Studio" : "Draft Vault"}
        hint={
          editing
            ? "Editing unlocked. Add, remove, or edit items, then re-seal to reshape the matrix and mint a new token."
            : "Add as many text items, images, videos, and documents as you need. Sealing locks the set and reshapes the matrix."
        }
        action={
          <Badge tone={editing ? "violet" : drafts.length > 0 ? "amber" : "slate"}>
            {editing ? "re-seal" : `${drafts.length} items`}
          </Badge>
        }
      >
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <TextInput
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            placeholder="SCM label"
            maxLength={48}
          />
          <Badge tone="cyan">{formatBytes(totalSize)}</Badge>
        </div>

        <div className="mt-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder="Write a private note. Small text embeds in the token; larger text goes into the encrypted package…"
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2.5 text-[11px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[8px] text-slate-500">
              {formatBytes(new TextEncoder().encode(text).byteLength)} UTF-8
            </span>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                addTextDraft(text);
                setText("");
              }}
              disabled={!text.trim()}
            >
              <Type className="h-3 w-3" />
              Add text item
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            const input = event.target;
            if (input) input.value = "";
            if (files.length > 0) {
              setBusy(true);
              void addFiles(files).finally(() => setBusy(false));
            }
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            const input = event.target;
            if (input) input.value = "";
            if (files.length > 0) {
              setBusy(true);
              void addFiles(files).finally(() => setBusy(false));
            }
          }}
        />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="h-3 w-3" />
            Add files
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => folderInputRef.current?.click()}
            disabled={busy}
          >
            <FolderUp className="h-3 w-3" />
            Add folder
          </Button>
        </div>
      </PanelSection>

      <PanelSection
        icon={<Package className="h-3.5 w-3.5" />}
        title="Matrix Scale"
        hint="Auto grows when payload exceeds the lattice capacity: voxels × six faces × ~1.2 KB face shards, up to 64 MB at 21³. Full fills every voxel; data count fills one voxel per payload byte."
        action={<Badge tone="cyan">seal at {effectiveSize}³</Badge>}
      >
        <Segmented
          value={gridChoice}
          onChange={(choice) => setGridChoice(choice as GridSizeOption)}
          options={gridOptions}
          columns={4}
        />
        <div className="mt-3">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            Volume fill
          </p>
          <Segmented
            value={fillChoice}
            onChange={(choice) => setFillChoice(choice as FillMode)}
            options={[
              { value: "full", label: "Full size" },
              { value: "data", label: "Data count" },
            ]}
            columns={2}
          />
        </div>
        <div className="mt-2 rounded-lg border border-white/[0.05] bg-black/20 p-2">
          <StatRow
            label="Auto target"
            value={`${autoSize}³ · ${autoSize ** 3} voxels`}
            tone="cyan"
          />
          <StatRow
            label="Manual target"
            value={
              gridChoice === "auto"
                ? "automatic"
                : `${effectiveSize}³ · ${effectiveSize ** 3} voxels`
            }
            tone={gridChoice === "auto" ? "slate" : "violet"}
          />
          <StatRow
            label="Tier capacity"
            value={`${formatBytes(tierCapacity)} ${
              totalSize > tierCapacity ? "· above tier" : "· fits"
            }`}
            tone={totalSize > tierCapacity ? "rose" : "emerald"}
          />
          <StatRow
            label="Fill target"
            value={
              fillChoice === "full"
                ? `${effectiveSize ** 3} voxels`
                : `${dataTarget} voxels`
            }
            tone={fillChoice === "full" ? "emerald" : "amber"}
          />
          <StatRow
            label="Face codes"
            value={
              design.faceCodeMode === "off"
                ? "off"
                : design.faceCodeMode === "all"
                  ? "all active cubes"
                  : effectiveSize < 9
                    ? "all active cubes"
                    : "anchor points"
            }
          />
        </div>
      </PanelSection>

      <PanelSection
        icon={<FileArchive className="h-3.5 w-3.5" />}
        title="Draft Items"
        hint="Text items up to 2 KB can embed in the token. Everything else goes into the encrypted .scm package."
        action={
          drafts.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearDrafts}
              className="h-7 px-1.5 text-[9px]"
            >
              <Trash className="h-3 w-3" />
              Clear
            </Button>
          ) : null
        }
      >
        {drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] p-3 text-center">
            <Package className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-1.5 text-[10px] text-slate-500">
              No items yet. Add text, files, or a whole folder.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {drafts.map((draft) => (
              <DraftRow
                key={draft.id}
                draft={draft}
                onRemove={removeDraft}
                onUpdate={updateTextDraft}
              />
            ))}
          </div>
        )}

        {drafts.length > 0 ? (
          <div className="mt-2">
            <StatRow
              label="Token-embedded"
              value={formatBytes(embeddedEstimate)}
              tone="emerald"
            />
            <StatRow
              label="Package"
              value={formatBytes(packageEstimate)}
              tone="amber"
            />
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 rounded-md border border-rose-400/25 bg-rose-400/10 p-2 text-[10px] text-rose-200">
            {error}
          </p>
        ) : null}

        <Button
          variant="primary"
          size="md"
          className="mt-2 w-full"
          onClick={() => void handleSeal()}
          disabled={drafts.length === 0 || busy}
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LockKeyhole className="h-3.5 w-3.5" />
          )}
          {busy ? "Sealing SCM…" : editing ? "Re-seal & Reshape SCM" : "Encrypt & Seal SCM"}
        </Button>
        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
          Sealing reshapes the matrix from the content root and mints a new private ID
          token. After sealing, add or remove items only through Edit Studio.
        </p>
      </PanelSection>

      <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 text-[9px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-300" />
          AES-GCM + SHA-256 · local only
        </span>
        <button
          type="button"
          onClick={() => setTab("token")}
          className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
        >
          Token <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {previousVersions.length > 0 ? (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-2 text-[9px] leading-relaxed text-amber-200/80">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
          Editing this SCM keeps {previousVersions.length} previous sealed version
          {previousVersions.length === 1 ? "" : "s"} valid on other devices. Re-sealing
          mints a new shape and token.
        </div>
      ) : null}
    </div>
  );
}
