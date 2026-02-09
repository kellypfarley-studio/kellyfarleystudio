import { useEffect, useMemo, useRef, useState } from "react";
import type { Anchor, Cluster, Guide, Pile, ProjectSpecs, ToolMode, ViewTransform } from "../types/appTypes";
import type { Ref } from "react";
import PanelFrame from "../components/PanelFrame";
import ViewControls from "../components/ViewControls";
import { gridCenterOffset } from "../utils/geometry";
import { round } from "../utils/number";
import { computeClusterLayout } from "../utils/clusterLayout";

export function computePlanFitBounds(specs: ProjectSpecs) {
  const pad = 1.5;
  const minX = -pad;
  const minY = -pad;
  const maxX = specs.boundaryWidthIn + pad;
  const maxY = specs.boundaryHeightIn + pad;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export type PlanViewPanelProps = {
  specs: ProjectSpecs;
  view: ViewTransform;
  onViewChange: (next: ViewTransform) => void;
  svgRef?: Ref<SVGSVGElement>;

  mode: ToolMode;

  anchors: Anchor[];
  piles?: Pile[];
  clusters?: Cluster[];
  guides?: Guide[];
  showGuides?: boolean;
  guidesLocked?: boolean;
  selectedAnchorId: string | null;
  selectedPileId?: string | null;
  selectedGuideId?: string | null;
  pendingCopyAnchorId?: string | null;

  onPlaceStrand: (xIn: number, yIn: number) => void;
  onPlaceStack: (xIn: number, yIn: number) => void;
  onPlacePile?: (xIn: number, yIn: number) => void;
  onPlaceCluster: (xIn: number, yIn: number) => void;
  onPlaceCustomStrand: (xIn: number, yIn: number) => void;
  onBeginCopyAnchor?: (anchorId: string) => void;
  onPlaceCopyAt?: (xIn: number, yIn: number) => void;
  onPlaceCanopyFastener: (xIn: number, yIn: number) => void;
  onEnsureStrandHoleAt?: (xIn: number, yIn: number) => string | undefined;
  onSelectSwoop?: (swoopId: string) => void;
  swoops?: import("../types/appTypes").Swoop[];
  pendingSwoopStartHoleId?: string | null;
  planCursor?: import("../types/appTypes").CursorState | null;

  onSelectAnchor: (anchorId: string) => void;
  onSelectPile?: (pileId: string) => void;
  onSelectGuide?: (guideId: string) => void;
  onSwoopAnchorClick?: (anchorId: string) => void;
  onClearSelection: () => void;
  onMoveAnchor: (anchorId: string, xIn: number, yIn: number, snap?: boolean) => void;
  onMovePile?: (pileId: string, xIn: number, yIn: number, snap?: boolean) => void;
  onMoveGuide?: (guideId: string, posIn: number) => void;
  onAddGuide?: (orientation: "v" | "h", posIn: number) => void;
  onToggleShowGuides?: () => void;
  onToggleGuidesLocked?: () => void;
  onTogglePolarGuides?: () => void;
  onToggleSnapGuides?: () => void;
  onToggleSnapBoundary?: () => void;
  onToggleMaskOutside?: () => void;

  showLabels: boolean;
  onToggleShowLabels: () => void;

  onCursorMove: (xIn: number, yIn: number, inside: boolean) => void;
  onCursorLeave: () => void;
  panEnabled?: boolean;
  onTogglePan?: () => void;
};

function clientToSvgCoords(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const svgP = pt.matrixTransform(ctm.inverse());
  return { x: svgP.x, y: svgP.y };
}

function anchorLabel(
  a: Anchor,
  specs: ProjectSpecs,
  ox: number,
  oy: number,
): string {
  // Prefer persisted grid coordinates (stable across minor numeric drift)
  if (typeof a.gridRow === "number" && typeof a.gridCol === "number") {
    const rowIdx = Math.max(0, a.gridRow - 1);
    const row = String.fromCharCode("A".charCodeAt(0) + rowIdx);
    return `${row}${a.gridCol}`;
  }

  const g = specs.gridSpacingIn;
  if (!Number.isFinite(g) || g <= 0) return a.label ?? a.id;
  const col = Math.round((a.xIn - ox) / g) + 1;
  const rowIdx = Math.round((a.yIn - oy) / g);
  const row = String.fromCharCode("A".charCodeAt(0) + Math.max(0, rowIdx));
  return `${row}${col}`;
}

export default function PlanViewPanel(props: PlanViewPanelProps) {
  const { specs, view, svgRef: svgRefProp } = props;

  const ox = useMemo(() => gridCenterOffset(specs.boundaryWidthIn, specs.gridSpacingIn), [specs.boundaryWidthIn, specs.gridSpacingIn]);
  const oy = useMemo(() => gridCenterOffset(specs.boundaryHeightIn, specs.gridSpacingIn), [specs.boundaryHeightIn, specs.gridSpacingIn]);
  const boundaryShape = specs.boundaryShape ?? "rect";
  const boundaryCx = specs.boundaryWidthIn / 2;
  const boundaryCy = specs.boundaryHeightIn / 2;
  const boundaryRx = boundaryShape === "circle" ? Math.min(specs.boundaryWidthIn, specs.boundaryHeightIn) / 2 : specs.boundaryWidthIn / 2;
  const boundaryRy = boundaryShape === "circle" ? Math.min(specs.boundaryWidthIn, specs.boundaryHeightIn) / 2 : specs.boundaryHeightIn / 2;
  const minBoundaryR = Math.min(boundaryRx, boundaryRy);

  const bounds = useMemo(() => {
    const pad = 1.5;
    const minX = -pad;
    const minY = -pad;
    const maxX = specs.boundaryWidthIn + pad;
    const maxY = specs.boundaryHeightIn + pad;
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }, [specs.boundaryHeightIn, specs.boundaryWidthIn]);

  const viewZoom = Math.max(0.0001, view.zoom);
  const viewW = bounds.w / viewZoom;
  const viewH = bounds.h / viewZoom;
  const centerX = (bounds.minX + bounds.maxX) / 2 + (view.panX || 0);
  const centerY = (bounds.minY + bounds.maxY) / 2 + (view.panY || 0);
  const vbX = centerX - viewW / 2;
  const vbY = centerY - viewH / 2;
  const vbW = viewW;
  const vbH = viewH;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const setSvgRef = (el: SVGSVGElement | null) => {
    svgRef.current = el;
    if (!svgRefProp) return;
    if (typeof svgRefProp === "function") {
      try {
        (svgRefProp as any)(el);
      } catch (_) {}
    } else {
      try {
        (svgRefProp as any).current = el;
      } catch (_) {}
    }
  };
  const panRef = useRef<{ active: boolean; start: { x: number; y: number }; initPan: { x: number; y: number } }>({
    active: false,
    start: { x: 0, y: 0 },
    initPan: { x: 0, y: 0 },
  });

  const [measure, setMeasure] = useState<{ start: { x: number; y: number }; end: { x: number; y: number }; locked: boolean } | null>(null);

  const setMeasurePoint = (x: number, y: number) => {
    setMeasure((prev) => {
      if (!prev || prev.locked) {
        return { start: { x, y }, end: { x, y }, locked: false };
      }
      return { ...prev, end: { x, y }, locked: true };
    });
  };

  useEffect(() => {
    if (props.mode !== "measure") setMeasure(null);
  }, [props.mode]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && props.mode === "measure") {
        setMeasure(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.mode]);

  const gridLines = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const g = specs.gridSpacingIn;
    if (!Number.isFinite(g) || g <= 0) return { xs, ys };
    for (let x = ox; x <= specs.boundaryWidthIn + 1e-6; x += g) xs.push(round(x, 3));
    for (let y = oy; y <= specs.boundaryHeightIn + 1e-6; y += g) ys.push(round(y, 3));
    return { xs, ys };
  }, [ox, oy, specs.boundaryHeightIn, specs.boundaryWidthIn, specs.gridSpacingIn]);

  const showPolar = !!specs.showPolarGuides && boundaryShape !== "rect";
  const polarAngles = useMemo(() => {
    if (!showPolar) return [] as number[];
    const step = 15;
    const list: number[] = [];
    for (let a = 0; a < 360; a += step) list.push(a);
    return list;
  }, [showPolar]);

  const polarRings = useMemo(() => {
    if (!showPolar) return [] as number[];
    const spacing = Math.max(0.1, specs.gridSpacingIn);
    const list: number[] = [];
    for (let r = spacing; r <= minBoundaryR + 1e-6; r += spacing) list.push(round(r, 3));
    return list;
  }, [showPolar, specs.gridSpacingIn, minBoundaryR]);

  const isInsideBoundary = (x: number, y: number) => {
    if (boundaryShape === "rect") return x >= 0 && x <= specs.boundaryWidthIn && y >= 0 && y <= specs.boundaryHeightIn;
    if (boundaryRx <= 0 || boundaryRy <= 0) return false;
    const dx = x - boundaryCx;
    const dy = y - boundaryCy;
    return (dx * dx) / (boundaryRx * boundaryRx) + (dy * dy) / (boundaryRy * boundaryRy) <= 1;
  };

  const left = (
    <>
      <ViewControls
        view={view}
        onChange={props.onViewChange}
        onFit={() => props.onViewChange({ zoom: 1, panX: 0, panY: 0 })}
        panEnabled={props.panEnabled}
        onTogglePan={props.onTogglePan}
      />
      <div className="labelsToggle">
        <label>
          <input type="checkbox" checked={props.showLabels} onChange={props.onToggleShowLabels} />
          <div>Labels</div>
        </label>
      </div>
    </>
  );

  const guideCenter = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="btnGroup" title="Guides">
        <button
          onClick={() => {
            if (!props.onAddGuide) return;
            const pos = props.planCursor?.inside ? props.planCursor.xIn : specs.boundaryWidthIn / 2;
            props.onAddGuide("v", pos);
          }}
          disabled={!props.onAddGuide}
          title='Add vertical guide'
        >
          +V
        </button>
        <button
          onClick={() => {
            if (!props.onAddGuide) return;
            const pos = props.planCursor?.inside ? props.planCursor.yIn : specs.boundaryHeightIn / 2;
            props.onAddGuide("h", pos);
          }}
          disabled={!props.onAddGuide}
          title='Add horizontal guide'
        >
          +H
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }} title="Show/hide guides">
        <input
          type="checkbox"
          checked={!!props.showGuides}
          onChange={() => props.onToggleShowGuides?.()}
          disabled={!props.onToggleShowGuides}
        />
        <span className="smallLabel">Guides</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }} title="Lock/unlock guides">
        <input
          type="checkbox"
          checked={!!props.guidesLocked}
          onChange={() => props.onToggleGuidesLocked?.()}
          disabled={!props.onToggleGuidesLocked}
        />
        <span className="smallLabel">Lock</span>
      </label>

      <label
        style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none", opacity: boundaryShape === "rect" ? 0.5 : 1 }}
        title={boundaryShape === "rect" ? "Polar guides are available for circle/oval boundaries" : "Toggle polar guides"}
      >
        <input
          type="checkbox"
          checked={!!specs.showPolarGuides}
          onChange={() => props.onTogglePolarGuides?.()}
          disabled={!props.onTogglePolarGuides || boundaryShape === "rect"}
        />
        <span className="smallLabel">Polar</span>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }} title="Snap to guides">
        <input
          type="checkbox"
          checked={specs.snapToGuides !== false}
          onChange={() => props.onToggleSnapGuides?.()}
          disabled={!props.onToggleSnapGuides}
        />
        <span className="smallLabel">Snap G</span>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }} title="Clamp to boundary shape">
        <input
          type="checkbox"
          checked={specs.snapToBoundary !== false}
          onChange={() => props.onToggleSnapBoundary?.()}
          disabled={!props.onToggleSnapBoundary}
        />
        <span className="smallLabel">Snap B</span>
      </label>

      <label
        style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none", opacity: boundaryShape === "rect" ? 0.5 : 1 }}
        title={boundaryShape === "rect" ? "Mask is for circle/oval boundaries" : "Dim outside boundary"}
      >
        <input
          type="checkbox"
          checked={!!specs.maskOutsideBoundary}
          onChange={() => props.onToggleMaskOutside?.()}
          disabled={!props.onToggleMaskOutside || boundaryShape === "rect"}
        />
        <span className="smallLabel">Mask</span>
      </label>
    </div>
  );

  // helper to compute fit bounds for plan view (exported)
  return (
    <PanelFrame
      title="Plan View"
      center={guideCenter}
      headerHint={
        <span className="muted">
          Boundary: {specs.boundaryWidthIn}" × {specs.boundaryHeightIn}" {boundaryShape !== "rect" ? `(${boundaryShape})` : ""}  •  Grid {specs.gridSpacingIn}"  •  Holes {specs.strandHoleDiameterIn}"/{specs.fastenerHoleDiameterIn}"
        </span>
      }
      left={left}
      >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <svg
        ref={setSvgRef}
        width="100%"
        height="100%"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: "#fff", touchAction: "none" }}
      >
        {/* Hit layer: always receives pointer move events */}
        <rect
          x={vbX}
          y={vbY}
          width={vbW}
          height={vbH}
          fill="transparent"
          pointerEvents="all"
          onPointerMove={(ev) => {
            const svg = svgRef.current;
            if (!svg) return;
            const p = clientToSvgCoords(svg, ev.clientX, ev.clientY);
            const inside = isInsideBoundary(p.x, p.y);
            props.onCursorMove(p.x, p.y, inside);
            if (props.mode === "measure") {
              setMeasure((prev) => {
                if (!prev || prev.locked) return prev;
                return { ...prev, end: { x: p.x, y: p.y } };
              });
            }
          }}
          onPointerLeave={() => props.onCursorLeave()}
          onPointerDown={(ev) => {
            const svg = svgRef.current;
            if (!svg) return;

            if (props.panEnabled) {
              ev.preventDefault();
              const start = clientToSvgCoords(svg, ev.clientX, ev.clientY);
              panRef.current.active = true;
              panRef.current.start = start;
              panRef.current.initPan = { x: props.view.panX || 0, y: props.view.panY || 0 };

              const onMove = (mev: PointerEvent) => {
                if (!panRef.current.active) return;
                const cur = clientToSvgCoords(svg, mev.clientX, mev.clientY);
                const dx = panRef.current.start.x - cur.x;
                const dy = panRef.current.start.y - cur.y;
                props.onViewChange({ zoom: props.view.zoom, panX: panRef.current.initPan.x + dx, panY: panRef.current.initPan.y + dy });
              };

              const onUp = () => {
                panRef.current.active = false;
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                try { if (svg) svg.style.cursor = props.panEnabled ? 'grab' : 'default'; } catch (_) {}
              };

              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
              (ev.target as Element).setPointerCapture(ev.pointerId);
              try {
                svg.style.cursor = 'grabbing';
              } catch (_) {}
              return;
            }

            // Background click: place or clear or move, depending on mode.
            const p = clientToSvgCoords(svg, ev.clientX, ev.clientY);

            if (props.mode === "measure") {
              setMeasurePoint(p.x, p.y);
              return;
            }

            if (props.mode === "place_strand") {
              props.onPlaceStrand(p.x, p.y);
              return;
            }
            if (props.mode === "place_stack") {
              props.onPlaceStack(p.x, p.y);
              return;
            }
            if (props.mode === "place_pile") {
              if (!props.onPlacePile) {
                alert("Pile placement is not configured.");
                return;
              }
              props.onPlacePile(p.x, p.y);
              return;
            }
            if (props.mode === "place_cluster") {
              props.onPlaceCluster(p.x, p.y);
              return;
            }
            if (props.mode === "place_custom_strand") {
              props.onPlaceCustomStrand(p.x, p.y);
              return;
            }
            if (props.mode === "copy_anchor") {
              if (props.pendingCopyAnchorId && props.onPlaceCopyAt) {
                props.onPlaceCopyAt(p.x, p.y);
              } else {
                alert("Copy: click a hole to copy, then click a new location.");
              }
              return;
            }
            if (props.mode === "place_swoop") {
              // Swoop placement on background: ensure a *strand hole only* then feed it into the A→B swoop flow.
              if (!props.onEnsureStrandHoleAt || !props.onSwoopAnchorClick) {
                alert("Swoop placement is not configured (missing ensureStrandHoleAt handler).");
                return;
              }

              const newId = props.onEnsureStrandHoleAt(p.x, p.y);
              if (!newId) {
                // e.g. attempted to reuse a fastener hole
                alert("Cannot use a fastener hole for a swoop. Choose or create a strand hole.");
                return;
              }

              props.onSwoopAnchorClick(newId);
              return;
            }
            if (props.mode === "place_canopy_fastener") {
              props.onPlaceCanopyFastener(p.x, p.y);
              return;
            }
            if (props.mode === "move_anchor") {
              if (props.selectedAnchorId) {
                props.onMoveAnchor(props.selectedAnchorId, p.x, p.y, !ev.altKey);
                return;
              }
              if (props.selectedPileId && props.onMovePile) {
                props.onMovePile(props.selectedPileId, p.x, p.y, !ev.altKey);
                return;
              }
              if (props.selectedGuideId && props.onMoveGuide && !props.guidesLocked) {
                const g = (props.guides ?? []).find((x) => x.id === props.selectedGuideId) ?? null;
                if (g) {
                  const pos = g.orientation === "v" ? p.x : p.y;
                  props.onMoveGuide(g.id, pos);
                  return;
                }
              }
              return;
            }
            // select mode: clear selection on empty background click
            if (props.mode === "select") props.onClearSelection();
          }}
        />

        
        {/* Grid */}
        <g>
          {gridLines.xs.map((x) => (
            <line key={`gx_${x}`} x1={x} y1={0} x2={x} y2={specs.boundaryHeightIn} stroke="#b8d5ff" strokeWidth={0.03} />
          ))}
          {gridLines.ys.map((y) => (
            <line key={`gy_${y}`} x1={0} y1={y} x2={specs.boundaryWidthIn} y2={y} stroke="#b8d5ff" strokeWidth={0.03} />
          ))}
        </g>

        {/* Polar guides */}
        {showPolar ? (
          <g>
            {polarRings.map((r) => {
              const t = minBoundaryR > 0 ? r / minBoundaryR : 0;
              return (
                <ellipse
                  key={`ring-${r}`}
                  cx={boundaryCx}
                  cy={boundaryCy}
                  rx={boundaryRx * t}
                  ry={boundaryRy * t}
                  fill="none"
                  stroke="#ddd"
                  strokeWidth={0.03}
                  strokeDasharray="0.3 0.3"
                  opacity={0.8}
                />
              );
            })}
            {polarAngles.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x = boundaryCx + boundaryRx * Math.cos(rad);
              const y = boundaryCy + boundaryRy * Math.sin(rad);
              return (
                <line
                  key={`ang-${deg}`}
                  x1={boundaryCx}
                  y1={boundaryCy}
                  x2={x}
                  y2={y}
                  stroke="#d0d0d0"
                  strokeWidth={0.03}
                  strokeDasharray="0.3 0.4"
                />
              );
            })}
          </g>
        ) : null}

        {/* Mask outside boundary (circle/oval) */}
        {specs.maskOutsideBoundary && boundaryShape !== "rect" ? (
          <>
            <defs>
              <mask id="boundary-mask">
                <rect x={0} y={0} width={specs.boundaryWidthIn} height={specs.boundaryHeightIn} fill="white" />
                <ellipse cx={boundaryCx} cy={boundaryCy} rx={boundaryRx} ry={boundaryRy} fill="black" />
              </mask>
            </defs>
            <rect
              x={0}
              y={0}
              width={specs.boundaryWidthIn}
              height={specs.boundaryHeightIn}
              fill="rgba(0,0,0,0.06)"
              mask="url(#boundary-mask)"
            />
          </>
        ) : null}

        {/* Boundary */}
        {boundaryShape === "rect" ? (
          <rect x={0} y={0} width={specs.boundaryWidthIn} height={specs.boundaryHeightIn} fill="none" stroke="#111" strokeWidth={0.08} />
        ) : (
          <ellipse
            cx={boundaryCx}
            cy={boundaryCy}
            rx={boundaryRx}
            ry={boundaryRy}
            fill="none"
            stroke="#111"
            strokeWidth={0.08}
          />
        )}

        {/* Measure overlay */}
        {measure ? (() => {
          const dx = measure.end.x - measure.start.x;
          const dy = measure.end.y - measure.start.y;
          const dist = Math.hypot(dx, dy);
          const midX = (measure.start.x + measure.end.x) / 2;
          const midY = (measure.start.y + measure.end.y) / 2;
          const label = `ΔX ${round(dx, 2)}"  ΔY ${round(dy, 2)}"  D ${round(dist, 2)}"`;
          return (
            <g>
              <line
                x1={measure.start.x}
                y1={measure.start.y}
                x2={measure.end.x}
                y2={measure.end.y}
                stroke="#ff8800"
                strokeWidth={0.08}
                strokeDasharray={measure.locked ? "0" : "0.25 0.25"}
              />
              <circle cx={measure.start.x} cy={measure.start.y} r={0.18} fill="#ff8800" />
              <circle cx={measure.end.x} cy={measure.end.y} r={0.18} fill="#ff8800" />
              <text x={midX + 0.3} y={midY - 0.3} fontSize={0.6} fill="#ff8800">
                {label}
              </text>
            </g>
          );
        })() : null}

        {/* Guides */}
        {props.showGuides ? (
          <g>
            {(props.guides ?? []).map((g) => {
              const isSelected = !!props.selectedGuideId && g.id === props.selectedGuideId;
              const stroke = isSelected ? "#ff6666" : "#00a3a3";
              const strokeWidth = isSelected ? 0.12 : 0.06;
              const hitWidth = 0.9;
              const locked = !!props.guidesLocked;
              const canDrag = !locked && props.mode === "move_anchor" && typeof props.onMoveGuide === "function";

              const x1 = g.orientation === "v" ? g.posIn : 0;
              const x2 = g.orientation === "v" ? g.posIn : specs.boundaryWidthIn;
              const y1 = g.orientation === "h" ? g.posIn : 0;
              const y2 = g.orientation === "h" ? g.posIn : specs.boundaryHeightIn;

              return (
                <g key={g.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={strokeWidth} opacity={0.9} />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={hitWidth}
                    style={{ cursor: canDrag ? "grab" : "pointer" }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      props.onSelectGuide?.(g.id);
                      if (!canDrag) return;

                      const svg = svgRef.current;
                      if (!svg) return;
                      (ev.target as Element).setPointerCapture(ev.pointerId);

                      const onMove = (mev: PointerEvent) => {
                        const p = clientToSvgCoords(svg, mev.clientX, mev.clientY);
                        const next = g.orientation === "v" ? p.x : p.y;
                        props.onMoveGuide?.(g.id, next);
                      };

                      const onUp = () => {
                        try {
                          (ev.target as Element).releasePointerCapture(ev.pointerId);
                        } catch (_) {}
                        window.removeEventListener("pointermove", onMove);
                        window.removeEventListener("pointerup", onUp);
                      };

                      window.addEventListener("pointermove", onMove);
                      window.addEventListener("pointerup", onUp);
                    }}
                  />
                  <text
                    x={g.orientation === "v" ? g.posIn + 0.15 : 0.15}
                    y={g.orientation === "v" ? 0.8 : g.posIn - 0.15}
                    fontSize={0.55}
                    fill={stroke}
                    opacity={0.85}
                  >
                    {g.orientation === "v" ? `X ${round(g.posIn, 2)}"` : `Y ${round(g.posIn, 2)}"`}
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}

        {/* Rubber-band preview for pending swoop start */}
        {props.pendingSwoopStartHoleId && props.planCursor ? (() => {
          const start = props.anchors.find((x) => x.id === props.pendingSwoopStartHoleId);
          if (!start || !props.planCursor) return null;
          return <line x1={start.xIn} y1={start.yIn} x2={props.planCursor.xIn} y2={props.planCursor.yIn} stroke="#ff6600" strokeWidth={0.06} strokeDasharray="4 2" />;
        })() : null}

        {/* Swoops */}
        <g>
          {(props.swoops || []).map((s, idx) => {
            const a = props.anchors.find((x) => x.id === s.aHoleId);
            const b = props.anchors.find((x) => x.id === s.bHoleId);
            if (!a || !b) return null;
            const midX = (a.xIn + b.xIn) / 2;
            const midY = (a.yIn + b.yIn) / 2;
            return (
              <g key={s.id}>
                <line x1={a.xIn} y1={a.yIn} x2={b.xIn} y2={b.yIn} stroke="#333" strokeWidth={0.04} />
                <text
                  x={midX}
                  y={midY - 0.2}
                  fontSize={0.6}
                  fill="#111"
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(ev) => { ev.stopPropagation(); if (props.onSelectSwoop) props.onSelectSwoop(s.id); }}
                >
                  {`S${idx + 1}`}
                </text>
              </g>
            );
          })}
        </g>

        {/* Clusters (plan-only layout + chain angle) */}
        <g>
          {(props.clusters || []).map((c) => {
            const anchor = props.anchors.find((a) => a.id === c.anchorId);
            if (!anchor) return null;
            const items = computeClusterLayout(c.spec);
            const r = Math.max(0.08, c.spec.itemRadiusIn || 0.1);
            return (
              <g key={c.id}>
                {items.map((it, idx) => {
                  const offX = c.spec.strands?.[idx]?.offsetXIn ?? 0;
                  const offY = c.spec.strands?.[idx]?.offsetYIn ?? 0;
                  const x = anchor.xIn + it.xIn + offX;
                  const y = anchor.yIn + it.yIn + offY;
                  return (
                    <g key={`${c.id}-${idx}`}>
                      <line x1={anchor.xIn} y1={anchor.yIn} x2={x} y2={y} stroke="#0077cc" strokeWidth={0.05} />
                      <circle cx={x} cy={y} r={r} fill="none" stroke="#0077cc" strokeWidth={0.08} />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>

        {/* Piles (floor sphere piles) */}
        <g>
          {(props.piles || []).map((p) => {
            const isSelected = p.id === props.selectedPileId;
            const stroke = isSelected ? "#ff6666" : "#555";
            const strokeWidth = isSelected ? 0.14 : 0.08;
            const r = Math.max(0.6, p.spec?.radiusIn ?? 0);
            return (
              <g
                key={p.id}
                style={{ cursor: "pointer" }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (props.mode === "measure") {
                    setMeasurePoint(p.xIn, p.yIn);
                    return;
                  }
                  if (props.onSelectPile) props.onSelectPile(p.id);

                  if (props.mode === "move_anchor") {
                    const svg = svgRef.current;
                    if (!svg || !props.onMovePile) return;
                    (ev.target as Element).setPointerCapture(ev.pointerId);

                    const onMove = (mev: PointerEvent) => {
                      const pt = clientToSvgCoords(svg, mev.clientX, mev.clientY);
                      props.onMovePile!(p.id, pt.x, pt.y);
                    };

                    const onUp = () => {
                      try { (ev.target as Element).releasePointerCapture(ev.pointerId); } catch (_) {}
                      window.removeEventListener("pointermove", onMove);
                      window.removeEventListener("pointerup", onUp);
                    };

                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  }
                }}
              >
                <circle cx={p.xIn} cy={p.yIn} r={r} fill="none" stroke={stroke} strokeWidth={0.06} strokeDasharray="0.35 0.35" opacity={0.6} />
                <circle cx={p.xIn} cy={p.yIn} r={0.25} fill="#fff" stroke={stroke} strokeWidth={strokeWidth} />
                {props.showLabels ? (
                  <text x={p.xIn + 0.35} y={p.yIn + 0.55} fontSize={0.6} fill="#111">
                    {`Pile`}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        {/* Anchors */}
        <g>
          {props.anchors.map((a) => {
            const isFastener = a.holeType === "fastener" || a.type === "canopy_fastener";
            const dia = isFastener ? specs.fastenerHoleDiameterIn : specs.strandHoleDiameterIn;
            const r = Math.max(0.08, dia / 2);
            const isSelected = a.id === props.selectedAnchorId;
            const stroke = isSelected ? "#ff6666" : "#111";
            const strokeWidth = isSelected ? 0.14 : 0.08;
            // Visual: fastener holes rendered hollow (no fill), strand holes solid filled
            const fill = isFastener ? "none" : "#111";
            return (
              <g key={a.id}>
                <circle
                  cx={a.xIn}
                  cy={a.yIn}
                  r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    if (props.mode === "measure") {
                      setMeasurePoint(a.xIn, a.yIn);
                      return;
                    }
                    props.onSelectAnchor(a.id);
                    if (props.mode === "copy_anchor" && props.onBeginCopyAnchor) {
                      props.onBeginCopyAnchor(a.id);
                      return;
                    }
                    if (props.mode === "place_swoop" && typeof props.onSwoopAnchorClick === "function") {
                      if (isFastener) {
                        alert("Cannot use a fastener hole for a swoop. Choose a strand hole instead.");
                        return;
                      }
                      props.onSwoopAnchorClick(a.id);
                    }

                    // If in move mode, start dragging this anchor
                    if (props.mode === "move_anchor") {
                      const svg = svgRef.current;
                      if (!svg) return;
                      (ev.target as Element).setPointerCapture(ev.pointerId);

                      const onMove = (mev: PointerEvent) => {
                        const p = clientToSvgCoords(svg, mev.clientX, mev.clientY);
                        props.onMoveAnchor(a.id, p.x, p.y, !mev.altKey);
                      };

                      const onUp = () => {
                        try { (ev.target as Element).releasePointerCapture(ev.pointerId); } catch (_) {}
                        window.removeEventListener("pointermove", onMove);
                        window.removeEventListener("pointerup", onUp);
                      };

                      window.addEventListener("pointermove", onMove);
                      window.addEventListener("pointerup", onUp);
                    }
                  }}
                />
                {props.showLabels ? (
                  <text x={a.xIn + 0.25} y={a.yIn - 0.25} fontSize={0.6} fill="#111">
                    {anchorLabel(a, specs, ox, oy)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
        <div
          className="resizeHandle"
          role="separator"
          aria-label="Resize plan height"
          title="Drag to resize plan height"
          onPointerDown={(ev) => {
            ev.preventDefault();
            const root = document.documentElement;
            const canvasTop = (ev.currentTarget as HTMLElement).closest('.canvasStack')?.getBoundingClientRect().top || 0;
            const min = 120;
            const max = 1200;

            const onMove = (mev: PointerEvent) => {
              const y = mev.clientY;
              const newH = Math.max(min, Math.min(max, y - canvasTop));
              root.style.setProperty("--planH", `${newH}px`);
            };

            const onUp = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            (ev.target as Element).setPointerCapture(ev.pointerId);
          }}
        />

        {/* single plan resize handle (between Plan and Front) is above; Front handle lives inside FrontPreviewPanel */}
      </div>
    </PanelFrame>
  );
}
