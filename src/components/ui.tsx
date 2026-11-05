import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "icon";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border border-cyan-300/40 bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-300",
  outline:
    "border border-white/12 bg-white/[0.035] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]",
  ghost: "border border-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white",
  danger:
    "border border-rose-400/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25",
  subtle:
    "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[11px]",
  md: "h-9 px-3.5 text-xs",
  icon: "h-9 w-9",
};

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
        active
          ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-[0_0_18px_-4px] shadow-cyan-400/40"
          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "cyan" | "violet" | "rose" | "amber" | "emerald";
  className?: string;
}) {
  const tones = {
    slate: "border-white/10 bg-white/[0.04] text-slate-300",
    cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    violet: "border-violet-400/25 bg-violet-400/10 text-violet-200",
    rose: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PanelSection({
  icon,
  title,
  hint,
  action,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-white/[0.07] bg-white/[0.022] p-3",
        className,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {icon ? <span className="text-cyan-400">{icon}</span> : null}
            {title}
          </div>
          {hint ? (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{hint}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-medium text-slate-300">
        {label}
        {hint ? <span className="font-mono text-[9px] text-slate-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-300">{label}</span>
        <span className="font-mono text-[10px] text-cyan-300">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        className="scm-range w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="mt-1 text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  icon,
  compact,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 text-left transition-colors",
        compact ? "py-1.5" : "py-2",
        checked
          ? "border-cyan-400/25 bg-cyan-400/[0.07]"
          : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span className={checked ? "text-cyan-300" : "text-slate-500"}>{icon}</span>
        ) : null}
        <span className="min-w-0">
          <span className="block text-[11px] font-medium text-slate-200">{label}</span>
          {description ? (
            <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
              {description}
            </span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          checked ? "bg-cyan-400" : "bg-slate-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-slate-950 transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  columns,
}: {
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-1"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-all",
              active
                ? "bg-cyan-400/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.32)]"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
            )}
          >
            {option.icon ? (
              <span className={active ? "text-cyan-300" : "text-slate-500"}>
                {option.icon}
              </span>
            ) : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5 transition-colors hover:border-white/15">
      <span
        className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md ring-1 ring-white/15"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium text-slate-300">{label}</span>
        <span className="block font-mono text-[9px] uppercase text-slate-500">{value}</span>
      </span>
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30",
        className,
      )}
      {...props}
    />
  );
}

export function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "cyan" | "rose" | "emerald" | "violet" | "slate";
}) {
  const colors = {
    cyan: "text-cyan-300",
    rose: "text-rose-300",
    emerald: "text-emerald-300",
    violet: "text-violet-300",
    slate: "text-slate-300",
  };
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={cn("truncate font-mono text-[10px]", colors[tone ?? "slate"])}>
        {value}
      </span>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-white/[0.06]", className)} />;
}
