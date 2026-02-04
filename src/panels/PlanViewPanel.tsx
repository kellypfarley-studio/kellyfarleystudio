import { useMemo, useRef } from "react";
import type { Anchor, Cluster, ProjectSpecs, ToolMode, ViewTransform } from "../types/appTypes";
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
  clusters?: Cluster[];
  selectedAnchorId: string | null;

  onPlaceStrand: (xIn: number, yIn: number) => void;
  onPlaceStack: (xIn: number, yIn: number) => void;
  onPlaceCluster: (xIn: number, yIn: number) => void;
  onPlaceCustomStrand: (xIn: number, yIn: number) => void;
  onPlaceCanopyFastener: (xIn: number, yIn: number) => void;
  onEnsureStrandHoleAt?: (xIn: number, yIn: number) => string | undefined;
  onSelectSwoop?: (swoopId: string) => void;
  swoops?: import("../types/appTypes").Swoop[];
  pendingSwoopStartHoleId?: string | null;
  planCursor?: import("../types/appTypes").CursorState | null;

  onSelectAnchor: (anchorId: string) => void;
  onSwoopAnchorClick?: (anchorId: string) => void;
  onClearSelection: () => void;
  onMoveAnchor: (anchorId: string, xIn: number, yIn: number, snap?: boolean) => void;

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

  const gridLines = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const g = specs.gridSpacingIn;
    if (!Number.isFinite(g) || g <= 0) return { xs, ys };
    for (let x = ox; x <= specs.boundaryWidthIn + 1e-6; x += g) xs.push(round(x, 3));
    for (let y = oy; y <= specs.boundaryHeightIn + 1e-6; y += g) ys.push(round(y, 3));
    return { xs, ys };
  }, [ox, oy, specs.boundaryHeightIn, specs.boundaryWidthIn, specs.gridSpacingIn]);

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

  // helper to compute fit bounds for plan view (exported)
  return (
    <PanelFrame
      title="Plan View"
      headerHint={
        <span className="muted">
          Boundary: {specs.boundaryWidthIn}" × {specs.boundaryHeightIn}"  •  Grid {specs.gridSpacingIn}"  •  Holes {specs.strandHoleDiameterIn}"/{specs.fastenerHoleDiameterIn}"
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
            const inside = p.x >= 0 && p.x <= specs.boundaryWidthIn && p.y >= 0 && p.y <= specs.boundaryHeightIn;
            props.onCursorMove(p.x, p.y, inside);
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

            if (props.mode === "place_strand") {
              props.onPlaceStrand(p.x, p.y);
              return;
            }
            if (props.mode === "place_stack") {
              props.onPlaceStack(p.x, p.y);
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
              if (!props.selectedAnchorId) return;
                props.onMoveAnchor(props.selectedAnchorId, p.x, p.y);
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

        {/* Boundary */}
        <rect x={0} y={0} width={specs.boundaryWidthIn} height={specs.boundaryHeightIn} fill="none" stroke="#111" strokeWidth={0.08} />

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
                    props.onSelectAnchor(a.id);
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
                        props.onMoveAnchor(a.id, p.x, p.y);
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
