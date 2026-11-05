import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileArchive,
  FileCheck,
  FileLock,
  FileText,
  FileUp,
  Image,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Trash,
  TriangleAlert,
  Type,
  Upload,
  Video,
  X,
} from "lucide-react";
import type { PayloadKind } from "../../types";
import { downloadBlob, safeFilename } from "../../lib/download";
import {
  MAX_PAYLOAD_BYTES,
  TEXT_EMBED_LIMIT,
  useStudio,
} from "../../store/useStudio";
import {
  Badge,
  Button,
  PanelSection,
  Segmented,
  StatRow,
} from "../ui";

const KIND_LABELS: Record<PayloadKind, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  document: "Document",
};

const KIND_ACCEPT: Record<PayloadKind, string> = {
  text: "",
  image: "image/*",
  video: "video/*",
  document:
    ".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv,.md,.json,.xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "rtf",
  "odt",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "md",
  "json",
  "xml",
]);

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function detectKind(file: File): PayloadKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("text/")) return "document";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (DOCUMENT_EXTENSIONS.has(extension)) return "document";
  return "document";
}

function modeTone(mode: "embedded" | "external" | undefined) {
  if (mode === "embedded") return "emerald" as const;
  if (mode === "external") return "amber" as const;
  return "slate" as const;
}

