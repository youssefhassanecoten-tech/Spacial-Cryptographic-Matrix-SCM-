import { useEffect } from "react";
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

export default function App() {
  const guestMode = useStudio((state) => state.guestMode);
  const sidebarCollapsed = useStudio((state) => state.sidebarCollapsed);
  const drafts = useStudio((state) => state.drafts);
  const sealed = useStudio((state) => state.sealed);
  const gridChoice = useStudio((state) => state.gridChoice);
  const fillChoice = useStudio((state) => state.fillChoice);
  const revealStyle = useStudio((state) => state.revealStyle);

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

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#05070d] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.08),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(167,139,250,0.08),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(251,113,133,0.05),transparent_40%)]" />
      <Header />
      {guestMode ? (
        <GuestView />
      ) : (
        <main className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            className={
              sidebarCollapsed
                ? "relative order-1 min-h-0 flex-1 overflow-hidden lg:order-2"
                : "relative order-1 h-[38vh] min-h-[220px] shrink-0 overflow-hidden sm:h-[42vh] lg:order-2 lg:h-auto lg:flex-1 lg:shrink"
            }
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(14,116,144,0.14),transparent_58%)]" />
            <Scene />
            <CanvasOverlay />
            <PlaybackBar />
          </section>
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
