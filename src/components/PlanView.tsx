// src/components/PlanView.tsx
// =============================================================================
// Plan View panel (MVP 1) — debug + tool normalization (safe, compile-proof)
//
// Shows:
// - anchors: how many anchors exist in state
// - clicks: how many times the SVG background handler fires
// - creates: how many times we *attempt* to create an anchor (isAnchorTool === true)
// - toolRaw/toolNorm/isAnchor: proves what the tool value actually is
//
// This lets us isolate issues immediately.
// =============================================================================

import React, { useMemo, useRef, useState } from "react";
import type { Anchor, ProjectSpecs } from "../types";
import { snapAndClampPoint } from "../utils/geometry";
import type { ToolMode } from "./ToolsPanel";

type Props = {
  specs: ProjectSpecs;
  anchors: Anchor[];

  tool: ToolMode;

  selectedAnchorId: string | null;
  setSelectedAnchorId: (id: string | null) => void;

  createAnchor: (x: number, y: number) => void;
  updateAnchorPosition: (id: string, x: number, y: number) => void;
};

export function PlanView({
  specs,
  anchors,
  tool,
  selectedAnchorId,
  setSelectedAnchorId,
  createAnchor,
  updateAnchorPosition,
}: Props) {
  // ---------------------------------------------------------------------------
  // TOOL NORMALIZATION (IMPORTANT)
  // Even if tool *looks* like "anchor", it could include invisible chars.
  // We normalize once and use the normalized value in comparisons.
  // ---------------------------------------------------------------------------
  const toolRaw = String(tool);
  const toolNormalized = toolRaw
    .replace(/[\s\u00A0\u200B-\u200D\uFEFF]+/g, "") // strip spaces + NBSP + zero-width chars
    .toLowerCase();

  const isAnchorTool = toolNormalized === "anchor";
  const isSelectTool = toolNormalized === "select";

  // ---------------------------------------------------------------------------
  // SECTION A — Viewport scaling (project units -> pixels)
  // ---------------------------------------------------------------------------
  const PX_PER_UNIT = 20;
  const padding = 24;

  const svgWidth = specs.width * PX_PER_UNIT + padding * 2;
  const svgHeight = specs.depth * PX_PER_UNIT + padding * 2;

  const boundary = {
    x: padding,
    y: padding,
    w: specs.width * PX_PER_UNIT,
    h: specs.depth * PX_PER_UNIT,
  };

  // ---------------------------------------------------------------------------
  // SECTION B — Centered grid offsets (even margins to edges)
  // ---------------------------------------------------------------------------
  const gridStep = specs.gridSize;

  const stepsX = gridStep > 0 ? Math.floor(specs.width / gridStep) : 0;
  const stepsY = gridStep > 0 ? Math.floor(specs.depth / gridStep) : 0;

  const gridOffsetX = gridStep > 0 ? (specs.width - stepsX * gridStep) / 2 : 0;
  const gridOffsetY = gridStep > 0 ? (specs.depth - stepsY * gridStep) / 2 : 0;

  // ---------------------------------------------------------------------------
  // SECTION C — Interaction + debug state
  // ---------------------------------------------------------------------------
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [debugClicks, setDebugClicks] = useState(0);
  const [debugCreates, setDebugCreates] = useState(0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Convert browser coords to PROJECT coords (inches), relative to boundary
  function screenToProject(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const rect = svg.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const localX = (sx - boundary.x) / PX_PER_UNIT;
    const localY = (sy - boundary.y) / PX_PER_UNIT;

    return { x: localX, y: localY };
  }

  // ---------------------------------------------------------------------------
  // SECTION D — Grid rendering
  // ---------------------------------------------------------------------------
  const gridLines = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const step = specs.gridSize;
    if (step <= 0) return lines;

    for (let x = gridOffsetX; x <= specs.width + 1e-6; x += step) {
      const px = boundary.x + x * PX_PER_UNIT;
      lines.push({ x1: px, y1: boundary.y, x2: px, y2: boundary.y + boundary.h });
    }

    for (let y = gridOffsetY; y <= specs.depth + 1e-6; y += step) {
      const py = boundary.y + y * PX_PER_UNIT;
      lines.push({ x1: boundary.x, y1: py, x2: boundary.x + boundary.w, y2: py });
    }

    return lines;
  }, [
    specs.width,
    specs.depth,
    specs.gridSize,
    gridOffsetX,
    gridOffsetY,
    boundary.x,
    boundary.y,
    boundary.w,
    boundary.h,
  ]);

  // Selected anchor lookup (for footer)
  const selectedAnchor = useMemo(() => {
    if (!selectedAnchorId) return null;
    return anchors.find((a) => a.id === selectedAnchorId) ?? null;
  }, [anchors, selectedAnchorId]);

  // Convert anchor project coords -> SVG pixel coords
  function anchorToSvg(a: Anchor) {
    return {
      cx: boundary.x + a.x * PX_PER_UNIT,
      cy: boundary.y + a.y * PX_PER_UNIT,
    };
  }

  // ---------------------------------------------------------------------------
  // SECTION E — Background interaction
  // ---------------------------------------------------------------------------
  function onBackgroundMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();

    setDebugClicks((c) => c + 1);

    const { x, y } = screenToProject(e.clientX, e.clientY);

    const p = snapAndClampPoint(
      x,
      y,
      specs.gridSize,
      0,
      0,
      specs.width,
      specs.depth,
      gridOffsetX,
      gridOffsetY
    );

    // NOTE: We use isAnchorTool (normalized) instead of tool === "anchor"
    if (isAnchorTool) {
      setDebugCreates((c) => c + 1);
      createAnchor(p.x, p.y);
      setSelectedAnchorId(null);
      return;
    }

    // Select tool: clicking empty space deselects
    setSelectedAnchorId(null);
  }

  // Drag move (select tool)
  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!draggingId) return;

    const { x, y } = screenToProject(e.clientX, e.clientY);

    const p = snapAndClampPoint(
      x,
      y,
      specs.gridSize,
      0,
      0,
      specs.width,
      specs.depth,
      gridOffsetX,
      gridOffsetY
    );

    updateAnchorPosition(draggingId, p.x, p.y);
  }

  function onMouseUp() {
    setDraggingId(null);
  }

  // ---------------------------------------------------------------------------
  // SECTION F — Anchor interaction
  // ---------------------------------------------------------------------------
  function onAnchorMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedAnchorId(id);

    if (isSelectTool) {
      setDraggingId(id);
    }
  }

  return (
    <div style={wrapStyle}>
      <div style={titleBarStyle}>
        <div style={{ fontWeight: 700 }}>Plan View</div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {specs.width}
            {specs.units} × {specs.depth}
            {specs.units} · grid {specs.gridSize}
            {specs.units}
          </div>

          {/* Debug line: this should tell us the truth about the tool value */}
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            OffsetX: {gridOffsetX.toFixed(3)}
            {specs.units}, OffsetY: {gridOffsetY.toFixed(3)}
            {specs.units} · anchors {anchors.length} · clicks {debugClicks} · creates {debugCreates}
            {" · "}toolRaw "{toolRaw}"
            {" · "}toolNorm "{toolNormalized}"
            {" · "}isAnchor {String(isAnchorTool)}
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        style={svgStyle}
        onMouseDown={onBackgroundMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {/* Clip grid to the boundary rectangle */}
        <defs>
          <clipPath id="plan-boundary-clip">
            <rect x={boundary.x} y={boundary.y} width={boundary.w} height={boundary.h} />
          </clipPath>
        </defs>

        {/* Overall background */}
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="rgba(250,250,250,1)" />

        {/* Boundary */}
        <rect
          x={boundary.x}
          y={boundary.y}
          width={boundary.w}
          height={boundary.h}
          fill="white"
          stroke="black"
          strokeWidth={2}
        />

        {/* Grid */}
        <g clipPath="url(#plan-boundary-clip)" opacity={0.22} pointerEvents="none">
          {gridLines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="black"
              strokeWidth={1}
            />
          ))}
        </g>

        {/* Anchors */}
        {anchors.map((a) => {
          const { cx, cy } = anchorToSvg(a);
          const selected = a.id === selectedAnchorId;

          return (
            <g key={a.id} onMouseDown={(e) => onAnchorMouseDown(e, a.id)} style={{ cursor: "pointer" }}>
              <circle
                cx={cx}
                cy={cy}
                r={selected ? 8 : 6}
                fill={selected ? "black" : "white"}
                stroke="black"
                strokeWidth={2}
              />
              <text x={cx + 10} y={cy - 10} fontSize={12} fontFamily="system-ui">
                {a.id}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={footerStyle}>
        {selectedAnchorId ? (
          <span>
            Selected: <b>{selectedAnchorId}</b>
            {selectedAnchor ? (
              <span style={{ marginLeft: 12, opacity: 0.85 }}>
                · L {selectedAnchor.x.toFixed(2)}
                {specs.units} · R {(specs.width - selectedAnchor.x).toFixed(2)}
                {specs.units} · T {selectedAnchor.y.toFixed(2)}
                {specs.units} · B {(specs.depth - selectedAnchor.y).toFixed(2)}
                {specs.units}
              </span>
            ) : null}
          </span>
        ) : (
          <span>No selection</span>
        )}

        <span style={{ opacity: 0.7 }}>
          Tool: <b>{toolRaw}</b> · Tip: Select tool lets you drag
        </span>
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: 12,
  gap: 10,
  overflow: "auto",
};

const titleBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const svgStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  background: "rgba(250,250,250,1)",
  userSelect: "none",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
};
