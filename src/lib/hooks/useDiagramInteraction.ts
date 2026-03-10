"use client";
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { DBMLTable } from "@/types";

interface DragState {
  type: "canvas" | "table" | null;
  startMouseX: number;
  startMouseY: number;
  startValueX: number;
  startValueY: number;
  tableName?: string;
}

export function useDiagramInteraction() {
  const { offsetX, offsetY, zoom, setViewport, setZoom, moveTable, selectTable } = useAppStore();
  const dragRef = useRef<DragState>({ type: null, startMouseX: 0, startMouseY: 0, startValueX: 0, startValueY: 0 });

  const startCanvasDrag = useCallback((e: React.MouseEvent) => {
    dragRef.current = { type: "canvas", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: offsetX, startValueY: offsetY };
  }, [offsetX, offsetY]);

  const startTableDrag = useCallback((e: React.MouseEvent, table: DBMLTable) => {
    e.stopPropagation();
    dragRef.current = { type: "table", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: table.x, startValueY: table.y, tableName: table.name };
    selectTable(table.name);
  }, [selectTable]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.type) return;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      if (d.type === "canvas") {
        setViewport(d.startValueX + dx, d.startValueY + dy);
      } else if (d.type === "table" && d.tableName) {
        moveTable(d.tableName, d.startValueX + dx / zoom, d.startValueY + dy / zoom);
      }
    };
    const handleMouseUp = () => { dragRef.current = { ...dragRef.current, type: null }; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [zoom, setViewport, moveTable]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(zoom + (e.deltaY > 0 ? -0.1 : 0.1));
  }, [zoom, setZoom]);

  return { startCanvasDrag, startTableDrag, handleWheel };
}
