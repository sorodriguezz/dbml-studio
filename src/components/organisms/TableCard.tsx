"use client";
import { memo, useMemo } from "react";
import { FieldRow } from "@/components/molecules";
import { cn } from "@/lib/utils/cn";
import type { DBMLTable, DBMLRef } from "@/types";

interface TableCardProps {
  table: DBMLTable;
  refs: DBMLRef[];
  isSelected: boolean;
  onSelect: (name: string) => void;
  onDragStart: (e: React.MouseEvent, table: DBMLTable) => void;
}

export const TableCard = memo(function TableCard({ table, refs, isSelected, onSelect, onDragStart }: TableCardProps) {
  const fkFields = useMemo(() => {
    return new Set(
      refs.filter(r => r.from.startsWith(table.name + ".")).map(r => r.from.split(".")[1])
    );
  }, [refs, table.name]);

  return (
    <div
      style={{ position: "absolute", left: table.x, top: table.y, width: 260 }}
      onMouseDown={(e) => { onDragStart(e, table); onSelect(table.name); }}
      className={cn(
        "rounded-lg border select-none transition-all duration-150 table-card bg-zinc-900 shadow-xl",
        isSelected
          ? "border-amber-500/70 shadow-amber-900/30 ring-1 ring-amber-500/20"
          : "border-zinc-700/60 hover:border-zinc-600"
      )}
    >
      {/* Header */}
      <div className={cn(
        "px-3 py-2 rounded-t-lg font-mono font-bold text-sm border-b flex items-center gap-2",
        isSelected
          ? "border-amber-700/40 bg-amber-900/20 text-amber-300"
          : "border-zinc-700/60 bg-zinc-800/60 text-zinc-200"
      )}>
        <span className={cn("text-[10px] opacity-60", isSelected ? "text-amber-400" : "text-zinc-500")}>⊞</span>
        <span className="truncate">{table.name}</span>
        {table.alias && <span className="ml-auto text-[10px] font-normal text-zinc-500">({table.alias})</span>}
        <span className="ml-auto text-[10px] font-normal text-zinc-600">{table.fields.length}</span>
      </div>
      {/* Fields — show all, no scroll cap so ref lines align accurately */}
      <div className="overflow-visible">
        {table.fields.map(f => (
          <FieldRow key={f.name} field={f} isFK={fkFields.has(f.name)} />
        ))}
      </div>
    </div>
  );
});
