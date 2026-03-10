"use client";
import { useCallback } from "react";
import type { DBMLTable } from "@/types";

const EXPORT_MARGIN = 60;
const TABLE_W = 260;
const HEADER_H = 40;
const FIELD_H = 32;

export function useExportDiagram(
  containerRef: React.RefObject<HTMLDivElement | null>,
  tables: DBMLTable[]
) {
  const exportPNG = useCallback(async () => {
    const container = containerRef.current;
    if (!container || tables.length === 0) return;

    // 1. Bounding box of all table cards in diagram space
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tables) {
      const h = HEADER_H + t.fields.length * FIELD_H;
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + TABLE_W);
      maxY = Math.max(maxY, t.y + h);
    }
    const W = maxX - minX + EXPORT_MARGIN * 2;
    const H = maxY - minY + EXPORT_MARGIN * 2;
    const exOX = EXPORT_MARGIN - minX;
    const exOY = EXPORT_MARGIN - minY;

    // 2. Find DOM targets via data-export attributes
    const innerDiv   = container.querySelector<HTMLDivElement>('[data-export="inner"]');
    const svgRefs    = container.querySelector<SVGSVGElement>('[data-export="svg-refs"]');
    const svgRefsG   = svgRefs?.querySelector<SVGGElement>('g') ?? null;
    const svgGrid    = container.querySelector<SVGSVGElement>('[data-export="svg-grid"]');
    const gridPat    = svgGrid?.querySelector<SVGPatternElement>('#dot-grid') ?? null;

    // 3. Save originals
    const origCtn    = { ov: container.style.overflow, w: container.style.width, h: container.style.height };
    const origInner  = innerDiv?.style.transform ?? '';
    const origRefsW  = svgRefs?.style.width ?? '';
    const origRefsH  = svgRefs?.style.height ?? '';
    const origRefsG  = svgRefsG?.getAttribute('transform') ?? '';
    const origGridW  = svgGrid?.style.width ?? '';
    const origGridH  = svgGrid?.style.height ?? '';
    const origPatX   = gridPat?.getAttribute('x') ?? '';
    const origPatY   = gridPat?.getAttribute('y') ?? '';
    const origPatW   = gridPat?.getAttribute('width') ?? '';
    const origPatH   = gridPat?.getAttribute('height') ?? '';

    const restore = () => {
      container.style.overflow = origCtn.ov;
      container.style.width    = origCtn.w;
      container.style.height   = origCtn.h;
      if (innerDiv)  innerDiv.style.transform = origInner;
      if (svgRefs)   { svgRefs.style.width = origRefsW; svgRefs.style.height = origRefsH; }
      if (svgRefsG)  svgRefsG.setAttribute('transform', origRefsG);
      if (svgGrid)   { svgGrid.style.width = origGridW; svgGrid.style.height = origGridH; }
      if (gridPat) {
        gridPat.setAttribute('x', origPatX);
        gridPat.setAttribute('y', origPatY);
        gridPat.setAttribute('width', origPatW);
        gridPat.setAttribute('height', origPatH);
      }
    };

    // 4. Apply export overrides — full canvas at scale 1
    container.style.overflow = 'visible';
    container.style.width    = `${W}px`;
    container.style.height   = `${H}px`;
    if (innerDiv)  innerDiv.style.transform = `translate(${exOX}px,${exOY}px) scale(1)`;
    if (svgRefs)   { svgRefs.style.width = `${W}px`; svgRefs.style.height = `${H}px`; }
    if (svgRefsG)  svgRefsG.setAttribute('transform', `translate(${exOX},${exOY}) scale(1)`);
    if (svgGrid)   { svgGrid.style.width = `${W}px`; svgGrid.style.height = `${H}px`; }
    if (gridPat) {
      gridPat.setAttribute('x', String((exOX % 20).toFixed(1)));
      gridPat.setAttribute('y', String((exOY % 20).toFixed(1)));
      gridPat.setAttribute('width',  '20');
      gridPat.setAttribute('height', '20');
    }

    // 5. Wait for layout then capture
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(container, {
        backgroundColor: "#09090b",
        pixelRatio: 2,
        width: W,
        height: H,
        filter: (node: HTMLElement) => !node.classList?.contains("diagram-controls"),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "dbml-diagram.png";
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      restore();
    }
  }, [containerRef, tables]);

  return { exportPNG };
}
