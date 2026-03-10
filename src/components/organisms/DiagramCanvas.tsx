"use client";
import { useRef, useEffect, useMemo, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Download, LayoutGrid } from "lucide-react";
import { TableCard } from "./TableCard";
import { TableStats } from "@/components/molecules";
import { Button, Tooltip } from "@/components/atoms";
import { useAppStore } from "@/store/useAppStore";
import { useDiagramInteraction } from "@/lib/hooks/useDiagramInteraction";
import { useExportDiagram } from "@/lib/hooks/useExportDiagram";
import type { DBMLRef } from "@/types";

const TABLE_W = 260;
const HEADER_H = 40;
const FIELD_H = 32;

interface RefLine {
  key: string;
  fx: number; fy: number;
  tx: number; ty: number;
  cx1: number; cx2: number;
  type: string;
  fromTable: string;
  toTable: string;
}

function useRefLines(refs: DBMLRef[], tables: Array<{ name: string; x: number; y: number; fields: Array<{ name: string }> }>): RefLine[] {
  return useMemo(() => {
    const tableMap = new Map(tables.map(t => [t.name, t]));
    return refs.flatMap((ref, i) => {
      const [ft, ff] = ref.from.split(".");
      const [tt, tf] = ref.to.split(".");
      const fromTable = tableMap.get(ft);
      const toTable = tableMap.get(tt);
      if (!fromTable || !toTable) return [];

      const ffIdx = fromTable.fields.findIndex(f => f.name === ff);
      const tfIdx = toTable.fields.findIndex(f => f.name === tf);

      const fy = fromTable.y + HEADER_H + (ffIdx >= 0 ? ffIdx * FIELD_H + FIELD_H / 2 : 16);
      const ty = toTable.y + HEADER_H + (tfIdx >= 0 ? tfIdx * FIELD_H + FIELD_H / 2 : 16);

      // Pick which side of each table to connect based on relative positions
      const fromCenterX = fromTable.x + TABLE_W / 2;
      const toCenterX = toTable.x + TABLE_W / 2;
      let fx: number, tx: number, cx1: number, cx2: number;

      if (fromCenterX <= toCenterX) {
        // from is to the left → exit right side, enter left side
        fx = fromTable.x + TABLE_W;
        tx = toTable.x;
        const spread = Math.max(60, Math.abs(tx - fx) * 0.45);
        cx1 = fx + spread;
        cx2 = tx - spread;
      } else {
        // from is to the right → exit left side, enter right side
        fx = fromTable.x;
        tx = toTable.x + TABLE_W;
        const spread = Math.max(60, Math.abs(tx - fx) * 0.45);
        cx1 = fx - spread;
        cx2 = tx + spread;
      }

      return [{ key: `${i}-${ref.from}-${ref.to}`, fx, fy, tx, ty, cx1, cx2, type: ref.type, fromTable: ft, toTable: tt }];
    });
  }, [refs, tables]);
}

