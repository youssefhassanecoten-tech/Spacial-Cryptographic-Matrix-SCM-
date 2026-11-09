import { useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Boxes,
  ChevronDown,
  ChevronUp,
  Clock3,
  GripVertical,
  Layers,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ScanLine,
  SkipBack,
  Sparkles,
  Trash,
  Zap,
} from "lucide-react";
import type {
  AnimationLayer,
  AnimationType,
  EasingName,
  ExplosionType,
} from "../../types";
import {
  ANIMATION_TYPES,
  EASING_LABELS,
  EASING_NAMES,
} from "../../lib/animation";
import {
  EXPLOSION_HINTS,
  EXPLOSION_LABELS,
  EXPLOSION_TYPES,
} from "../../lib/reveal";
import { useStudio } from "../../store/useStudio";
import {
  Badge,
  Button,
  Divider,
  PanelSection,
  Segmented,
  Slider,
} from "../ui";

const TYPE_ICON: Record<AnimationType, ReactNode> = {
  explode: <Boxes className="h-3.5 w-3.5" />,
  layerWave: <Layers className="h-3.5 w-3.5" />,
  pulse: <Activity className="h-3.5 w-3.5" />,
  glow: <Zap className="h-3.5 w-3.5" />,
  scanline: <ScanLine className="h-3.5 w-3.5" />,
};

const TYPE_LABEL: Record<AnimationType, string> = {
  explode: "Explode",
  layerWave: "Layer Wave",
  pulse: "Pulse",
  glow: "Glow",
  scanline: "Scanline",
};

const TYPE_COLOR: Record<AnimationType, string> = {
  explode: "from-cyan-400 to-sky-500",
  layerWave: "from-violet-400 to-indigo-500",
  pulse: "from-emerald-400 to-teal-500",
  glow: "from-amber-300 to-orange-500",
  scanline: "from-rose-400 to-pink-500",
};

function LayerSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
        enabled ? "bg-cyan-400" : "bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full bg-slate-950 transition-transform ${
          enabled ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function LayerSettings({
  layer,
  onChange,
}: {
  layer: AnimationLayer;
  onChange: (patch: Partial<AnimationLayer>) => void;
}) {
  const showAxis = layer.type === "layerWave" || layer.type === "scanline";
  const showMode = layer.type === "layerWave";
  return (
    <div className="mt-2 space-y-2.5 rounded-lg border border-white/[0.05] bg-black/20 p-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Slider
          label="Delay"
          value={layer.delay}
          min={0}
          max={4}
          step={0.05}
          onChange={(delay) => onChange({ delay })}
          format={(value) => `${value.toFixed(2)}s`}
        />
        <Slider
          label="Duration"
          value={layer.duration}
          min={0.2}
          max={8}
          step={0.1}
          onChange={(duration) => onChange({ duration })}
          format={(value) => `${value.toFixed(1)}s`}
        />
        <Slider
          label="Intensity"
          value={layer.intensity}
          min={0}
          max={1.5}
          step={0.05}
          onChange={(intensity) => onChange({ intensity })}
          format={(value) => value.toFixed(2)}
        />
        <Slider
          label="Repeat"
          value={layer.repeat}
          min={0}
          max={8}
          step={1}
          onChange={(repeat) => onChange({ repeat })}
          format={(value) => (value === 0 ? "∞ loop" : `${value}×`)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Easing
          </span>
          <select
            value={layer.easing}
            onChange={(event) => onChange({ easing: event.target.value as EasingName })}
            className="h-8 w-full rounded-md border border-white/10 bg-[#080d17] px-2 text-[10px] text-slate-200 focus:border-cyan-400/50 focus:outline-none"
          >
            {EASING_NAMES.map((name) => (
              <option key={name} value={name}>
                {EASING_LABELS[name]}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Cycles
          </span>
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-[#080d17] px-2 font-mono text-[10px] text-slate-300">
            <Clock3 className="h-3 w-3 text-cyan-400" />
            {(layer.delay + layer.duration * (layer.repeat || 1)).toFixed(1)}s window
          </div>
        </div>
      </div>
      {showAxis ? (
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Sweep Axis
          </span>
          <Segmented
            value={layer.axis}
            onChange={(axis) => onChange({ axis })}
            options={[
              { value: "x", label: "X" },
              { value: "y", label: "Y" },
              { value: "z", label: "Z" },
            ]}
          />
        </div>
      ) : null}
      {showMode ? (
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Reveal Pattern
          </span>
          <Segmented
            value={layer.mode}
            onChange={(mode) => onChange({ mode })}
            options={[
              { value: "slice", label: "Slice" },
              { value: "spiral", label: "Anchor Spiral" },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AnimatePanel() {
  const layers = useStudio((state) => state.layers);
  const setLayer = useStudio((state) => state.setLayer);
  const toggleLayer = useStudio((state) => state.toggleLayer);
  const moveLayer = useStudio((state) => state.moveLayer);
  const reorderLayers = useStudio((state) => state.reorderLayers);
  const removeLayer = useStudio((state) => state.removeLayer);
  const addLayer = useStudio((state) => state.addLayer);
  const resetLayers = useStudio((state) => state.resetLayers);
  const playing = useStudio((state) => state.playing);
  const togglePlaying = useStudio((state) => state.togglePlaying);
  const restartTimeline = useStudio((state) => state.restartTimeline);
  const speed = useStudio((state) => state.speed);
  const setSpeed = useStudio((state) => state.setSpeed);
  const revealStyle = useStudio((state) => state.revealStyle);
  const setRevealStyle = useStudio((state) => state.setRevealStyle);
  const [expanded, setExpanded] = useState<string | null>(layers[0]?.id ?? null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const enabledCount = layers.filter((layer) => layer.enabled).length;
  const total = Math.max(
    4,
    ...layers.map((layer) => layer.delay + layer.duration * (layer.repeat || 1)),
  );

  const applyPreset = (preset: "ambient" | "reveal" | "scan" | "clear") => {
    for (const layer of layers) {
      if (preset === "ambient") {
        setLayer(layer.id, {
          enabled: layer.type === "pulse" || layer.type === "glow",
          delay: 0,
        });
      } else if (preset === "reveal") {
        setLayer(layer.id, {
          enabled: layer.type === "explode" || layer.type === "layerWave",
          delay: layer.type === "layerWave" ? 0.15 : 0,
          duration: layer.type === "explode" ? 2.6 : 2.8,
          repeat: 1,
        });
      } else if (preset === "scan") {
        setLayer(layer.id, {
          enabled: layer.type === "scanline" || layer.type === "glow",
          delay: 0,
        });
      } else {
        setLayer(layer.id, { enabled: false });
      }
    }
  };

  return (
    <div className="space-y-3">
      <PanelSection
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Reveal Explosion"
        hint={`${EXPLOSION_HINTS[revealStyle]} The selected type is written into the token as a versioned reveal directive.`}
        action={<Badge tone="violet">token v1</Badge>}
      >
        <Segmented
          value={revealStyle}
          onChange={(value) => setRevealStyle(value as ExplosionType)}
          options={EXPLOSION_TYPES.map((type) => ({
            value: type,
            label: EXPLOSION_LABELS[type],
          }))}
          columns={3}
        />
        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
          Unknown or newer explosion types fall back to Radial on older builds, so
          tokens stay readable.
        </p>
      </PanelSection>

      <PanelSection
        icon={<Activity className="h-3.5 w-3.5" />}
        title="Cascade Timeline"
        hint="Layer order is reorderable. All animation is visual-only and anchor-safe."
        action={<Badge tone="cyan">{enabledCount} live</Badge>}
      >
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant={playing ? "subtle" : "primary"} onClick={togglePlaying}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="outline" onClick={restartTimeline}>
            <SkipBack className="h-3.5 w-3.5" />
            Restart
          </Button>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5">
            {[0.5, 1, 2].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSpeed(value)}
                className={`rounded px-1.5 py-1 font-mono text-[9px] transition-colors ${
                  speed === value
                    ? "bg-cyan-400/20 text-cyan-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {value}×
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {layers.map((layer) => (
            <div key={layer.id} className="flex items-center gap-1.5">
              <span className="w-14 shrink-0 truncate font-mono text-[8px] uppercase tracking-wider text-slate-600">
                {TYPE_LABEL[layer.type]}
              </span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className={`absolute inset-y-0 rounded-full bg-gradient-to-r ${TYPE_COLOR[layer.type]} ${
                    layer.enabled ? "opacity-90" : "opacity-20"
                  }`}
                  style={{
                    left: `${(layer.delay / total) * 100}%`,
                    width: `${Math.max(
                      2,
                      ((layer.duration * (layer.repeat || 1)) / total) * 100,
                    )}%`,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[8px] text-slate-600">
                {layer.repeat === 0 ? "∞" : `×${layer.repeat}`}
              </span>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection
        icon={<Layers className="h-3.5 w-3.5" />}
        title="Animation Layers"
        hint="Drag a layer to reorder. Delay, duration, easing, and cycles are per layer."
      >
        <div className="space-y-1.5">
          {layers.map((layer, index) => {
            const isOpen = expanded === layer.id;
            return (
              <div
                key={layer.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) {
                    reorderLayers(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`rounded-lg border transition-colors ${
                  layer.enabled
                    ? "border-cyan-400/20 bg-cyan-400/[0.035]"
                    : "border-white/[0.06] bg-white/[0.015]"
                } ${dragIndex === index ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-1.5 p-1.5">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-600" />
                  <span className={layer.enabled ? "text-cyan-300" : "text-slate-500"}>
                    {TYPE_ICON[layer.type]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : layer.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[11px] font-medium text-slate-200">
                      {layer.name}
                    </span>
                    <span className="block truncate font-mono text-[8px] text-slate-500">
                      {layer.duration.toFixed(1)}s ·{" "}
                      {layer.repeat === 0 ? "continuous" : `${layer.repeat}×`} ·{" "}
                      {EASING_LABELS[layer.easing]}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(layer.id, -1)}
                    disabled={index === 0}
                    className="text-slate-600 transition-colors hover:text-slate-200 disabled:opacity-25"
                    aria-label="Move layer up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(layer.id, 1)}
                    disabled={index === layers.length - 1}
                    className="text-slate-600 transition-colors hover:text-slate-200 disabled:opacity-25"
                    aria-label="Move layer down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <LayerSwitch enabled={layer.enabled} onChange={() => toggleLayer(layer.id)} />
                  <button
                    type="button"
                    onClick={() => removeLayer(layer.id)}
                    className="text-slate-600 transition-colors hover:text-rose-300"
                    aria-label="Delete layer"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
                {isOpen ? (
                  <div className="px-1.5 pb-1.5">
                    <LayerSettings
                      layer={layer}
                      onChange={(patch) => setLayer(layer.id, patch)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <Divider className="my-2.5" />
        <div className="flex flex-wrap gap-1">
          {ANIMATION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addLayer(type)}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-1.5 py-1 text-[9px] text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
            >
              <Plus className="h-2.5 w-2.5" />
              {TYPE_LABEL[type]}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Cascade Presets"
        hint="Presets only adjust visual layers; the matrix token remains byte-identical."
      >
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => applyPreset("ambient")}>
            Ambient Loop
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("reveal")}>
            Full Reveal
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("scan")}>
            Scan Lab
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("clear")}>
            Mute All
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="mt-1.5 w-full"
          onClick={resetLayers}
        >
          <RotateCcw className="h-3 w-3" />
          Restore default cascade
        </Button>
      </PanelSection>

      <div className="flex items-center justify-between px-1 text-[9px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Non-destructive render layer
        </span>
        <span className="font-mono">speed {speed}×</span>
      </div>
    </div>
  );
}

