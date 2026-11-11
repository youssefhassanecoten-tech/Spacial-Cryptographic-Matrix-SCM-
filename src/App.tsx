import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, Maximize2, X } from "lucide-react";
import type { StudioTab } from "./types";
import { useStudio } from "./store/useStudio";
import { Header } from "./components/Header";
import { StudioPanel } from "./components/StudioPanel";
import { CanvasOverlay } from "./components/CanvasOverlay";
import { PlaybackBar } from "./components/PlaybackBar";
import { RevealOverlay } from "./components/RevealOverlay";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { UpdateManager } from "./components/UpdateManager";
import { GuestView } from "./components/GuestView";
import { cleanupStaleOpfsPackages } from "./lib/opfs";
import { Toasts } from "./components/Toasts";
import { Scene } from "./components/scene/Scene";

const SHORTCUT_TABS: StudioTab[] = [
  "design",
  "payload",
  "animate",
  "export",
  "verify",
  "decrypt",
  "token",
];

let bootstrapped = false;
const MINI_SIZE = 176;
const MINI_DEFAULT_TOP = 200;
const MINI_POSITION_KEY = "scm-minimap-position";

function clampMiniPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - MINI_SIZE - 8)),
    y: Math.min(
      Math.max(64, y),
      Math.max(64, window.innerHeight - MINI_SIZE - 8),
    ),
  };
}

function loadMiniPosition(): { x: number; y: number } {
  try {
    const raw = window.localStorage.getItem(MINI_POSITION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        return clampMiniPosition(parsed.x, parsed.y);
      }
    }
  } catch {
    return clampMiniPosition(
      window.innerWidth - MINI_SIZE - 12,
      MINI_DEFAULT_TOP,
    );
  }
  return clampMiniPosition(
    window.innerWidth - MINI_SIZE - 12,
    MINI_DEFAULT_TOP,
  );
}