export function DiagramCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { parsed, offsetX, offsetY, zoom, selectedTable, hoveredRef, selectTable, setHoveredRef, setZoom, resetViewport, reLayout } = useAppStore();
  const { startCanvasDrag, startTableDrag, handleWheel } = useDiagramInteraction();
  const { exportPNG } = useExportDiagram(containerRef, parsed?.tables ?? []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const refLines = useRefLines(parsed?.refs ?? [], parsed?.tables ?? []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.currentTarget === e.target || (e.target as HTMLElement).classList.contains("canvas-bg")) {
      startCanvasDrag(e);
      selectTable(null);
    }
  }, [startCanvasDrag, selectTable]);

  if (!parsed || parsed.tables.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center fade-in">
          <div className="text-5xl mb-4 opacity-20 select-none">⊞</div>
          <p className="text-zinc-600 font-mono text-sm">Parse DBML to visualize the schema</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-zinc-950 select-none"
      onMouseDown={handleCanvasMouseDown}
      style={{ cursor: "default" }}
    >
      {/* Dot grid */}
      <svg data-export="svg-grid" className="canvas-bg absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.12 }}>
        <defs>
          <pattern
            id="dot-grid"
            x={(offsetX % (20 * zoom)).toFixed(1)}
            y={(offsetY % (20 * zoom)).toFixed(1)}
            width={20 * zoom}
            height={20 * zoom}
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#71717a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" className="canvas-bg" />
      </svg>

      {/* Table cards */}
      <div
        data-export="inner"
        style={{ transform: `translate(${offsetX}px,${offsetY}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}
      >
        {parsed.tables.map(table => {
          const isInHoveredRef = hoveredRef && (hoveredRef.from === table.name || hoveredRef.to === table.name);
          return (
            <TableCard
              key={table.name}
              table={table}
              refs={parsed.refs}
              isSelected={selectedTable === table.name}
              isHighlighted={!!isInHoveredRef}
              onSelect={selectTable}
              onDragStart={startTableDrag}
            />
          );
        })}
      </div>

      {/* Relationship lines — rendered AFTER table cards so they appear on top */}
      <svg data-export="svg-refs" className="absolute inset-0 w-full h-full" style={{ overflow: "visible", pointerEvents: "none" }}>
        <g transform={`translate(${offsetX},${offsetY}) scale(${zoom})`}>
          {refLines.map(line => {
            const isHovered = hoveredRef?.from === `${line.fromTable}.` || hoveredRef?.to === `${line.toTable}.` || 
                              (hoveredRef && line.key.includes(hoveredRef.from) && line.key.includes(hoveredRef.to));
            const pathD = `M ${line.fx} ${line.fy} C ${line.cx1} ${line.fy}, ${line.cx2} ${line.ty}, ${line.tx} ${line.ty}`;
            
            return (
              <g key={line.key} style={{ pointerEvents: "auto", cursor: "pointer" }}>
                {/* Invisible wider path for easier hover detection */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth={Math.max(10, 10 / zoom)}
                  fill="none"
                  onMouseEnter={() => setHoveredRef({ from: line.fromTable, to: line.toTable })}
                  onMouseLeave={() => setHoveredRef(null)}
                />
                {/* Visible path */}
                <path
                  d={pathD}
                  stroke={isHovered ? "#fbbf24" : "#f59e0b"}
                  strokeWidth={isHovered ? Math.max(2.5, 2.5 / zoom) : Math.max(1, 1.5 / zoom)}
                  strokeOpacity={isHovered ? "1" : "0.6"}
                  fill="none"
                  strokeDasharray={line.type === "-" ? `${4/zoom},${3/zoom}` : undefined}
                  style={{ pointerEvents: "none", transition: "all 0.2s ease" }}
                />
                <circle 
                  cx={line.fx} 
                  cy={line.fy} 
                  r={isHovered ? 5 / zoom : 3.5 / zoom} 
                  fill={isHovered ? "#fbbf24" : "#f59e0b"} 
                  fillOpacity={isHovered ? "1" : "0.9"}
                  style={{ pointerEvents: "none", transition: "all 0.2s ease" }}
                />
                <circle 
                  cx={line.tx} 
                  cy={line.ty} 
                  r={isHovered ? 5 / zoom : 3.5 / zoom} 
                  fill={isHovered ? "#fbbf24" : "#f59e0b"} 
                  fillOpacity={isHovered ? "1" : "0.9"}
                  style={{ pointerEvents: "none", transition: "all 0.2s ease" }}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* HUD - top left */}
      <div className="diagram-controls absolute top-3 left-3 z-20 flex gap-2">
        <TableStats schema={parsed} zoom={zoom} />
      </div>

      {/* HUD - top right */}
      <div className="diagram-controls absolute top-3 right-3 z-20">
        <Tooltip content="Export PNG">
          <Button variant="secondary" size="sm" onClick={exportPNG}>
            <Download size={13} />
          </Button>
        </Tooltip>
      </div>

      {/* HUD - bottom right */}
      <div className="diagram-controls absolute bottom-4 right-4 z-20 flex flex-col gap-1.5">
        <Tooltip content="Auto-arrange tables">
          <Button variant="secondary" size="sm" onClick={reLayout}>
            <LayoutGrid size={13} />
          </Button>
        </Tooltip>
        <Tooltip content="Zoom in">
          <Button variant="secondary" size="sm" onClick={() => setZoom(zoom + 0.15)}>
            <ZoomIn size={14} />
          </Button>
        </Tooltip>
        <Tooltip content="Zoom out">
          <Button variant="secondary" size="sm" onClick={() => setZoom(zoom - 0.15)}>
            <ZoomOut size={14} />
          </Button>
        </Tooltip>
        <Tooltip content="Reset view">
          <Button variant="secondary" size="sm" onClick={resetViewport}>
            <RotateCcw size={13} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
