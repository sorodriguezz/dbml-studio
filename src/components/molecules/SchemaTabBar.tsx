"use client";
import { useState, useRef, useCallback } from "react";
import { Plus, X, Copy, ChevronDown } from "lucide-react";
import { useTabsStore } from "@/store/useTabsStore";
import { cn } from "@/lib/utils/cn";

export function SchemaTabBar() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTabId, renameTab, duplicateTab } = useTabsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
    setTimeout(() => inputRef.current?.select(), 30);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId) renameTab(editingId, editingName);
    setEditingId(null);
  }, [editingId, editingName, renameTab]);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center bg-zinc-900/80 border-b border-zinc-800 overflow-x-auto flex-shrink-0 z-20"
        style={{ minHeight: 36 }}
        onClick={() => contextMenu && closeMenu()}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                "group relative flex items-center gap-1.5 px-3 h-9 border-r border-zinc-800/70 cursor-pointer select-none flex-shrink-0 transition-colors",
                isActive
                  ? "bg-zinc-800 text-zinc-100 after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-amber-500"
                  : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
              )}
              onClick={() => setActiveTabId(tab.id)}
              onDoubleClick={() => startEdit(tab.id, tab.name)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
            >
              {/* Status dot */}
              <span className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                tab.isError ? "bg-red-500" : "bg-emerald-500/70"
              )} />

              {/* Name / editable */}
              {editingId === tab.id ? (
                <input
                  ref={inputRef}
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                  className="bg-zinc-700 text-zinc-100 text-xs font-mono rounded px-1 py-0 outline-none w-28"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="text-xs font-mono truncate max-w-[120px]">{tab.name}</span>
              )}

              {/* Close button */}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
                  className={cn(
                    "w-4 h-4 rounded flex items-center justify-center transition-colors flex-shrink-0",
                    isActive
                      ? "text-zinc-400 hover:text-white hover:bg-zinc-600"
                      : "opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}

        {/* Add tab */}
        {tabs.length < 8 && (
          <button
            onClick={addTab}
            className="flex items-center justify-center w-8 h-9 text-zinc-600 hover:text-amber-400 hover:bg-zinc-800/50 transition-colors flex-shrink-0"
            title="New schema tab"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-44 text-xs font-mono"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 transition-colors"
              onClick={() => {
                const tab = tabs.find(t => t.id === contextMenu.id);
                if (tab) startEdit(tab.id, tab.name);
                closeMenu();
              }}
            >
              <ChevronDown size={11} className="text-zinc-500" />
              Renombrar
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 transition-colors"
              onClick={() => { duplicateTab(contextMenu.id); closeMenu(); }}
            >
              <Copy size={11} className="text-zinc-500" />
              Duplicar
            </button>
            {tabs.length > 1 && (
              <>
                <div className="border-t border-zinc-700 my-1" />
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-950/40 transition-colors"
                  onClick={() => { removeTab(contextMenu.id); closeMenu(); }}
                >
                  <X size={11} />
                  Cerrar tab
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