export default function App() {
  const guestMode = useStudio((state) => state.guestMode);
  const sidebarCollapsed = useStudio((state) => state.sidebarCollapsed);
  const drafts = useStudio((state) => state.drafts);
  const sealed = useStudio((state) => state.sealed);
  const gridChoice = useStudio((state) => state.gridChoice);
  const fillChoice = useStudio((state) => state.fillChoice);
  const revealStyle = useStudio((state) => state.revealStyle);
  const savedMobileLayout = useStudio((state) => state.mobileLayout);
  const [queryLayout] = useState<"split" | "drawer" | "tabs" | "minimap" | null>(
    () => {
      const layout = new URLSearchParams(window.location.search).get("layout");
      return layout === "split" ||
        layout === "drawer" ||
        layout === "tabs" ||
        layout === "minimap"
        ? layout
        : null;
    },
  );
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [miniPosition, setMiniPosition] = useState(loadMiniPosition);
  const [isMobileView, setIsMobileView] = useState(() =>
    window.matchMedia("(max-width: 1023px)").matches,
  );
  const miniDragRef = useRef<{ dx: number; dy: number } | null>(null);
  const mobileLayout = queryLayout ?? savedMobileLayout;
  const layout = sidebarCollapsed ? "split" : mobileLayout;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobileView(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const clamp = () =>
      setMiniPosition((current) => clampMiniPosition(current.x, current.y));
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const startMiniDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    miniDragRef.current = {
      dx: event.clientX - miniPosition.x,
      dy: event.clientY - miniPosition.y,
    };
  };

  const moveMiniDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!miniDragRef.current) {
      return;
    }
    event.preventDefault();
    setMiniPosition(
      clampMiniPosition(
        event.clientX - miniDragRef.current.dx,
        event.clientY - miniDragRef.current.dy,
      ),
    );
  };

  const endMiniDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!miniDragRef.current) {
      return;
    }
    miniDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setMiniPosition((current) => {
      try {
        window.localStorage.setItem(
          MINI_POSITION_KEY,
          JSON.stringify(current),
        );
      } catch {
        return current;
      }
      return current;
    });
  };

  useEffect(() => {
    if (bootstrapped) {
      return;
    }
    bootstrapped = true;
    void cleanupStaleOpfsPackages();
    void useStudio.getState().bootstrap();
  }, []);

  useEffect(() => {
    if (sealed || guestMode) {
      return;
    }
    const timer = window.setTimeout(() => {
      useStudio.getState().refreshPreview();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [drafts, sealed, guestMode, gridChoice, fillChoice, revealStyle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || target?.isContentEditable) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        useStudio.getState().togglePlaying();
        return;
      }
      if (event.key.toLowerCase() === "r") {
        useStudio.getState().restartTimeline();
        return;
      }
      if (useStudio.getState().guestMode) {
        return;
      }
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < SHORTCUT_TABS.length) {
        useStudio.getState().setTab(SHORTCUT_TABS[index]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const previewSectionClass =
    layout === "drawer"
      ? `relative order-1 shrink-0 overflow-hidden transition-[height] duration-300 ${
          previewExpanded ? "h-[52vh]" : "h-[26vh]"
        } lg:order-2 lg:h-auto lg:flex-1 lg:shrink`
      : layout === "tabs"
        ? previewModalOpen
          ? "fixed inset-0 z-40 overflow-hidden lg:relative lg:inset-auto lg:z-auto lg:order-2 lg:h-auto lg:flex-1 lg:shrink"
          : "hidden lg:relative lg:order-2 lg:block lg:h-auto lg:flex-1 lg:shrink"
        : layout === "minimap"
          ? previewModalOpen
            ? "fixed inset-0 z-40 overflow-hidden lg:relative lg:inset-auto lg:z-auto lg:order-2 lg:h-auto lg:flex-1 lg:shrink"
            : "fixed z-30 h-44 w-44 overflow-hidden rounded-2xl border border-cyan-400/30 shadow-2xl shadow-cyan-950/50 lg:relative lg:inset-auto lg:z-auto lg:order-2 lg:h-auto lg:w-auto lg:flex-1 lg:shrink lg:rounded-none lg:border-0 lg:shadow-none"
          : sidebarCollapsed
            ? "relative order-1 min-h-0 flex-1 overflow-hidden lg:order-2"
            : "relative order-1 h-[38vh] min-h-[220px] shrink-0 overflow-hidden sm:h-[42vh] lg:order-2 lg:h-auto lg:flex-1 lg:shrink";

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#05070d] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.08),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(167,139,250,0.08),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(251,113,133,0.05),transparent_40%)]" />
      <Header />
      {guestMode ? (
        <GuestView />
      ) : (
        <main className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            className={previewSectionClass}
            style={
              layout === "minimap" && !previewModalOpen && isMobileView
                ? { left: miniPosition.x, top: miniPosition.y }
                : undefined
            }
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(14,116,144,0.14),transparent_58%)]" />
            <Scene />
            {!(layout === "minimap" && !previewModalOpen) ? (
              <>
                <CanvasOverlay />
                <PlaybackBar />
              </>
            ) : (
              <div
                onPointerDown={startMiniDrag}
                onPointerMove={moveMiniDrag}
                onPointerUp={endMiniDrag}
                onPointerCancel={endMiniDrag}
                className="absolute inset-x-0 top-0 z-50 flex h-7 cursor-move touch-none items-center justify-between border-b border-white/10 bg-[#050910]/85 px-2 backdrop-blur"
              >
                <span className="font-mono text-[8px] uppercase tracking-wider text-cyan-200">
                  drag preview
                </span>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setPreviewModalOpen(true)}
                  className="flex h-5 w-5 items-center justify-center text-cyan-200 hover:text-white"
                  aria-label="Expand shape preview"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>
            )}
            {layout === "drawer" ? (
              <button
                type="button"
                onClick={() => setPreviewExpanded((value) => !value)}
                className="absolute bottom-3 left-3 z-30 flex items-center gap-1 rounded-lg border border-white/10 bg-[#050910]/80 px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-cyan-200 backdrop-blur transition-colors hover:border-cyan-400/30 lg:hidden"
              >
                {previewExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
                {previewExpanded ? "Less preview" : "More preview"}
              </button>
            ) : null}
            {previewModalOpen ? (
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#050910]/80 text-slate-300 backdrop-blur lg:hidden"
                aria-label="Close shape preview"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </section>
          {layout === "tabs" && !previewModalOpen ? (
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="fixed bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-[#06101c]/90 px-3 py-2 text-[10px] font-medium text-cyan-100 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl lg:hidden"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Preview
            </button>
          ) : null}
          {!sidebarCollapsed ? (
            <aside className="relative order-2 -mt-3 flex min-h-0 w-full flex-1 flex-col rounded-t-2xl border-t border-white/[0.07] bg-[#070b14]/95 shadow-[0_-18px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:mt-0 sm:rounded-none sm:shadow-none lg:order-1 lg:w-[382px] lg:flex-none lg:border-r lg:border-t-0">
              <StudioPanel />
            </aside>
          ) : null}
        </main>
      )}
      <RevealOverlay />
      <UpdateManager />
      <TutorialOverlay />
      <Toasts />
    </div>
  );
}
