"use client";
import { useCallback, useEffect } from "react";
import { Play, AlertTriangle, Download } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { Button, Tooltip } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { dbmlLanguage } from "@/lib/editors/dbmlLanguage";
import { dbmlExtensions } from "@/lib/editors/dbmlTheme";

export function DBMLEditor() {
  const { dbml, parsed, isParsingError, setDBML, parse } = useAppStore();

  // Auto-parse on mount
  useEffect(() => { parse(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedParse = useDebounce(parse, 600);

  const handleChange = useCallback((value: string) => {
    setDBML(value);
    debouncedParse();
  }, [setDBML, debouncedParse]);

  const handleExport = useCallback(() => {
    const blob = new Blob([dbml], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema-${Date.now()}.dbml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [dbml]);

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
        <div className="flex items-center gap-1.5">
          <Tooltip content="Export DBML">
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download size={11} />
            </Button>
          </Tooltip>
          <Button variant="primary" size="sm" onClick={parse}>
            <Play size={11} fill="currentColor" />
            Parse
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {isParsingError && parsed?.errors[0] && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border-b border-red-900/40 text-xs text-red-400 font-mono flex-shrink-0">
          <AlertTriangle size={12} />
          <span className="truncate">{parsed.errors[0]}</span>
        </div>
      )}

      {/* CodeMirror Editor */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={dbml}
          height="100%"
          extensions={[dbmlLanguage, ...dbmlExtensions]}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: false,
            dropCursor: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            rectangularSelection: true,
            crosshairCursor: false,
            highlightSelectionMatches: false,
            closeBracketsKeymap: true,
            searchKeymap: true,
            foldKeymap: false,
            completionKeymap: false,
            lintKeymap: false,
          }}
          className="dbml-editor-cm"
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800/60 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] text-zinc-700 font-mono">{dbml.split("\n").length} lines</span>
        <span className="text-[10px] text-zinc-700 font-mono">{dbml.length} chars</span>
      </div>
    </div>
  );
}
