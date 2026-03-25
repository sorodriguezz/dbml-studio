"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, AlertTriangle, Download, Upload, Wand2, Clock } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { Button, Tooltip } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { dbmlLanguage } from "@/lib/editors/dbmlLanguage";
import { dbmlExtensions } from "@/lib/editors/dbmlTheme";

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

export function DBMLEditor() {
  const { dbml, parsed, isParsingError, history, setDBML, parse, formatDBML, restoreFromHistory } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // Auto-parse on mount
  useEffect(() => { parse(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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

  const debouncedParse = useDebounce(parse, 600);

  const handleChange = useCallback((value: string) => {
    setDBML(value);
    debouncedParse();
  }, [setDBML, debouncedParse]);

  const handleFormat = useCallback(() => {
    formatDBML();
    setTimeout(() => parse(), 50);
  }, [formatDBML, parse]);

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

  const loadFile = useCallback((file: File) => {
    setFileError(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith(".dbml")) {
      setFileError(`Archivo no válido: "${file.name}". Solo se aceptan archivos .dbml`);
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
      const hasDBMLContent = /\b(Table|Enum|Ref)\b/i.test(content);
      if (!hasDBMLContent) {
        setFileError("El archivo no contiene sintaxis DBML válida (Table, Enum o Ref)");
        setTimeout(() => setFileError(null), 4000);
        return;
      }
      setDBML(content);
      setTimeout(() => parse(), 100);
    };
    reader.onerror = () => {
      setFileError("Error al leer el archivo");
      setTimeout(() => setFileError(null), 4000);
    };
    reader.readAsText(file);
  }, [setDBML, parse]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false); setFileError(null);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [loadFile]);

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 border-2 border-dashed border-amber-500 rounded-lg">
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-2 text-amber-400" />
            <p className="text-sm text-amber-400 font-mono">Soltar archivo .dbml</p>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".dbml" onChange={handleFileInput} className="hidden" />

      {fileError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border-b border-red-900/40 text-xs text-red-400 font-mono flex-shrink-0 fade-in">
          <AlertTriangle size={12} />
          <span className="truncate">{fileError}</span>
          <button onClick={() => setFileError(null)} className="ml-auto text-red-500 hover:text-red-300 transition-colors">✕</button>
        </div>
      )}

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
          {/* History dropdown */}
          <div className="relative" ref={historyRef}>
            <Tooltip content="Historial de esquemas">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowHistory(v => !v)}
                title="History"
              >
                <Clock size={11} />
              </Button>
            </Tooltip>
            {showHistory && history.length > 0 && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-1.5 border-b border-zinc-800">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Historial reciente</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {history.map((item, i) => (
                    <button
                      key={item.ts}
                      onClick={() => { restoreFromHistory(i); setShowHistory(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-zinc-500 font-mono">{relativeTime(item.ts)}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{item.dbml.split("\n").length} lines</span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate font-mono">{item.dbml.split("\n").find(l => l.trim()) ?? "—"}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showHistory && history.length === 0 && (
              <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl px-3 py-3">
                <p className="text-xs text-zinc-500 font-mono">Sin historial aún. Parsea un esquema para guardar.</p>
              </div>
            )}
          </div>

          <Tooltip content="Formatear DBML">
            <Button variant="secondary" size="sm" onClick={handleFormat}>
              <Wand2 size={11} />
            </Button>
          </Tooltip>
          <Tooltip content="Cargar archivo .dbml">
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={11} />
            </Button>
          </Tooltip>
          <Tooltip content="Exportar DBML">
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

      <div className="px-3 py-1.5 border-t border-zinc-800/60 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] text-zinc-700 font-mono">{dbml.split("\n").length} lines</span>
        <span className="text-[10px] text-zinc-700 font-mono">{dbml.length} chars</span>
      </div>
    </div>
  );
}
