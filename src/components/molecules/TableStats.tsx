"use client";
import type { ParsedSchema } from "@/types";

export function TableStats({ schema, zoom }: { schema: ParsedSchema | null; zoom: number }) {
  if (!schema) return null;
  return (
    <div className="flex gap-2">
      <span className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded px-2.5 py-1 text-[11px] text-zinc-500 font-mono">
        {schema.tables.length} tables
      </span>
      <span className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded px-2.5 py-1 text-[11px] text-zinc-500 font-mono">
        {schema.refs.length} refs
      </span>
      <span className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded px-2.5 py-1 text-[11px] text-zinc-500 font-mono">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
