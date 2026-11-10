import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Sparkles,
  X,
} from "lucide-react";
import {
  TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  type TutorialStep,
} from "../lib/tutorial";
import { APP_VERSION, compareVersions } from "../lib/updates";
import { useStudio } from "../store/useStudio";
import { useTutorial } from "../store/useTutorial";
import { Badge, Button } from "./ui";

type TutorialMode = "welcome" | "new" | "replay";

function readSeenVersion(): string | null {
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSeenVersion(): void {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, APP_VERSION);
  } catch {
    return;
  }
}

function stepsFor(seenVersion: string | null, replayAll: boolean): TutorialStep[] {
  if (replayAll || !seenVersion) {
    return TUTORIAL_STEPS;
  }
  const fresh = TUTORIAL_STEPS.filter(
    (step) => compareVersions(step.sinceVersion, seenVersion) > 0,
  );
  return fresh.length > 0 ? fresh : TUTORIAL_STEPS;
}

export function TutorialOverlay() {
  const open = useTutorial((state) => state.open);
  const replayAll = useTutorial((state) => state.replayAll);
  const hide = useTutorial((state) => state.hide);
  const [steps, setSteps] = useState<TutorialStep[]>(TUTORIAL_STEPS);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<TutorialMode>("welcome");

  useEffect(() => {
    const seen = readSeenVersion();
    if (!seen) {
      useTutorial.getState().show(false);
      return;
    }
    const fresh = TUTORIAL_STEPS.filter(
      (step) => compareVersions(step.sinceVersion, seen) > 0,
    );
    if (fresh.length > 0) {
      useTutorial.getState().show(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const seen = readSeenVersion();
    setMode(!seen ? "welcome" : replayAll ? "replay" : "new");
    setSteps(stepsFor(seen, replayAll));
    setIndex(0);
  }, [open, replayAll]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const tab = steps[index]?.tab;
    if (tab) {
      useStudio.getState().setTab(tab);
    }
  }, [open, index, steps]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        writeSeenVersion();
        hide();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, hide]);

  if (!open || steps.length === 0) {
    return null;
  }

  const step = steps[index] ?? steps[0];
  const last = index === steps.length - 1;
  const finish = () => {
    writeSeenVersion();
    hide();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#02050b]/82 p-3 backdrop-blur-md">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#071018]/97 shadow-2xl shadow-cyan-950/50">
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                {mode === "welcome"
                  ? "Welcome tour"
                  : mode === "replay"
                    ? "Tutorial replay"
                    : `What's new in v${APP_VERSION}`}
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-100">
                {step.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={finish}
            className="text-slate-500 transition-colors hover:text-slate-200"
            aria-label="Close tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 py-4">
          <p className="text-[11px] leading-relaxed text-slate-400">{step.body}</p>
          {step.bullets ? (
            <ul className="mt-3 space-y-1.5">
              {step.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2 text-[10px] leading-relaxed text-slate-300"
                >
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {step.tab ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/[0.07] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-violet-200">
              <Sparkles className="h-3 w-3" />
              {step.tab} tab
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-1">
            {steps.map((entry, dotIndex) => (
              <span
                key={entry.id}
                className={`h-1.5 rounded-full transition-all ${
                  dotIndex === index
                    ? "w-4 bg-cyan-300"
                    : dotIndex < index
                      ? "w-1.5 bg-cyan-500/60"
                      : "w-1.5 bg-slate-700"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge tone="slate">
              {index + 1} / {steps.length}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={finish}
            >
              Skip
            </Button>
            {index > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (last) {
                  finish();
                } else {
                  setIndex((value) => Math.min(steps.length - 1, value + 1));
                }
              }}
            >
              {last ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
              {last ? "Finish" : "Next"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
