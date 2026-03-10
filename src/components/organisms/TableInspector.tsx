"use client";
import { Link2 } from "lucide-react";
import { Badge } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";

export function TableInspector() {
  const { parsed, selectedTable } = useAppStore();
  const table = parsed?.tables.find(t => t.name === selectedTable);

  if (!table) {
    return (
      <div className="p-5 text-center">
        <div className="text-3xl mb-2 opacity-20">↖</div>
        <p className="text-xs text-zinc-600 font-mono">Select a table to inspect</p>
      </div>
    );
  }

  const tableRefs = parsed?.refs.filter(r => r.from.startsWith(table.name + ".") || r.to.startsWith(table.name + ".")) ?? [];

  return (
    <div className="p-4 space-y-5 fade-in">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-1.5">Table</p>
        <p className="font-mono font-bold text-amber-400 text-sm">{table.name}</p>
        {table.alias && <p className="text-xs text-zinc-500 mt-0.5">alias: {table.alias}</p>}
        {table.note && <p className="text-xs text-zinc-500 mt-1 italic">{table.note}</p>}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-2">{table.fields.length} Fields</p>
        <div className="space-y-1.5">
          {table.fields.map(f => (
            <div key={f.name} className="flex items-center justify-between gap-2">
              <span className={`font-mono text-xs truncate ${f.isPk ? "text-amber-400" : "text-zinc-300"}`}>{f.name}</span>
              <div className="flex gap-1 flex-shrink-0">
                {f.isPk && <Badge variant="pk">PK</Badge>}
                {f.isUnique && !f.isPk && <Badge variant="unique">U</Badge>}
                <Badge variant="type">{f.type.length > 12 ? f.type.slice(0, 12) + "…" : f.type}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tableRefs.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-2">Relations</p>
          <div className="space-y-2">
            {tableRefs.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs font-mono text-zinc-500">
                <Link2 size={11} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="text-zinc-400">{r.from}</span>
                  <span className="mx-1 text-amber-600">{r.type}</span>
                  <span className="text-zinc-400">{r.to}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
