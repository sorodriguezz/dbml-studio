"use client";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "pk" | "fk" | "unique" | "type" | "success" | "error";

const VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-zinc-800 text-zinc-400 border-zinc-700",
  pk: "bg-amber-900/40 text-amber-400 border-amber-700/50",
  fk: "bg-sky-900/40 text-sky-400 border-sky-700/50",
  unique: "bg-violet-900/30 text-violet-400 border-violet-700/40",
  type: "bg-zinc-900 text-zinc-500 border-zinc-800",
  success: "bg-emerald-900/30 text-emerald-400 border-emerald-700/40",
  error: "bg-red-900/30 text-red-400 border-red-700/40",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold", VARIANTS[variant], className)}>
      {children}
    </span>
  );
}
