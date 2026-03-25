"use client";
import { useCallback } from "react";
import type { DBMLTable, DBMLRef, DBMLEnum } from "@/types";

const EXPORT_MARGIN = 60;
const TABLE_W = 260;
const HEADER_H = 40;
const FIELD_H = 32;
const ENUM_W = 200;
const ENUM_HEADER_H = 32;
const ENUM_VALUE_H = 24;

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function useExportDiagram(
  containerRef: React.RefObject<HTMLDivElement | null>,
  tables: DBMLTable[],
  refs: DBMLRef[] = [],
  enums: DBMLEnum[] = []
) {
  const exportPNG = useCallback(async () => {
    const container = containerRef.current;
    if (!container || tables.length === 0) return;

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

    const innerDiv   = container.querySelector<HTMLDivElement>('[data-export="inner"]');
    const svgRefs    = container.querySelector<SVGSVGElement>('[data-export="svg-refs"]');
    const svgRefsG   = svgRefs?.querySelector<SVGGElement>('g') ?? null;
    const svgGrid    = container.querySelector<SVGSVGElement>('[data-export="svg-grid"]');
    const gridPat    = svgGrid?.querySelector<SVGPatternElement>('#dot-grid') ?? null;

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

  const exportSVG = useCallback(() => {
    if (tables.length === 0) return;

    // Compute bounding box including enums
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of tables) {
      const h = HEADER_H + t.fields.length * FIELD_H;
      minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + TABLE_W); maxY = Math.max(maxY, t.y + h);
    }
    for (const en of enums) {
      const h = ENUM_HEADER_H + en.values.length * ENUM_VALUE_H;
      minX = Math.min(minX, en.x); minY = Math.min(minY, en.y);
      maxX = Math.max(maxX, en.x + ENUM_W); maxY = Math.max(maxY, en.y + h);
    }

    const W = maxX - minX + EXPORT_MARGIN * 2;
    const H = maxY - minY + EXPORT_MARGIN * 2;
    const ox = EXPORT_MARGIN - minX;
    const oy = EXPORT_MARGIN - minY;
    const tableMap = new Map(tables.map(t => [t.name, t]));

    const parts: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`,
      `<rect width="${W}" height="${H}" fill="#09090b"/>`,
      // dot grid
      `<defs><pattern id="g" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">`,
      `<circle cx="1" cy="1" r="1" fill="#71717a" opacity="0.3"/></pattern></defs>`,
      `<rect width="${W}" height="${H}" fill="url(#g)"/>`,
    ];

    // Relation lines
    for (const ref of refs) {
      const [ft, ff] = ref.from.split(".");
      const [tt, tf] = ref.to.split(".");
      const fromT = tableMap.get(ft);
      const toT   = tableMap.get(tt);
      if (!fromT || !toT) continue;
      const ffIdx = fromT.fields.findIndex(f => f.name === ff);
      const tfIdx = toT.fields.findIndex(f => f.name === tf);
      const fy = fromT.y + oy + HEADER_H + (ffIdx >= 0 ? ffIdx * FIELD_H + FIELD_H / 2 : 16);
      const ty2 = toT.y + oy + HEADER_H + (tfIdx >= 0 ? tfIdx * FIELD_H + FIELD_H / 2 : 16);
      const fx = (fromT.x + ox + TABLE_W / 2 <= toT.x + ox + TABLE_W / 2) ? fromT.x + ox + TABLE_W : fromT.x + ox;
      const tx2 = (fromT.x + ox + TABLE_W / 2 <= toT.x + ox + TABLE_W / 2) ? toT.x + ox : toT.x + ox + TABLE_W;
      const spread = Math.max(60, Math.abs(tx2 - fx) * 0.45);
      const cx1 = fx > tx2 ? fx - spread : fx + spread;
      const cx2 = fx > tx2 ? tx2 + spread : tx2 - spread;
      parts.push(
        `<path d="M ${fx} ${fy} C ${cx1} ${fy}, ${cx2} ${ty2}, ${tx2} ${ty2}" ` +
        `stroke="#f59e0b" stroke-width="1.5" stroke-opacity="0.7" fill="none"/>`
      );
    }

    // Table cards
    for (const t of tables) {
      const tx = t.x + ox;
      const ty = t.y + oy;
      const th = HEADER_H + t.fields.length * FIELD_H;
      parts.push(`<rect x="${tx}" y="${ty}" width="${TABLE_W}" height="${th}" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="1"/>`);
      parts.push(`<rect x="${tx}" y="${ty}" width="${TABLE_W}" height="${HEADER_H}" rx="8" fill="#27272a"/>`);
      parts.push(`<rect x="${tx}" y="${ty + HEADER_H - 8}" width="${TABLE_W}" height="8" fill="#27272a"/>`);
      parts.push(`<text x="${tx + 12}" y="${ty + 26}" font-family="ui-monospace,monospace" font-size="13" font-weight="bold" fill="#d4d4d8">${escXml(t.name)}</text>`);
      parts.push(`<text x="${tx + TABLE_W - 8}" y="${ty + 26}" font-family="ui-monospace,monospace" font-size="10" fill="#52525b" text-anchor="end">${t.fields.length}</text>`);
      for (let fi = 0; fi < t.fields.length; fi++) {
        const f = t.fields[fi];
        const fy = ty + HEADER_H + fi * FIELD_H;
        const fc = f.isPk ? "#fbbf24" : "#a1a1aa";
        if (fi > 0) parts.push(`<line x1="${tx}" y1="${fy}" x2="${tx + TABLE_W}" y2="${fy}" stroke="#27272a" stroke-width="1"/>`);
        parts.push(`<text x="${tx + 12}" y="${fy + 21}" font-family="ui-monospace,monospace" font-size="11" fill="${fc}">${escXml(f.name)}</text>`);
        parts.push(`<text x="${tx + TABLE_W - 10}" y="${fy + 21}" font-family="ui-monospace,monospace" font-size="10" fill="#52525b" text-anchor="end">${escXml(f.type)}</text>`);
        if (f.isPk) parts.push(`<text x="${tx + 12}" y="${fy + 20}" font-family="ui-monospace,monospace" font-size="8" fill="#78350f" text-anchor="end">PK</text>`);
      }
    }

    // Enum cards
    for (const en of enums) {
      const ex = en.x + ox;
      const ey = en.y + oy;
      const eh = ENUM_HEADER_H + en.values.length * ENUM_VALUE_H;
      parts.push(`<rect x="${ex}" y="${ey}" width="${ENUM_W}" height="${eh}" rx="8" fill="#1a1325" stroke="#4c1d95" stroke-width="1"/>`);
      parts.push(`<rect x="${ex}" y="${ey}" width="${ENUM_W}" height="${ENUM_HEADER_H}" rx="8" fill="#2e1065"/>`);
      parts.push(`<rect x="${ex}" y="${ey + ENUM_HEADER_H - 8}" width="${ENUM_W}" height="8" fill="#2e1065"/>`);
      parts.push(`<text x="${ex + 8}" y="${ey + 14}" font-family="ui-monospace,monospace" font-size="8" fill="#7c3aed" letter-spacing="1">ENUM</text>`);
      parts.push(`<text x="${ex + 10}" y="${ey + 26}" font-family="ui-monospace,monospace" font-size="12" font-weight="bold" fill="#c4b5fd">${escXml(en.name)}</text>`);
      for (let vi = 0; vi < en.values.length; vi++) {
        const vy = ey + ENUM_HEADER_H + vi * ENUM_VALUE_H;
        if (vi > 0) parts.push(`<line x1="${ex}" y1="${vy}" x2="${ex + ENUM_W}" y2="${vy}" stroke="#2e1065" stroke-width="1"/>`);
        parts.push(`<text x="${ex + 12}" y="${vy + 17}" font-family="ui-monospace,monospace" font-size="11" fill="#a78bfa">${escXml(en.values[vi])}</text>`);
      }
    }

    parts.push("</svg>");
    const svg = parts.join("\n");
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dbml-diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, [tables, refs, enums]);

  return { exportPNG, exportSVG };
}
