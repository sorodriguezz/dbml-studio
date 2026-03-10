"use client";
import { useCallback, useEffect } from "react";
import { Play, AlertTriangle } from "lucide-react";
import { Button } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { useDebounce } from "@/lib/hooks/useDebounce";

export function DBMLEditor() {
  const { dbml, parsed, isParsingError, setDBML, parse } = useAppStore();

  // Auto-parse on mount
  useEffect(() => { parse(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedParse = useDebounce(parse, 600);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDBML(e.target.value);
    debouncedParse();
  }, [setDBML, debouncedParse]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">DBML</span>
          {parsed && (
            <span className={`flex items-center gap-1 text-[10px] font-mono ${isParsingError ? "text-red-400" : "text-emerald-500"}`}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
              {isParsingError ? "Error" : `${parsed.tables.length} tables`}
            </span>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={parse}>
          <Play size={11} fill="currentColor" />
          Parse
        </Button>
      </div>

      {/* Error banner */}
      {isParsingError && parsed?.errors[0] && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border-b border-red-900/40 text-xs text-red-400 font-mono flex-shrink-0">
          <AlertTriangle size={12} />
          <span className="truncate">{parsed.errors[0]}</span>
        </div>
      )}

      {/* Textarea */}
      <textarea
        className="flex-1 p-4 font-mono text-xs text-zinc-300 bg-transparent resize-none outline-none leading-relaxed dbml-editor"
        value={dbml}
        onChange={handleChange}
        placeholder="Paste your DBML here..."
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800/60 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] text-zinc-700 font-mono">{dbml.split("\n").length} lines</span>
        <span className="text-[10px] text-zinc-700 font-mono">{dbml.length} chars</span>
      </div>
    </div>
  );
}