export function PayloadPanel() {
  const payload = useStudio((state) => state.payload);
  const payloadContent = useStudio((state) => state.payloadContent);
  const payloadContainer = useStudio((state) => state.payloadContainer);
  const payloadIntegrity = useStudio((state) => state.payloadIntegrity);
  const token = useStudio((state) => state.token);
  const matrix = useStudio((state) => state.matrix);
  const sealPayload = useStudio((state) => state.sealPayload);
  const clearPayload = useStudio((state) => state.clearPayload);
  const loadPayloadContainer = useStudio((state) => state.loadPayloadContainer);
  const notify = useStudio((state) => state.notify);

  const [mode, setMode] = useState<PayloadKind>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const composeInputRef = useRef<HTMLInputElement>(null);
  const containerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewText("");
    setPreviewUrl(null);
    if (!payloadContent) {
      return;
    }
    const url = URL.createObjectURL(payloadContent);
    setPreviewUrl(url);
    if (payload?.kind === "text") {
      payloadContent.text().then((value) => setPreviewText(value));
    }
    return () => URL.revokeObjectURL(url);
  }, [payloadContent, payload]);

  useEffect(() => {
    if (!file) {
      setDraftUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setDraftUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const textBytes = new TextEncoder().encode(text).byteLength;
  const willEmbed = mode === "text" && textBytes > 0 && textBytes <= TEXT_EMBED_LIMIT;
  const draftSize = mode === "text" ? textBytes : file?.size ?? 0;
  const tooLarge = draftSize > MAX_PAYLOAD_BYTES;
  const canSubmit =
    !busy &&
    !tooLarge &&
    (mode === "text" ? text.trim().length > 0 : Boolean(file));

  const acceptFile = (selected: File | null) => {
    setError("");
    if (!selected) {
      setFile(null);
      return;
    }
    const kind = detectKind(selected);
    setMode(kind);
    setFile(selected);
    if (selected.size > MAX_PAYLOAD_BYTES) {
      setError(
        `File is ${formatBytes(selected.size)}. The current limit is ${formatBytes(
          MAX_PAYLOAD_BYTES,
        )}.`,
      );
    }
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      let bytes: Uint8Array;
      let name: string;
      let mime: string;
      let kind: PayloadKind;
      if (mode === "text") {
        bytes = new TextEncoder().encode(text);
        if (bytes.byteLength === 0) {
          throw new Error("Write something before sealing the payload.");
        }
        name = "message.txt";
        mime = "text/plain";
        kind = "text";
      } else {
        if (!file) {
          throw new Error("Choose a file to encrypt.");
        }
        bytes = new Uint8Array(await file.arrayBuffer());
        name = file.name;
        mime = file.type || "application/octet-stream";
        kind = mode;
      }
      if (bytes.byteLength > MAX_PAYLOAD_BYTES) {
        throw new Error(
          `Payload exceeds the ${formatBytes(MAX_PAYLOAD_BYTES)} limit.`,
        );
      }
      const result = await sealPayload({ kind, name, mime, bytes });
      if (!result.ok) {
        throw new Error(result.error ?? "Payload sealing failed.");
      }
      setText("");
      setFile(null);
      if (result.embedded) {
        notify("Payload encrypted and embedded inside the SCM1 token.", "success");
      } else if (result.container) {
        downloadBlob(
          result.container,
          `${safeFilename(matrix.label)}-payload.scm`,
        );
        notify(
          "Payload sealed. Encrypted .scm container downloaded for sharing.",
          "success",
        );
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Payload sealing failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const loadContainerFile = async (selected: File | null) => {
    if (!selected) return;
    const result = await loadPayloadContainer(selected);
    if (!result.ok && result.error) {
      setError(result.error);
    }
    if (containerInputRef.current) {
      containerInputRef.current.value = "";
    }
  };

  const isText = payload?.kind === "text";
  const isImage = payload?.kind === "image";
  const isVideo = payload?.kind === "video";

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<FileLock className="h-3.5 w-3.5" />}
        title="Encrypted Payload"
        hint="Write text or attach an image, video, or document. Content is AES-GCM sealed before it touches the token."
        action={
          <Badge tone={payload ? modeTone(payload.mode) : "slate"}>
            {payload ? payload.mode : "empty"}
          </Badge>
        }
      >
        {payload ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 text-cyan-300">
                  {isImage ? (
                    <Image className="h-4 w-4" />
                  ) : isVideo ? (
                    <Video className="h-4 w-4" />
                  ) : isText ? (
                    <Type className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-slate-200">
                    {payload.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                    {payload.mime} · {formatBytes(payload.size)}
                  </p>
                </div>
              </div>
              <Badge
                tone={
                  payloadIntegrity === false
                    ? "rose"
                    : payloadIntegrity === true
                      ? "emerald"
                      : "amber"
                }
              >
                {payloadIntegrity === false
                  ? "hash fail"
                  : payloadIntegrity === true
                    ? "verified"
                    : "metadata only"}
              </Badge>
            </div>

            <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2">
              <StatRow label="Mode" value={payload.mode} tone={payload.mode === "embedded" ? "emerald" : "amber"} />
              <StatRow label="SHA-256" value={payload.sha256.slice(0, 24) + "…"} />
              <StatRow label="Token" value={`${token.length} chars`} tone="cyan" />
            </div>

            {payloadContent ? (
              <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#05080f]">
                {isText ? (
                  <pre className="scm-scroll max-h-40 overflow-auto whitespace-pre-wrap p-2.5 font-mono text-[10px] leading-relaxed text-slate-300">
                    {previewText.slice(0, 6000)}
                  </pre>
                ) : isImage && previewUrl ? (
                  <img src={previewUrl} alt={payload.name} className="max-h-56 w-full object-contain" />
                ) : isVideo && previewUrl ? (
                  <video src={previewUrl} controls className="max-h-56 w-full bg-black" />
                ) : (
                  <div className="flex items-center gap-2 p-3 text-slate-400">
                    <FileText className="h-7 w-7 text-cyan-300" />
                    <div>
                      <p className="text-[11px] text-slate-200">{payload.name}</p>
                      <p className="font-mono text-[9px] text-slate-500">
                        Encrypted document ready for download
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-2.5">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-[10px] font-medium text-amber-100">
                      External encrypted content
                    </p>
                    <p className="mt-0.5 text-[9px] leading-relaxed text-amber-200/70">
                      The token contains the metadata and hash. Load the matching{" "}
                      <span className="font-mono">.scm</span> container to decrypt the
                      content.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!payloadContent}
                onClick={() => {
                  if (!payloadContent) return;
                  downloadBlob(payloadContent, payload.name);
                }}
              >
                <Download className="h-3 w-3" />
                Decrypted file
              </Button>
              <Button
                size="sm"
                variant="subtle"
                disabled={!payloadContainer}
                onClick={() => {
                  if (!payloadContainer) return;
                  downloadBlob(
                    payloadContainer,
                    `${safeFilename(matrix.label)}-payload.scm`,
                  );
                }}
              >
                <FileArchive className="h-3 w-3" />
                .scm container
              </Button>
            </div>
            <Button
              size="sm"
              variant="danger"
              className="w-full"
              onClick={() => void clearPayload()}
            >
              <Trash className="h-3 w-3" />
              Remove payload from token
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] p-3 text-center">
            <LockKeyhole className="mx-auto h-5 w-5 text-slate-600" />
            <p className="mt-1.5 text-[10px] text-slate-500">
              No content attached. Your SCM1 token currently seals only the matrix and
              anchors.
            </p>
          </div>
        )}
      </PanelSection>

      <PanelSection
        icon={<FileUp className="h-3.5 w-3.5" />}
        title="Compose Content"
        hint={
          willEmbed
            ? "Small text is embedded directly inside the encrypted token."
            : mode === "text"
              ? `Text above ${TEXT_EMBED_LIMIT} bytes is exported as an encrypted .scm container.`
              : "Files are encrypted into a portable .scm container and referenced by hash in the token."
        }
        action={
          <Badge tone={willEmbed ? "emerald" : "amber"}>
            {willEmbed ? "in token" : "container"}
          </Badge>
        }
      >
        <Segmented
          value={mode}
          onChange={(next) => {
            setMode(next);
            setFile(null);
            setError("");
          }}
          options={[
            { value: "text", label: "Text", icon: <Type className="h-3.5 w-3.5" /> },
            { value: "image", label: "Image", icon: <Image className="h-3.5 w-3.5" /> },
            { value: "video", label: "Video", icon: <Video className="h-3.5 w-3.5" /> },
            { value: "document", label: "Doc", icon: <FileText className="h-3.5 w-3.5" /> },
          ]}
          columns={4}
        />

        {mode === "text" ? (
          <div className="mt-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              placeholder="Type the private message, coordinates, recovery note, or any information that should be encrypted…"
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2.5 text-[11px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            />
            <div className="mt-1 flex items-center justify-between font-mono text-[8px] text-slate-500">
              <span>{formatBytes(textBytes)} UTF-8</span>
              <span className={textBytes > TEXT_EMBED_LIMIT ? "text-amber-300" : "text-emerald-300"}>
                {textBytes > TEXT_EMBED_LIMIT
                  ? "external .scm"
                  : `${TEXT_EMBED_LIMIT - textBytes} B QR headroom`}
              </span>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const dropped = event.dataTransfer.files[0];
              if (dropped) acceptFile(dropped);
            }}
            className={`mt-2 rounded-lg border border-dashed p-3 transition-colors ${
              dragging
                ? "border-cyan-400/60 bg-cyan-400/10"
                : "border-white/12 bg-black/20"
            }`}
          >
            <input
              ref={composeInputRef}
              type="file"
              className="hidden"
              accept={KIND_ACCEPT[mode]}
              onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-300">
                    {mode === "image" ? (
                      <Image className="h-5 w-5" />
                    ) : mode === "video" ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-slate-200">{file.name}</p>
                    <p className="font-mono text-[9px] text-slate-500">
                      {file.type || "unknown type"} · {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-slate-500 hover:text-rose-300"
                    aria-label="Remove selected file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {draftUrl && mode === "image" ? (
                  <img src={draftUrl} alt="Payload preview" className="max-h-40 w-full rounded object-contain" />
                ) : null}
                {draftUrl && mode === "video" ? (
                  <video src={draftUrl} controls className="max-h-40 w-full rounded bg-black" />
                ) : null}
                <Button size="sm" variant="ghost" className="w-full" onClick={() => composeInputRef.current?.click()}>
                  <Upload className="h-3 w-3" />
                  Choose another file
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => composeInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1 py-4 text-slate-500 transition-colors hover:text-cyan-200"
              >
                <Upload className="h-5 w-5" />
                <span className="text-[10px]">Drop or choose a {KIND_LABELS[mode].toLowerCase()}</span>
                <span className="font-mono text-[8px] uppercase tracking-wider">
                  max {formatBytes(MAX_PAYLOAD_BYTES)}
                </span>
              </button>
            )}
          </div>
        )}

        {error ? (
          <p className="mt-2 rounded-md border border-rose-400/25 bg-rose-400/10 p-2 text-[10px] text-rose-200">
            {error}
          </p>
        ) : null}

        <Button
          variant="primary"
          size="sm"
          className="mt-2 w-full"
          onClick={() => void submit()}
          disabled={!canSubmit}
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LockKeyhole className="h-3.5 w-3.5" />
          )}
          {busy ? "Encrypting…" : "Encrypt & attach to token"}
        </Button>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500">
          <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-300" />
          AES-GCM + SHA-256 integrity. Device-local processing only.
        </div>
      </PanelSection>

      <PanelSection
        icon={<FileArchive className="h-3.5 w-3.5" />}
        title="Load .scm Container"
        hint="Load an encrypted payload container to restore its token and decrypt the attached content."
        action={<Badge tone="violet">SCMC1</Badge>}
      >
        <input
          ref={containerInputRef}
          type="file"
          className="hidden"
          accept=".scm,application/x-scm-container,application/octet-stream"
          onChange={(event) => void loadContainerFile(event.target.files?.[0] ?? null)}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => containerInputRef.current?.click()}
        >
          <FileUp className="h-3 w-3" />
          Choose encrypted container
        </Button>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500">
          <FileCheck className="h-3 w-3 shrink-0 text-cyan-300" />
          Container integrity is verified against the token hash before loading.
        </div>
        {payloadContainer ? (
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-300">
            <Check className="h-3 w-3" />
            Current container is available for download above.
          </div>
        ) : null}
      </PanelSection>
    </div>
  );
}
