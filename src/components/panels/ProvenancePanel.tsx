import { useEffect, useState } from "react";
import { BadgeCheck, Download, KeyRound, Stamp, Upload } from "lucide-react";
import { downloadText } from "../../lib/download";
import {
  clearProjectSecretKey,
  createProvenanceRecord,
  getDevicePublicKey,
  getProjectSecretKey,
  importProjectSecretKey,
  verifyProvenanceRecord,
  type ProvenanceKeyType,
  type ProvenanceRecord,
} from "../../lib/provenance";
import { decodeShapeToken } from "../../lib/vault";
import { useStudio } from "../../store/useStudio";
import { Badge, Button, PanelSection, Segmented } from "../ui";

export function ProvenancePanel() {
  const matrix = useStudio((state) => state.matrix);
  const shapeToken = useStudio((state) => state.shapeToken);
  const packageBlob = useStudio((state) => state.packageBlob);
  const notify = useStudio((state) => state.notify);
  const [issuerName, setIssuerName] = useState("");
  const [keyType, setKeyType] = useState<ProvenanceKeyType>("device");
  const [devicePublicKey, setDevicePublicKey] = useState("");
  const [projectKeyInput, setProjectKeyInput] = useState("");
  const [projectPublicKey, setProjectPublicKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getDevicePublicKey()
      .then(setDevicePublicKey)
      .catch(() => setDevicePublicKey(""));
  }, []);

  const sign = async () => {
    if (!shapeToken) {
      notify("Seal an SCM before signing provenance.", "error");
      return;
    }
    setBusy(true);
    try {
      const shape = decodeShapeToken(shapeToken);
      const record = await createProvenanceRecord({
        keyType,
        issuerName,
        shapeId: shape.shapeId,
        tokenId: matrix.id,
        packageBlob,
      });
      await downloadText(
        JSON.stringify(record, null, 2),
        `${matrix.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "scm"}.provenance.json`,
        "application/json",
      );
      notify("Signed provenance record downloaded.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to sign provenance.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const importProject = async () => {
    try {
      const publicKey = await importProjectSecretKey(projectKeyInput);
      setProjectPublicKey(publicKey);
      setProjectKeyInput("");
      notify("Project signing key imported on this device.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to import project key.",
        "error",
      );
    }
  };

  const verifyFile = async (file: File) => {
    try {
      const record = JSON.parse(await file.text()) as ProvenanceRecord;
      const valid = await verifyProvenanceRecord(record);
      notify(
        valid
          ? `Provenance valid: ${record.issuerName}.`
          : "Provenance signature is invalid.",
        valid ? "success" : "error",
      );
    } catch {
      notify("Provenance file is not valid JSON.", "error");
    }
  };

  return (
    <PanelSection
      icon={<Stamp className="h-3.5 w-3.5" />}
      title="Signed Provenance"
      hint="Sign the shape commitment and package hash with Ed25519. The private key stays on this device."
      action={<Badge tone="violet">issuer</Badge>}
    >
      <input
        value={issuerName}
        onChange={(event) => setIssuerName(event.target.value)}
        placeholder="Issuer name (optional)"
        maxLength={64}
        className="h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 font-mono text-[10px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
      />
      <div className="mt-2">
        <Segmented
          value={keyType}
          onChange={(value) => setKeyType(value as ProvenanceKeyType)}
          options={[
            { value: "device", label: "Device key" },
            { value: "project", label: "Project key" },
          ]}
          columns={2}
        />
      </div>
      <div className="mt-2 rounded-lg border border-white/[0.06] bg-black/20 p-2">
        <p className="text-[8px] uppercase tracking-wider text-slate-500">
          Device public key
        </p>
        <p className="mt-1 break-all font-mono text-[8px] leading-relaxed text-cyan-200">
          {devicePublicKey || "generating..."}
        </p>
        {projectPublicKey || getProjectSecretKey() ? (
          <p className="mt-2 break-all font-mono text-[8px] leading-relaxed text-violet-200">
            Project: {projectPublicKey || "imported"}
          </p>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
        <input
          type="password"
          value={projectKeyInput}
          onChange={(event) => setProjectKeyInput(event.target.value)}
          placeholder="Paste project Ed25519 secret key"
          className="h-9 min-w-0 rounded-lg border border-white/10 bg-black/30 px-2.5 font-mono text-[9px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => void importProject()}
          disabled={!projectKeyInput.trim()}
        >
          <KeyRound className="h-3 w-3" />
          Import
        </Button>
      </div>
      {getProjectSecretKey() ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1.5 w-full"
          onClick={() => {
            clearProjectSecretKey();
            setProjectPublicKey("");
            notify("Project signing key removed from this device.", "info");
          }}
        >
          Clear project key
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="primary"
        className="mt-2 w-full"
        disabled={busy || !shapeToken}
        onClick={() => void sign()}
      >
        <Download className="h-3 w-3" />
        {busy ? "Signing..." : "Sign current SCM"}
      </Button>
      <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-2 py-2 text-[9px] text-slate-400 hover:border-cyan-400/30 hover:text-cyan-200">
        <Upload className="h-3 w-3" />
        Verify provenance JSON
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void verifyFile(file);
            }
            event.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 flex items-start gap-1.5 text-[9px] leading-relaxed text-slate-500">
        <BadgeCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
        Device keys are stored locally in this browser. For organizational
        signing, import a dedicated project key and keep it offline.
      </p>
    </PanelSection>
  );
}
