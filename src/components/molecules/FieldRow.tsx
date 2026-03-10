"use client";
import { memo } from "react";
import { Key } from "lucide-react";
import { Badge } from "@/components/atoms";
import type { DBMLField } from "@/types";

interface FieldRowProps {
  field: DBMLField;
  isFK: boolean;
}

export const FieldRow = memo(function FieldRow({ field, isFK }: FieldRowProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30 transition-colors group">
      <span className="w-3 flex-shrink-0 text-amber-500">
        {field.isPk && <Key size={11} />}
      </span>
      <span className="font-mono text-zinc-300 flex-1 truncate">{field.name}</span>
      <div className="flex gap-1 items-center flex-shrink-0">
        <Badge variant="type">{field.type}</Badge>
        {field.isPk && <Badge variant="pk">PK</Badge>}
        {isFK && <Badge variant="fk">FK</Badge>}
        {field.isUnique && !field.isPk && <Badge variant="unique">U</Badge>}
      </div>
    </div>
  );
});
