"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DiagramCanvas, DBMLEditor, ConversionPanel, TableInspector, SQLImportPanel } from "@/components/organisms";
import { useAppStore } from "@/store/useAppStore";
import type { ActiveTab } from "@/types";

const TABS: { id: ActiveTab; label: string }[] = [
  { id: "diagram", label: "Diagram" },
  { id: "convert", label: "Convert" },
  { id: "import", label: "SQL → DBML" },
];

const MIN_W          = 180;
const MAX_EDITOR_W   = 600;
const DEFAULT_EDITOR_W = 288;
const MAX_INSPECTOR_W  = 520;
const DEFAULT_INSPECTOR_W = 224;

export function AppTemplate() {
  const { activeTab, setActiveTab, parsed } = useAppStore();

  // ── Editor panel state ─────────────────────────────────────────────
  const [editorW, setEditorW]               = useState(DEFAULT_EDITOR_W);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const editorDrag = useRef({ active: false, startX: 0, startW: DEFAULT_EDITOR_W });

  // ── Inspector panel state ──────────────────────────────────────────
  const [inspectorW, setInspectorW]                   = useState(DEFAULT_INSPECTOR_W);
  const [inspectorCollapsed, setInspectorCollapsed]   = useState(false);
  const inspectorDrag = useRef({ active: false, startX: 0, startW: DEFAULT_INSPECTOR_W });

  const onEditorDragDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    editorDrag.current = { active: true, startX: e.clientX, startW: editorW };
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }, [editorW]);

  const onInspectorDragDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    inspectorDrag.current = { active: true, startX: e.clientX, startW: inspectorW };
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }, [inspectorW]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (editorDrag.current.active) {
        const next = Math.min(MAX_EDITOR_W, Math.max(MIN_W,
          editorDrag.current.startW + (e.clientX - editorDrag.current.startX)));
        setEditorW(next);
      }
      if (inspectorDrag.current.active) {
        // Inspector is on the right: moving mouse LEFT increases its width
        const next = Math.min(MAX_INSPECTOR_W, Math.max(MIN_W,
          inspectorDrag.current.startW - (e.clientX - inspectorDrag.current.startX)));
        setInspectorW(next);
      }
    };
    const onUp = () => {
      editorDrag.current.active    = false;
      inspectorDrag.current.active = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-5 h-12 border-b border-zinc-800/80 bg-zinc-900/60 flex-shrink-0 z-30 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-amber-900/50">
            <span className="text-zinc-950 font-black text-xs select-none">DB</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold text-sm text-zinc-100 tracking-tight">DBML Studio</span>
            <span className="hidden sm:inline ml-2 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
              Visualizer & Converter
            </span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Tab navigation */}
        <nav className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-3 py-1 rounded-md text-xs font-semibold transition-all",
                activeTab === tab.id
                  ? "bg-zinc-700 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-zinc-600">
          {parsed?.tables.length ? (
            <><span className="text-emerald-500">●</span> {parsed.tables.length} tables parsed</>
          ) : (
            <><span className="text-zinc-700">○</span> Awaiting input</>
          )}
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: DBML Editor */}
        <aside
          className="relative flex-shrink-0 border-r border-zinc-800/80 flex flex-col bg-zinc-900/20 overflow-hidden transition-all duration-200"
          style={{ width: editorCollapsed ? 0 : editorW, minWidth: editorCollapsed ? 0 : MIN_W }}
        >
          <DBMLEditor />
        </aside>

        {/* Editor resize / collapse handle */}
        <div className="relative flex-shrink-0 flex items-center z-20">
          {!editorCollapsed && (
            <div
              onMouseDown={onEditorDragDown}
              className="absolute inset-y-0 left-0 w-1 cursor-col-resize hover:bg-amber-500/40 transition-colors"
            />
          )}
          <button
            onClick={() => setEditorCollapsed(c => !c)}
            title={editorCollapsed ? "Expand editor" : "Collapse editor"}
            className="w-4 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-r text-zinc-500 hover:text-amber-400 transition-all shadow-sm"
          >
            {editorCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Center: Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === "diagram" && <DiagramCanvas />}
          {activeTab === "convert" && <ConversionPanel />}
          {activeTab === "import" && <SQLImportPanel />}
        </main>

        {/* Inspector resize / collapse handle (diagram only) */}
        {activeTab === "diagram" && (
          <div className="relative flex-shrink-0 flex items-center z-20">
            <button
              onClick={() => setInspectorCollapsed(c => !c)}
              title={inspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
              className="w-4 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-l text-zinc-500 hover:text-amber-400 transition-all shadow-sm"
            >
              {inspectorCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
            {!inspectorCollapsed && (
              <div
                onMouseDown={onInspectorDragDown}
                className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-amber-500/40 transition-colors"
              />
            )}
          </div>
        )}

        {/* Right: Inspector */}
        {activeTab === "diagram" && (
          <aside
            className="flex-shrink-0 border-l border-zinc-800/80 bg-zinc-900/20 overflow-y-auto transition-all duration-200"
            style={{ width: inspectorCollapsed ? 0 : inspectorW, minWidth: inspectorCollapsed ? 0 : MIN_W }}
          >
            <div className="sticky top-0 px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur z-10">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">Inspector</span>
            </div>
            <TableInspector />
          </aside>
        )}
      </div>
    </div>
  );
}