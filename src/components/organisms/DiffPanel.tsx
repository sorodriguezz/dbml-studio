"use client";
import { useMemo, useState, useCallback } from "react";
import { ArrowLeftRight, ChevronDown, ChevronRight, Plus, Minus, Pencil, Equal } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { dbmlLanguage } from "@/lib/editors/dbmlLanguage";
import { dbmlExtensions } from "@/lib/editors/dbmlTheme";
import { parseDBML } from "@/lib/parser/dbmlParser";
import { diffSchemas } from "@/lib/utils/dbmlDiff";
import type { SchemaDiff, TableDiff, EnumDiff, DiffStatus } from "@/lib/utils/dbmlDiff";
import { cn } from "@/lib/utils/cn";

const STATUS_COLORS: Record<DiffStatus, string> = {
  added:     "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
  removed:   "text-red-400 bg-red-950/40 border-red-800/40",
  modified:  "text-amber-400 bg-amber-950/40 border-amber-800/40",
  unchanged: "text-zinc-500 bg-transparent border-transparent",
};

const STATUS_ICONS: Record<DiffStatus, React.ReactNode> = {
  added:     <Plus size={11} className="text-emerald-400 flex-shrink-0" />,
  removed:   <Minus size={11} className="text-red-400 flex-shrink-0" />,
  modified:  <Pencil size={10} className="text-amber-400 flex-shrink-0" />,
  unchanged: <Equal size={10} className="text-zinc-600 flex-shrink-0" />,
};

const STATUS_BADGE: Record<DiffStatus, string> = {
  added:     "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
  removed:   "bg-red-900/60 text-red-300 border-red-700/50",
  modified:  "bg-amber-900/60 text-amber-300 border-amber-700/50",
  unchanged: "bg-zinc-800/60 text-zinc-500 border-zinc-700/30",
};

function StatusBadge({ status }: { status: DiffStatus }) {
  return (
    <span className={cn("text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border", STATUS_BADGE[status])}>
      {status}
    </span>
  );
}

