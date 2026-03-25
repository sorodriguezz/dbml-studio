"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, AlertTriangle, Download, Upload, Wand2, Clock, Lightbulb, ChevronDown } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { Button, Tooltip } from "@/components/atoms";
import { useTabsStore } from "@/store/useTabsStore";
import { SchemaTabBar } from "@/components/molecules/SchemaTabBar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { dbmlLanguage } from "@/lib/editors/dbmlLanguage";
import { dbmlExtensions } from "@/lib/editors/dbmlTheme";
import { formatDBML } from "@/lib/utils/formatDBML";
import { getSuggestions } from "@/lib/utils/errorSuggestions";
import { useAppStore } from "@/store/useAppStore";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export function MultiSchemaEditor() {
  const { tabs, activeTabId, updateTabDBML, parseTab } = useTabsStore();
  const { setDBML, parse: parseGlobal, formatDBML: formatGlobal, history, restoreFromHistory } = useAppStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mounted, setMounted] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // Track client mount to avoid localStorage-derived state causing SSR/CSR mismatch
  useEffect(() => { setMounted(true); }, []);

  const dbml = activeTab?.dbml ?? "";
  const errors = activeTab?.parsed?.errors ?? [];
  const suggestions = getSuggestions(errors);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistory) return;
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  const syncGlobal = useCallback((id: string) => {
    const tab = useTabsStore.getState().tabs.find(t => t.id === id);
    if (tab) setDBML(tab.dbml);
    parseGlobal();
  }, [setDBML, parseGlobal]);

  const doParse = useCallback((id: string) => {
    parseTab(id);
    syncGlobal(id);
  }, [parseTab, syncGlobal]);

  // Parse on initial mount (runs only on client — avoids SSR hydration mismatch)
  useEffect(() => {
    doParse(activeTabId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When switching tabs, sync the new tab's DBML to global store and re-parse
  useEffect(() => {
    if (activeTab) {
      setDBML(activeTab.dbml);
      parseGlobal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const debouncedParse = useDebounce(() => doParse(activeTabId), 600);

  const handleChange = useCallback((value: string) => {
    updateTabDBML(activeTabId, value);
    debouncedParse();
  }, [activeTabId, updateTabDBML, debouncedParse]);

  const handleFormat = useCallback(() => {
    if (!activeTab) return;
    const formatted = formatDBML(activeTab.dbml);
    updateTabDBML(activeTabId, formatted);
    formatGlobal();
    setTimeout(() => doParse(activeTabId), 50);
  }, [activeTab, activeTabId, updateTabDBML, formatGlobal, doParse]);

  const handleRestoreFromHistory = useCallback((index: number) => {
    const item = history[index];
    if (!item) return;
    // Sync restored DBML back to the active tab as well
    updateTabDBML(activeTabId, item.dbml);
    restoreFromHistory(index);
    setTimeout(() => parseTab(activeTabId), 50);
    setShowHistory(false);
  }, [history, activeTabId, updateTabDBML, restoreFromHistory, parseTab]);

  const handleExport = useCallback(() => {
    if (!activeTab) return;
    const blob = new Blob([activeTab.dbml], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab.name.replace(/\s+/g, "-")}.dbml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeTab]);

  const loadFile = useCallback((file: File) => {
    setFileError(null);
    if (!file.name.toLowerCase().endsWith(".dbml")) {
      setFileError(`Solo se aceptan archivos .dbml`);
      setTimeout(() => setFileError(null), 4000);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content !== "string" || !content.trim()) {
        setFileError("El archivo está vacío");
        setTimeout(() => setFileError(null), 4000);
        return;
      }
      updateTabDBML(activeTabId, content);
      setTimeout(() => doParse(activeTabId), 100);
    };
    reader.onerror = () => { setFileError("Error al leer el archivo"); setTimeout(() => setFileError(null), 4000); };
    reader.readAsText(file);
  }, [activeTabId, updateTabDBML, doParse]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 border-2 border-dashed border-amber-500 rounded-lg">
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-2 text-amber-400" />
            <p className="text-sm text-amber-400 font-mono">Soltar archivo .dbml</p>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".dbml" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="hidden" />

      {/* Tab bar */}
      <SchemaTabBar />

      {fileError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border-b border-red-900/40 text-xs text-red-400 font-mono flex-shrink-0">
          <AlertTriangle size={12} />
          <span className="truncate">{fileError}</span>
          <button onClick={() => setFileError(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">DBML</span>
          {activeTab && mounted && (
            <span className={`flex items-center gap-1 text-[10px] font-mono ${activeTab.isError ? "text-red-400" : "text-emerald-500"}`}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
              {activeTab.isError ? "Error" : `${activeTab.parsed?.tables.length ?? 0} tables`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip content="Formatear DBML">
            <Button variant="secondary" size="sm" onClick={handleFormat}>
              <Wand2 size={11} />
            </Button>
          </Tooltip>

          {/* History dropdown */}
          <div className="relative" ref={historyRef}>
            <Tooltip content="Historial">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowHistory(v => !v)}
                disabled={mounted && history.length === 0}
              >
                <Clock size={11} />
              </Button>
            </Tooltip>
            {showHistory && history.length > 0 && (
              <div className="absolute right-0 top-full mt-1 w-64 z-50 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Historial local</span>
                  <span className="text-[10px] text-zinc-600 font-mono">{history.length} entradas</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {history.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleRestoreFromHistory(i)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors group border-b border-zinc-800/50 last:border-0"
                    >
                      <Clock size={10} className="text-zinc-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-zinc-300 font-mono truncate">
                          {item.dbml.split("\n")[0].slice(0, 40)}…
                        </p>
                        <p className="text-[9px] text-zinc-600 font-mono">{relativeTime(item.ts)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Tooltip content="Cargar .dbml">
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={11} />
            </Button>
          </Tooltip>
          <Tooltip content="Exportar DBML">
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download size={11} />
            </Button>
          </Tooltip>
          <Button variant="primary" size="sm" onClick={() => doParse(activeTabId)}>
            <Play size={11} fill="currentColor" />
            Parse
          </Button>
        </div>
      </div>

      {/* Error + suggestions banner */}
      {activeTab?.isError && errors.length > 0 && (
        <div className="border-b border-red-900/40 bg-red-950/30 flex-shrink-0">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left"
            onClick={() => setShowSuggestions(v => !v)}
          >
            <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400 font-mono flex-1 truncate">{errors[0]}</span>
            <Lightbulb size={11} className="text-amber-500 flex-shrink-0" />
            <span className="text-[10px] text-amber-500 font-mono">{suggestions.length} sugerencia{suggestions.length !== 1 ? "s" : ""}</span>
            <ChevronDown size={11} className={`text-zinc-500 transition-transform ${showSuggestions ? "rotate-180" : ""}`} />
          </button>
          {showSuggestions && (
            <div className="px-3 pb-3 space-y-3">
              {suggestions.map((s, i) => (
                <div key={i} className="rounded-lg bg-zinc-900/60 border border-zinc-800/60 p-3">
                  <div className="flex items-start gap-1.5 mb-2">
                    <Lightbulb size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-400 font-mono">
                      {i > 0 && errors[i] ? <span className="text-red-400 block mb-1 truncate">{errors[i]}</span> : null}
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {s.suggestions.map((tip, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-[11px] font-mono text-zinc-400">
                        <span className="text-amber-600 flex-shrink-0 mt-0.5">→</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                  {s.example && (
                    <pre className="mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 rounded p-2 overflow-x-auto">
                      {s.example}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CodeMirror */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          key={activeTabId}
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

      <div className="px-3 py-1.5 border-t border-zinc-800/60 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] text-zinc-700 font-mono">{mounted ? dbml.split("\n").length : 0} lines</span>
        <span className="text-[10px] text-zinc-700 font-mono">{mounted ? dbml.length : 0} chars</span>
      </div>
    </div>
  );
}
