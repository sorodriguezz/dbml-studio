"use client";
import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-sm",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700",
  ghost: "hover:bg-zinc-800/70 text-zinc-400 hover:text-zinc-200",
  danger: "bg-red-900/40 hover:bg-red-800/50 text-red-400 border border-red-800/50",
};

const SIZES: Record<Size, string> = {
  xs: "px-2 py-1 text-[11px] gap-1",
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center rounded-md font-medium transition-all duration-150 cursor-pointer",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANTS[variant], SIZES[size], className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
