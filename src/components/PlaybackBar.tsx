import { useEffect, useRef } from "react";
import { Pause, Play, SkipBack } from "lucide-react";
import { useStudio } from "../store/useStudio";

function formatTime(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const tenths = Math.floor((value % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function TimeReadout({ total }: { total: number }) {
  const timeRef = useStudio((state) => state.timeRef);
  const textRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (textRef.current) {
        textRef.current.textContent = formatTime(timeRef.current);
      }
      if (barRef.current) {
        barRef.current.style.width = `${((timeRef.current % total) / total) * 100}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [timeRef, total]);

  return (
    <>
      <span
        ref={textRef}
        className="w-14 text-center font-mono text-[10px] tabular-nums text-cyan-200"
      >
        00:00.0
      </span>
      <span className="relative hidden h-1 w-24 overflow-hidden rounded-full bg-white/[0.08] sm:block">
        <span
          ref={barRef}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
          style={{ width: "0%" }}
        />
      </span>
    </>
  );
}

export function PlaybackBar() {
  const playing = useStudio((state) => state.playing);
  const togglePlaying = useStudio((state) => state.togglePlaying);
  const restartTimeline = useStudio((state) => state.restartTimeline);
  const speed = useStudio((state) => state.speed);
  const setSpeed = useStudio((state) => state.setSpeed);
  const layers = useStudio((state) => state.layers);
  const enabled = layers.filter((layer) => layer.enabled).length;
  const total = Math.max(
    4,
    ...layers.map((layer) => layer.delay + layer.duration * (layer.repeat || 1)),
  );

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-white/10 bg-[#050910]/80 px-2 py-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <button
        type="button"
        onClick={restartTimeline}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        aria-label="Restart timeline"
        title="Restart timeline (R)"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={togglePlaying}
        className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-colors ${
          playing
            ? "bg-cyan-400/15 text-cyan-200"
            : "bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]"
        }`}
        aria-label={playing ? "Pause animations" : "Play animations"}
        title="Play / pause (Space)"
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {playing ? "Live" : "Paused"}
      </button>
      <TimeReadout total={total} />
      <span className="hidden font-mono text-[8px] uppercase tracking-wider text-slate-500 md:block">
        {enabled} layers
      </span>
      <span className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-0.5">
        {[0.5, 1, 2].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSpeed(value)}
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] transition-colors ${
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
  );
}
