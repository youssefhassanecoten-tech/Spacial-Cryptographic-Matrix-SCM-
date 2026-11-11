import {
  CircleAlert,
  CircleCheck,
  CircleX,
  X,
} from "lucide-react";
import { useStudio } from "../store/useStudio";

export function Toasts() {
  const toast = useStudio((state) => state.toast);
  const dismissToast = useStudio((state) => state.dismissToast);

  if (!toast) {
    return null;
  }

  const tone = {
    info: {
      border: "border-cyan-400/25",
      background: "bg-[#071018]/95",
      color: "text-cyan-200",
      icon: <CircleAlert className="h-4 w-4" />,
    },
    success: {
      border: "border-emerald-400/25",
      background: "bg-[#061310]/95",
      color: "text-emerald-200",
      icon: <CircleCheck className="h-4 w-4" />,
    },
    error: {
      border: "border-rose-400/25",
      background: "bg-[#16080c]/95",
      color: "text-rose-200",
      icon: <CircleX className="h-4 w-4" />,
    },
  }[toast.tone];

  return (
    <div
      className={`fixed bottom-4 right-3 top-auto z-50 flex max-w-sm animate-[scm-toast_180ms_ease-out] items-start gap-2 rounded-xl border ${tone.border} ${tone.background} px-3 py-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:bottom-auto sm:top-16`}
      role="status"
    >
      <span className={`mt-0.5 ${tone.color}`}>{tone.icon}</span>
      <p className="text-[11px] leading-relaxed text-slate-200">{toast.message}</p>
      <button
        type="button"
        onClick={dismissToast}
        className="ml-1 text-slate-500 transition-colors hover:text-slate-200"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
