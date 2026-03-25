"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [isDragging, setIsDragging] = useState(false);

  const startCanvasDrag = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = { type: "canvas", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: offsetX, startValueY: offsetY };
  }, [offsetX, offsetY]);

  const startTableDrag = useCallback((e: React.MouseEvent, table: DBMLTable) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { type: "table", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: table.x, startValueY: table.y, itemName: table.name };
    selectTable(table.name);
  }, [selectTable]);

  const startEnumDrag = useCallback((e: React.MouseEvent, en: DBMLEnum) => {
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { type: "enum", startMouseX: e.clientX, startMouseY: e.clientY, startValueX: en.x, startValueY: en.y, itemName: en.name };
  }, []);

  useEffect(() => {
    let rafId: number | null = null;
    const pending = { clientX: 0, clientY: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.type) return;
      pending.clientX = e.clientX;
      pending.clientY = e.clientY;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const d2 = dragRef.current;
        if (!d2.type) return;
        const dx = pending.clientX - d2.startMouseX;
        const dy = pending.clientY - d2.startMouseY;
        if (d2.type === "canvas") {
          setViewport(d2.startValueX + dx, d2.startValueY + dy);
        } else if (d2.type === "table" && d2.itemName) {
          moveTable(d2.itemName, d2.startValueX + dx / zoom, d2.startValueY + dy / zoom);
        } else if (d2.type === "enum" && d2.itemName) {
          moveEnum(d2.itemName, d2.startValueX + dx / zoom, d2.startValueY + dy / zoom);
        }
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      dragRef.current = { ...dragRef.current, type: null };
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [zoom, setViewport, moveTable, moveEnum]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(zoom + (e.deltaY > 0 ? -0.1 : 0.1));
  }, [zoom, setZoom]);

  return { startCanvasDrag, startTableDrag, startEnumDrag, handleWheel, isDragging };
}
