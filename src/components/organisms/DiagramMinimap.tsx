"use client";
import { useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

const TABLE_W = 260;
const HEADER_H = 40;
const FIELD_H = 32;
const MINIMAP_W = 200;
const MINIMAP_H = 140;
const PAD = 16;

function tableHeight(fieldCount: number) {
  return HEADER_H + fieldCount * FIELD_H;
}

export function DiagramMinimap({ containerWidth, containerHeight }: { containerWidth: number; containerHeight: number }) {
  // All hooks before any conditional return
  const { parsed, offsetX, offsetY, zoom, setViewport } = useAppStore();
  const isDragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  // Keep latest values accessible in event handlers without stale closures
  const stateRef = useRef({ zoom: 1, cw: 0, ch: 0 });
  stateRef.current = { zoom, cw: containerWidth, ch: containerHeight };

  if (!parsed || parsed.tables.length === 0) return null;

  // World bounding box of all tables
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of parsed.tables) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + TABLE_W);
    maxY = Math.max(maxY, t.y + tableHeight(t.fields.length));
  }
  minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
  const worldW = Math.max(maxX - minX, 1);
  const worldH = Math.max(maxY - minY, 1);

  // Stroke width that stays readable regardless of world scale
  const sw = Math.max(worldW, worldH) / 120;

  // Viewport rect in world coordinates
  // Canvas transform: screenPos = worldPos * zoom + offset  →  worldPos = (screenPos - offset) / zoom
  const vpX = -offsetX / zoom;
  const vpY = -offsetY / zoom;
  const vpW = Math.max(containerWidth / zoom, 1);
  const vpH = Math.max(containerHeight / zoom, 1);

  function moveViewport(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const { zoom, cw, ch } = stateRef.current;
    // Use the SVG's own CTM to convert screen px → viewBox (world) coordinates.
    // This is exact regardless of preserveAspectRatio letterboxing offsets.
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const world = pt.matrixTransform(ctm.inverse());
    // Center the canvas on that world point
    setViewport(cw / 2 - world.x * zoom, ch / 2 - world.y * zoom);
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-zinc-700/60 bg-zinc-900/90 backdrop-blur-sm shadow-xl flex-shrink-0"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/*
        viewBox is set to the world bounding box of all tables.
        SVG with preserveAspectRatio="xMidYMid meet" handles scaling/centering.
        Everything is drawn in world coordinates — no manual projection math needed.
      */}
      <svg
        ref={svgRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        viewBox={`${minX} ${minY} ${worldW} ${worldH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: "crosshair", display: "block" }}
        onMouseDown={(e) => { isDragging.current = true; moveViewport(e); e.stopPropagation(); }}
        onMouseMove={(e) => { if (isDragging.current) { moveViewport(e); e.stopPropagation(); } }}
        onMouseUp={(e) => { isDragging.current = false; e.stopPropagation(); }}
        onMouseLeave={(e) => { isDragging.current = false; e.stopPropagation(); }}
      >
        {/* Tables */}
        {parsed.tables.map((t) => (
          <rect
            key={t.name}
            x={t.x}
            y={t.y}
            width={TABLE_W}
            height={tableHeight(t.fields.length)}
            rx={sw * 2}
            fill="#27272a"
            stroke="#52525b"
            strokeWidth={sw}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          x={vpX}
          y={vpY}
          width={vpW}
          height={vpH}
          rx={sw * 2}
          fill="#fbbf2415"
          stroke="#fbbf24"
          strokeWidth={sw}
        />
      </svg>

      <div className="absolute bottom-1 right-2 text-[9px] text-zinc-600 font-mono pointer-events-none select-none">
        minimap
      </div>
    </div>
  );
}