function TableDiffBlock({ td }: { td: TableDiff }) {
  const [open, setOpen] = useState(td.status !== "unchanged");
  const visibleFields = td.status === "unchanged"
    ? td.fields.filter(f => f.status !== "unchanged")
    : td.fields;

  return (
    <div className={cn("rounded-lg border mb-2 overflow-hidden", STATUS_COLORS[td.status])}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {STATUS_ICONS[td.status]}
        <span className="font-mono font-bold text-xs flex-1">{td.name}</span>
        <StatusBadge status={td.status} />
        <span className="text-zinc-600 text-[10px] font-mono">{td.fields.length} fields</span>
        {open ? <ChevronDown size={12} className="text-zinc-600" /> : <ChevronRight size={12} className="text-zinc-600" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800/50">
          {visibleFields.length === 0 ? (
            <p className="px-4 py-2 text-[11px] text-zinc-600 font-mono italic">No field changes</p>
          ) : (
            visibleFields.map(f => (
              <div
                key={f.name}
                className={cn(
                  "px-4 py-1.5 flex items-start gap-2 border-b border-zinc-800/30 last:border-0",
                  f.status === "added"    && "bg-emerald-950/30",
                  f.status === "removed"  && "bg-red-950/30",
                  f.status === "modified" && "bg-amber-950/20",
                )}
              >
                {STATUS_ICONS[f.status]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-mono text-xs", f.status === "added" ? "text-emerald-300" : f.status === "removed" ? "text-red-300" : "text-zinc-300")}>
                      {f.name}
                    </span>
                    {f.newField && (
                      <span className="text-[10px] font-mono text-zinc-600">{f.newField.type}</span>
                    )}
                    {f.oldField && !f.newField && (
                      <span className="text-[10px] font-mono text-zinc-600 line-through">{f.oldField.type}</span>
                    )}
                  </div>
                  {f.changes.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {f.changes.map((c, i) => (
                        <li key={i} className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                          <span className="text-amber-600">~</span> {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EnumDiffBlock({ ed }: { ed: EnumDiff }) {
  return (
    <div className={cn("rounded-lg border mb-2 px-3 py-2", STATUS_COLORS[ed.status])}>
      <div className="flex items-center gap-2 mb-1">
        {STATUS_ICONS[ed.status]}
        <span className="font-mono text-xs font-bold text-violet-300">{ed.name}</span>
        <span className="text-[9px] font-mono text-violet-600 uppercase">enum</span>
        <StatusBadge status={ed.status} />
      </div>
      {ed.addedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {ed.addedValues.map(v => (
            <span key={v} className="text-[10px] font-mono bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/40">
              + {v}
            </span>
          ))}
        </div>
      )}
      {ed.removedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {ed.removedValues.map(v => (
            <span key={v} className="text-[10px] font-mono bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded border border-red-800/40 line-through">
              - {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const PLACEHOLDER = `Table users {
  id integer [pk, increment]
  name varchar(100) [not null]
  email varchar(100) [not null, unique]
  created_at timestamp
}`;

export function DiffPanel() {
  const [leftDBML, setLeftDBML]   = useState("");
  const [rightDBML, setRightDBML] = useState("");
  const [showOnly, setShowOnly]   = useState<"all" | "changed">("changed");

  const parsedLeft  = useMemo(() => leftDBML.trim()  ? parseDBML(leftDBML)  : null, [leftDBML]);
  const parsedRight = useMemo(() => rightDBML.trim() ? parseDBML(rightDBML) : null, [rightDBML]);
  const diff: SchemaDiff = useMemo(() => diffSchemas(parsedLeft, parsedRight), [parsedLeft, parsedRight]);

  const visibleTables = showOnly === "changed"
    ? diff.tables.filter(t => t.status !== "unchanged")
    : diff.tables;
  const visibleEnums  = showOnly === "changed"
    ? diff.enums.filter(e => e.status !== "unchanged")
    : diff.enums;

  const handleSwap = useCallback(() => {
    setLeftDBML(rightDBML);
    setRightDBML(leftDBML);
  }, [leftDBML, rightDBML]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 flex-shrink-0">
        <ArrowLeftRight size={14} className="text-amber-400" />
        <span className="text-xs font-semibold text-zinc-300">Schema Diff</span>
        <div className="flex-1" />
        {/* Stats */}
        {(parsedLeft || parsedRight) && (
          <div className="flex items-center gap-2 text-[11px] font-mono">
            {diff.stats.added   > 0 && <span className="text-emerald-400">+{diff.stats.added}</span>}
            {diff.stats.removed > 0 && <span className="text-red-400">-{diff.stats.removed}</span>}
            {diff.stats.modified> 0 && <span className="text-amber-400">~{diff.stats.modified}</span>}
            {!diff.hasChanges && parsedLeft && parsedRight && <span className="text-zinc-500">No changes</span>}
          </div>
        )}
        {/* Filter toggle */}
        <div className="flex bg-zinc-800 rounded p-0.5 gap-0.5">
          {(["changed", "all"] as const).map(v => (
            <button
              key={v}
              onClick={() => setShowOnly(v)}
              className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded transition-colors",
                showOnly === v ? "bg-zinc-600 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {v === "changed" ? "Changes only" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Two editors + diff pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left */}
        <div className="flex-1 flex flex-col border-r border-zinc-800/80 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">From (versión A)</span>
            {parsedLeft && <span className="text-[10px] font-mono text-zinc-600">{parsedLeft.tables.length} tables</span>}
          </div>
          <div className="flex-1 overflow-auto">
            <CodeMirror
              value={leftDBML}
              height="100%"
              extensions={[dbmlLanguage, ...dbmlExtensions]}
              onChange={setLeftDBML}
              placeholder={PLACEHOLDER}
              basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: false }}
              className="dbml-editor-cm"
            />
          </div>
        </div>

        {/* Swap button */}
        <div className="flex items-center justify-center w-8 bg-zinc-900/40 border-r border-zinc-800/80 flex-shrink-0">
          <button
            onClick={handleSwap}
            title="Swap A ↔ B"
            className="w-6 h-10 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-amber-400 transition-colors"
          >
            <ArrowLeftRight size={11} />
          </button>
        </div>

        {/* Right */}
        <div className="flex-1 flex flex-col border-r border-zinc-800/80 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">To (versión B)</span>
            {parsedRight && <span className="text-[10px] font-mono text-zinc-600">{parsedRight.tables.length} tables</span>}
          </div>
          <div className="flex-1 overflow-auto">
            <CodeMirror
              value={rightDBML}
              height="100%"
              extensions={[dbmlLanguage, ...dbmlExtensions]}
              onChange={setRightDBML}
              placeholder={PLACEHOLDER}
              basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: false }}
              className="dbml-editor-cm"
            />
          </div>
        </div>

        {/* Diff result */}
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-zinc-950">
          <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/40 flex-shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Diferencias</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {!parsedLeft && !parsedRight ? (
              <div className="text-center py-8">
                <ArrowLeftRight size={28} className="mx-auto mb-3 text-zinc-700" />
                <p className="text-xs text-zinc-600 font-mono">Pega dos versiones de tu esquema en los editores de la izquierda</p>
              </div>
            ) : !diff.hasChanges ? (
              <div className="text-center py-8">
                <Equal size={28} className="mx-auto mb-3 text-zinc-600" />
                <p className="text-xs text-zinc-500 font-mono">Los esquemas son idénticos</p>
              </div>
            ) : (
              <>
                {/* Refs diff */}
                {diff.refs.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Relations</p>
                    {diff.refs.map(r => (
                      <div key={r.key} className={cn(
                        "flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded mb-1",
                        r.status === "added" ? "bg-emerald-950/40 text-emerald-400" : "bg-red-950/40 text-red-400"
                      )}>
                        {r.status === "added" ? <Plus size={10} /> : <Minus size={10} />}
                        <span className="truncate">{r.key}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Tables diff */}
                {visibleTables.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Tables</p>
                    {visibleTables.map(td => <TableDiffBlock key={td.name} td={td} />)}
                  </div>
                )}
                {/* Enums diff */}
                {visibleEnums.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Enums</p>
                    {visibleEnums.map(ed => <EnumDiffBlock key={ed.name} ed={ed} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
