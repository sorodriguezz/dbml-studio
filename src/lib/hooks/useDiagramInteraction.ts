"use client";
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { DBMLTable, DBMLEnum } from "@/types";

interface DragState {
  type: "canvas" | "table" | "enum" | null;
  startMouseX: number;
  startMouseY: number;
  startValueX: number;
  startValueY: number;
  itemName?: string;
}

export function useDiagramInteraction() {
  const { offsetX, offsetY, zoom, setViewport, setZoom, moveTable, moveEnum, selectTable } = useAppStore();
  const dragRef = useRef<DragState>({ type: null, startMouseX: 0, startMouseY: 0, startValueX: 0, startValueY: 0 });

  const startCanvasDrag = useCallback((e: React.MouseEvent) => {
    dragRef.current = { type: "canvas", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: offsetX, startValueY: offsetY };
  }, [offsetX, offsetY]);

  const startTableDrag = useCallback((e: React.MouseEvent, table: DBMLTable) => {
    e.stopPropagation();
    dragRef.current = { type: "table", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: table.x, startValueY: table.y, itemName: table.name };
    selectTable(table.name);
  }, [selectTable]);

  const startEnumDrag = useCallback((e: React.MouseEvent, en: DBMLEnum) => {
    e.stopPropagation();
    dragRef.current = { type: "enum", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: en.x, startValueY: en.y, itemName: en.name };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.type) return;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      if (d.type === "canvas") {
        setViewport(d.startValueX + dx, d.startValueY + dy);
      } else if (d.type === "table" && d.itemName) {
        moveTable(d.itemName, d.startValueX + dx / zoom, d.startValueY + dy / zoom);
      } else if (d.type === "enum" && d.itemName) {
        moveEnum(d.itemName, d.startValueX + dx / zoom, d.startValueY + dy / zoom);
      }
    };
    const handleMouseUp = () => { dragRef.current = { ...dragRef.current, type: null }; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [zoom, setViewport, moveTable, moveEnum]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(zoom + (e.deltaY > 0 ? -0.1 : 0.1));
  }, [zoom, setZoom]);

  return { startCanvasDrag, startTableDrag, startEnumDrag, handleWheel };
}
