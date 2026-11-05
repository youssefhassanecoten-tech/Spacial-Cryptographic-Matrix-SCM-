import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CircleCheck,
  CircleX,
  FlaskConical,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import type { TrajectoryResult, VerificationResult } from "../../types";
import {
  alignmentSignature,
  anchorCenterSignature,
  bitstreamSignature,
  executionSignature,
  matrixSignature,
} from "../../lib/scm";
import { runAllVerification } from "../../lib/verify";
import { useStudio } from "../../store/useStudio";
import { Badge, Button, PanelSection, StatRow } from "../ui";

function ConstellationPlot({ trajectory }: { trajectory: TrajectoryResult | null }) {
  const size = 240;
  const pad = 22;
  if (!trajectory) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 text-center">
        <div>
          <ScanLine className="mx-auto h-6 w-6 text-slate-600" />
          <p className="mt-2 text-[10px] text-slate-500">
            Run verification to flatten the constellation glyph.
          </p>
        </div>
      </div>
    );
  }
  const scaleX = (value: number) => pad + value * (size - pad * 2);
  const scaleY = (value: number) => pad + (1 - value) * (size - pad * 2);
  const points = trajectory.constellation
    .map((point) => `${scaleX(point.x).toFixed(2)},${scaleY(point.y).toFixed(2)}`)
    .join(" ");
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#05080f]">
      <svg viewBox={`0 0 ${size} ${size}`} className="block w-full">
        <defs>
          <linearGradient id="constellation-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.55" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
          <radialGradient id="constellation-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0.2" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={size} height={size} fill="#05080f" />
        <rect width={size} height={size} fill="url(#constellation-glow)" />
        <g stroke="#1e293b" strokeWidth="0.6" opacity="0.65">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((line) => {
            const position = (size / 9) * line;
            return (
              <g key={line}>
                <line x1={position} y1={0} x2={position} y2={size} />
                <line x1={0} y1={position} x2={size} y2={position} />
              </g>
            );
          })}
        </g>
        <polyline
          points={points}
          fill="none"
          stroke="url(#constellation-line)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {trajectory.constellation.map((point, index) => (
          <circle
            key={index}
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r="1.7"
            fill="#e2e8f0"
            opacity="0.8"
          />
        ))}
        {trajectory.constellationAnchors.map((point, index) => (
          <g key={`anchor-${index}`}>
            <circle
              cx={scaleX(point.x)}
              cy={scaleY(point.y)}
              r="6"
              fill="none"
              stroke="#5eead4"
              strokeWidth="1.2"
              opacity="0.9"
            />
            <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r="2" fill="#5eead4" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function ResultCard({ result }: { result: VerificationResult }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        result.passed
          ? "border-emerald-400/25 bg-emerald-400/[0.05]"
          : "border-rose-400/25 bg-rose-400/[0.05]"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={result.passed ? "text-emerald-300" : "text-rose-300"}>
          {result.passed ? (
            <CircleCheck className="h-4 w-4" />
          ) : (
            <CircleX className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-slate-100">
              Test {result.id} · {result.name}
            </p>
            <Badge tone={result.passed ? "emerald" : "rose"}>
              {result.passed ? "pass" : "fail"}
            </Badge>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{result.detail}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {Object.entries(result.metrics).map(([key, value]) => (
              <div
                key={key}
                className="rounded-md border border-white/[0.06] bg-black/25 px-1.5 py-1"
              >
                <span className="block text-[8px] uppercase tracking-wider text-slate-500">
                  {key}
                </span>
                <span className="block truncate font-mono text-[9px] text-slate-300">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-right font-mono text-[8px] text-slate-600">
            {result.durationMs.toFixed(1)} ms
          </p>
        </div>
      </div>
    </div>
  );
}

export function VerifyPanel() {
  const matrix = useStudio((state) => state.matrix);
  const token = useStudio((state) => state.token);
  const tokenStatus = useStudio((state) => state.tokenStatus);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const lastRunKey = useRef("");

  const signatures = useMemo(
    () => ({
      matrix: matrixSignature(matrix),
      bitstream: bitstreamSignature(matrix),
      anchors: anchorCenterSignature(matrix),
      alignment: alignmentSignature(matrix),
      execution: executionSignature(matrix),
    }),
    [matrix],
  );

  const execute = async () => {
    setRunning(true);
    setError("");
    try {
      const run = await runAllVerification();
      setResults(run.results);
      setTrajectory(run.trajectory);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Verification crashed.");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (tokenStatus !== "ready" || !token) {
      return;
    }
    const key = `${matrix.id}:${token.length}`;
    if (lastRunKey.current === key) {
      return;
    }
    lastRunKey.current = key;
    void execute();
  }, [matrix.id, token, tokenStatus]);

  const passed = results.length > 0 && results.every((result) => result.passed);
  const autoRan = results.length > 0;

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<FlaskConical className="h-3.5 w-3.5" />}
        title="Verification Pipeline"
        hint="Runtime tests execute against the live store, token decryptor, and trajectory engine."
        action={
          <Badge tone={running ? "amber" : passed ? "emerald" : autoRan ? "rose" : "slate"}>
            {running ? "running" : passed ? "all pass" : autoRan ? "attention" : "idle"}
          </Badge>
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              Invariants
            </span>
            <p className="mt-1 font-mono text-[9px] text-slate-300">bitstream</p>
            <p className="font-mono text-[9px] text-slate-300">anchor centers</p>
            <p className="font-mono text-[9px] text-slate-300">alignment path</p>
            <p className="font-mono text-[9px] text-slate-300">execution order</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
              <KeyRound className="h-3 w-3 text-cyan-300" />
              Token engine
            </span>
            <p className="mt-1 font-mono text-[9px] text-slate-300">AES-GCM decrypt</p>
            <p className="font-mono text-[9px] text-slate-300">PRNG reconstruction</p>
            <p className="font-mono text-[9px] text-slate-300">3D path trace</p>
            <p className="font-mono text-[9px] text-slate-300">2D constellation</p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="mt-2 w-full"
          onClick={() => void execute()}
          disabled={running || tokenStatus !== "ready"}
        >
          {running ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {running ? "Running live verification…" : "Run Test E + F"}
        </Button>
        {tokenStatus !== "ready" ? (
          <p className="mt-1.5 text-center text-[9px] text-amber-300">
            Waiting for the token engine to finish sealing the matrix.
          </p>
        ) : null}
        {error ? (
          <p className="mt-1.5 rounded-md border border-rose-400/25 bg-rose-400/10 p-2 text-[10px] text-rose-200">
            {error}
          </p>
        ) : null}
      </PanelSection>

      <div className="space-y-2">
        {results.length > 0 ? (
          results.map((result) => <ResultCard key={result.id} result={result} />)
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-4 text-center">
            <Activity className="mx-auto h-6 w-6 text-slate-600" />
            <p className="mt-2 text-[10px] text-slate-500">
              Test E and F run automatically once the encrypted token is ready.
            </p>
          </div>
        )}
      </div>

      <PanelSection
        icon={<ScanLine className="h-3.5 w-3.5" />}
        title="2D Constellation Glyph"
        hint="The decrypted 3D trajectory flattened into a verified unit-square glyph."
        action={<Badge tone="violet">flattened</Badge>}
      >
        <ConstellationPlot trajectory={trajectory} />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-md border border-white/[0.06] bg-black/25 p-1.5">
            <span className="block text-[8px] uppercase tracking-wider text-slate-500">
              trace hash
            </span>
            <span className="block truncate font-mono text-[9px] text-cyan-300">
              {trajectory?.signature ?? "—"}
            </span>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/25 p-1.5">
            <span className="block text-[8px] uppercase tracking-wider text-slate-500">
              glyph hash
            </span>
            <span className="block truncate font-mono text-[9px] text-violet-300">
              {trajectory?.constellationSignature ?? "—"}
            </span>
          </div>
        </div>
      </PanelSection>

      <PanelSection
        icon={<BadgeCheck className="h-3.5 w-3.5" />}
        title="Live Matrix Signatures"
        hint="These hashes must remain constant while you customize the render studio."
      >
        <StatRow label="matrix" value={signatures.matrix} tone="cyan" />
        <StatRow label="bitstream" value={signatures.bitstream} tone="emerald" />
        <StatRow label="anchor centers" value={signatures.anchors} />
        <StatRow label="alignment path" value={signatures.alignment} />
        <StatRow label="execution order" value={signatures.execution} />
      </PanelSection>
    </div>
  );
}
