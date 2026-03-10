"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, AlertTriangle, Download, Upload } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { Button, Tooltip } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { dbmlLanguage } from "@/lib/editors/dbmlLanguage";
import { dbmlExtensions } from "@/lib/editors/dbmlTheme";

export function DBMLEditor() {
  const { dbml, parsed, isParsingError, setDBML, parse } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

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

  const loadFile = useCallback((file: File) => {
    setFileError(null);

    // Validate extension
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

      // Basic DBML content validation: must contain at least a Table, Enum, or Ref keyword
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
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setFileError(null);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    // Reset input so the same file can be re-selected
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".dbml"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* File validation error */}
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
