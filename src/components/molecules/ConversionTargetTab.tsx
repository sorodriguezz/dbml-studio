"use client";
import { cn } from "@/lib/utils/cn";
import type { ConversionTarget } from "@/types";

const TARGETS: { id: ConversionTarget; label: string; color: string }[] = [
  { id: "typeorm",    label: "TypeORM",    color: "text-sky-400" },
  { id: "prisma",     label: "Prisma",     color: "text-violet-400" },
  { id: "drizzle",    label: "Drizzle",    color: "text-lime-400" },
  { id: "sequelize",  label: "Sequelize",  color: "text-cyan-400" },
  { id: "postgresql", label: "PostgreSQL", color: "text-blue-400" },
  { id: "sqlserver",  label: "SQL Server", color: "text-orange-400" },
  { id: "mongodb",    label: "MongoDB",    color: "text-emerald-400" },
  { id: "gorm",       label: "GORM",       color: "text-teal-400" },
  { id: "laravel",    label: "Laravel",    color: "text-red-400" },
  { id: "jpa",        label: "Java JPA",   color: "text-amber-500" },
];

interface Props {
  active: ConversionTarget;
  onChange: (t: ConversionTarget) => void;
}

export function ConversionTargetTab({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 p-2.5 border-b border-zinc-800 overflow-x-auto flex-shrink-0 bg-zinc-900/50">
      {TARGETS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "px-3 py-1.5 rounded text-xs font-mono font-semibold whitespace-nowrap transition-all",
            active === t.id
              ? `bg-zinc-700 ${t.color} border border-zinc-600`
              : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
