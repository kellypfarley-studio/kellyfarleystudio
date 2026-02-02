import { useMemo, useRef } from "react";
import type { Anchor, DepthLayer, PaletteColor, ProjectSpecs, Strand, ViewTransform, Swoop } from "../types/appTypes";
import type { Ref } from "react";
import PanelFrame from "../components/PanelFrame";
import ViewControls from "../components/ViewControls";
import { computeStrandPreview, SPHERE_PITCH_IN, SPHERE_RADIUS_IN, SPHERE_DIAMETER_IN, SPHERE_GAP_IN } from "../utils/previewGeometry";
import { renderChainAlongPolyline, renderClaspBetweenPoints } from "../utils/proceduralChain";
import { solveCatenaryByLength, pointAtArcLength } from "../utils/catenary";
import { projectPreview, computeYShift } from "../utils/rotationProjection";

export function computePreviewFitBounds(specs: ProjectSpecs, strands: Strand[], anchors: Anchor[], swoops: Swoop[] = []) {
  const previews = strands.map((s) => {
    const a = anchors.find((x) => x.id === s.anchorId) ?? null;
    const pv = computeStrandPreview(specs, s.spec);
    return { strand: s, anchor: a, pv };
  });

  const r = SPHERE_RADIUS_IN;
  const padX = r + 2;
  const padTop = 2;
  const padBottom = 12;

  let maxDrop = specs.ceilingHeightIn;
  for (const p of previews) {
    maxDrop = Math.max(maxDrop, p.pv.totalDropIn);
  }

  // consider swoops: compute deepest relaxed point (plus sphere radius)
  const pvView = specs.previewView ?? { rotationDeg: 0, rotationStrength: 1 };
  for (const s of swoops) {
    const a = anchors.find((x) => x.id === s.aHoleId) ?? null;
    const b = anchors.find((x) => x.id === s.bHoleId) ?? null;
    if (!a || !b) {
      const ctrlY = (s.spec.chainAIn + s.spec.chainBIn) / 2 + s.spec.sagIn;
      maxDrop = Math.max(maxDrop, ctrlY);
      continue;
    }

    const pa = projectPreview(specs, a, pvView.rotationDeg, pvView.rotationStrength);
    const pb = projectPreview(specs, b, pvView.rotationDeg, pvView.rotationStrength);
    const xA = pa.xIn;
    const xB = pb.xIn;
    const yA = Math.max(0, s.spec.chainAIn || 0);
    const yB = Math.max(0, s.spec.chainBIn || 0);

    const sphereR = SPHERE_RADIUS_IN;
    const sphereCount = Math.max(0, Math.floor(s.spec.sphereCount || 0));
    const baseLen = sphereCount <= 1 ? 0 : (sphereCount - 1) * SPHERE_PITCH_IN;
    const breathingRoom = 2 * sphereR;
    const slackIn = Math.max(0, s.spec.sagIn || 0);
    const desiredTotalLen = baseLen + breathingRoom + slackIn;

    const chord = Math.hypot(xB - xA, yB - yA);
    const totalLen = Math.max(chord, desiredTotalLen);
    const nSegments = Math.max(1, Math.ceil(totalLen / SPHERE_PITCH_IN));
    const pointCount = nSegments + 1;

    try {
      const hanging = buildHangingPolyline({ x: xA, y: yA }, { x: xB, y: yB }, totalLen, pointCount, 60);
      const deepest = hanging.pts.reduce((m, p) => Math.max(m, p.y), -Infinity);
      if (isFinite(deepest)) maxDrop = Math.max(maxDrop, deepest + sphereR);
    } catch (e) {
      const ctrlY = (s.spec.chainAIn + s.spec.chainBIn) / 2 + s.spec.sagIn;
      maxDrop = Math.max(maxDrop, ctrlY);
    }
  }

  const minX = -padX;
  const maxX = specs.boundaryWidthIn + padX;
  const minY = -padTop;
  const maxY = maxDrop + padBottom;
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

export type FrontPreviewPanelProps = {
  specs: ProjectSpecs;
  view: ViewTransform;
  onViewChange: (next: ViewTransform) => void;
  svgRef?: Ref<SVGSVGElement>;

  anchors: Anchor[];
  strands: Strand[];
  swoops?: Swoop[];
  palette: PaletteColor[];
  selectedAnchorId: string | null;
  panEnabled?: boolean;
  onTogglePan?: () => void;
  previewView?: ProjectSpecs["previewView"];
  onPreviewDepthPatch?: (patch: Partial<ProjectSpecs["previewDepth"]>) => void;
  onPreviewViewPatch?: (patch: Partial<ProjectSpecs["previewView"]>) => void;
};

function clientToSvgCoords(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM?.();
  if (!ctm) return { x: 0, y: 0 };
  const svgP = pt.matrixTransform(ctm.inverse());
  return { x: svgP.x, y: svgP.y };
}

function colorHex(palette: PaletteColor[], id: string): string {
  return palette.find((c) => c.id === id)?.hex ?? "#111";
}

function layerOpacity(layer: string): number {
  if (layer === "front") return 1.0;
  if (layer === "mid") return 0.7;
  return 0.45;
}

type Pt = { x: number; y: number };

function buildHangingPolyline(
  p0: Pt,
  p1: Pt,
  totalLength: number,
  pointCount: number,
  iterations: number = 90,
): { pts: Pt[]; cum: number[] } {
  const n = Math.max(2, Math.floor(pointCount));
  const L = Math.max(0, totalLength);
  const segLen = n > 1 ? L / (n - 1) : 0;

  // Seed points on a gently sagging curve so the relaxation converges quickly.
  const pts: Pt[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t + Math.sin(Math.PI * t) * 0.25 * segLen;
    pts[i] = { x, y };
  }
  // Pin endpoints
  pts[0].x = p0.x;
  pts[0].y = p0.y;
  pts[n - 1].x = p1.x;
  pts[n - 1].y = p1.y;

  if (segLen > 0) {
    const g = 0.35; // visual gravity; larger = more sag for the same slack
    const constraintPasses = 6;
    for (let iter = 0; iter < iterations; iter += 1) {
      // Apply gravity to internal points
      for (let i = 1; i < n - 1; i += 1) {
        pts[i].y += g;
      }

      // Satisfy distance constraints
      for (let pass = 0; pass < constraintPasses; pass += 1) {
        for (let i = 0; i < n - 1; i += 1) {
          const p = pts[i];
          const q = pts[i + 1];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dist = Math.hypot(dx, dy) || 1e-9;
          const diff = (dist - segLen) / dist;

          // Split correction between the two points unless it's an endpoint.
          const wP = i === 0 ? 0 : 0.5;
          const wQ = i + 1 === n - 1 ? 0 : 0.5;
          const wSum = wP + wQ;
          if (wSum <= 0) continue;

          const corrX = dx * diff;
          const corrY = dy * diff;
          if (wP > 0) {
            p.x += corrX * (wP / wSum);
            p.y += corrY * (wP / wSum);
          }
          if (wQ > 0) {
            q.x -= corrX * (wQ / wSum);
            q.y -= corrY * (wQ / wSum);
          }
        }

        // Re-pin endpoints each pass
        pts[0].x = p0.x;
        pts[0].y = p0.y;
        pts[n - 1].x = p1.x;
        pts[n - 1].y = p1.y;
      }
    }
  }

  // Cumulative arc-length table for sampling
  const cum: number[] = new Array(n);
  cum[0] = 0;
  for (let i = 1; i < n; i += 1) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cum[i] = cum[i - 1] + Math.hypot(dx, dy);
  }
  return { pts, cum };
}

// Sample a polyline by arc-length `s` (in the same units as pts/cum).
function samplePolylineAtLength(pts: Pt[], cum: number[], s: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return { ...pts[0] };
  const total = cum[cum.length - 1] ?? 0;
  const target = Math.max(0, Math.min(total, s));
  // Linear scan is fine here (small point count)
  let i = 1;
  while (i < cum.length && cum[i] < target) i += 1;
  if (i >= cum.length) return { ...pts[pts.length - 1] };
  const s0 = cum[i - 1];
  const s1 = cum[i];
  const t = s1 - s0 <= 1e-9 ? 0 : (target - s0) / (s1 - s0);
  return {
    x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
    y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
  };
}

// Discrete rope relaxation solver — relaxes a polyline to approximate a hanging rope.
function solveHangingRope(points: Pt[], segLen: number, iterations = 40, gravity = 0.15) {
  const n = points.length;
  if (n <= 2) return points.map(p => ({ ...p }));

  const pts = points.map(p => ({ ...p }));
  const p0 = { ...pts[0] };
  const pN = { ...pts[n - 1] };

  for (let it = 0; it < iterations; it++) {
    // gravity on interior nodes (y increases downward in this app)
    for (let i = 1; i < n - 1; i++) pts[i].y += gravity;

    // enforce segment lengths a few passes per iteration
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const diff = (d - segLen) / d;

        const wA = i === 0 ? 0 : 0.5;
        const wB = i + 1 === n - 1 ? 0 : 0.5;

        a.x += dx * diff * wA;
        a.y += dy * diff * wA;
        b.x -= dx * diff * wB;
        b.y -= dy * diff * wB;
      }

      // re-pin endpoints
      pts[0].x = p0.x; pts[0].y = p0.y;
      pts[n - 1].x = pN.x; pts[n - 1].y = pN.y;
    }
  }

  return pts;
}

export default function FrontPreviewPanel(props: FrontPreviewPanelProps) {
  const { specs, view } = props;
  const { svgRef: svgRefProp } = props as any;
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

  const panRef = useRef<{ active: boolean; start: { x: number; y: number }; initPan: { x: number; y: number } }>({ active: false, start: { x: 0, y: 0 }, initPan: { x: 0, y: 0 } });

  const anchorById = useMemo(() => {
    const m = new Map<string, Anchor>();
    for (const a of props.anchors) m.set(a.id, a);
    return m;
  }, [props.anchors]);

  const layerByAnchorId = useMemo(() => {
    const m = new Map<string, DepthLayer>();
    for (const st of props.strands) m.set(st.anchorId, st.spec.layer as DepthLayer);
    return m;
  }, [props.strands]);

  const getLayerForAnchor = (anchorId: string): DepthLayer => layerByAnchorId.get(anchorId) ?? "mid";

  const previews = useMemo(() => {
    return props.strands.map((s) => {
      const a = anchorById.get(s.anchorId);
      const pv = computeStrandPreview(specs, s.spec);
      return { strand: s, anchor: a ?? null, pv };
    });
  }, [anchorById, props.strands, specs]);

  const swoopPreviews = useMemo(() => {
    return (props.swoops ?? []).map((sw) => {
      const a = anchorById.get(sw.aHoleId) ?? null;
      const b = anchorById.get(sw.bHoleId) ?? null;
      return { swoop: sw, a, b };
    });
  }, [anchorById, props.swoops]);

  const bounds = useMemo(() => {
    const r = SPHERE_RADIUS_IN;
    const padX = r + 2;
    const padTop = 2;
    const padBottom = 12;

    let maxDrop = specs.ceilingHeightIn;
    for (const p of previews) {
      maxDrop = Math.max(maxDrop, p.pv.totalDropIn);
    }
    for (const s of swoopPreviews) {
      if (!s.a || !s.b) {
        const ctrl = (s.swoop.spec.chainAIn + s.swoop.spec.chainBIn) / 2 + s.swoop.spec.sagIn;
        maxDrop = Math.max(maxDrop, ctrl);
        continue;
      }

      const pvView = specs.previewView ?? { rotationDeg: 0, rotationStrength: 1 };
      const pa = projectPreview(specs, s.a, pvView.rotationDeg, pvView.rotationStrength);
      const pb = projectPreview(specs, s.b, pvView.rotationDeg, pvView.rotationStrength);
      const xA = pa.xIn;
      const xB = pb.xIn;
      const yA = Math.max(0, s.swoop.spec.chainAIn || 0);
      const yB = Math.max(0, s.swoop.spec.chainBIn || 0);

      const sphereR = SPHERE_RADIUS_IN;
      const sphereCount = Math.max(0, Math.floor(s.swoop.spec.sphereCount || 0));
      const baseLen = sphereCount <= 1 ? 0 : (sphereCount - 1) * SPHERE_PITCH_IN;
      const breathingRoom = 2 * sphereR;
      const slackIn = Math.max(0, s.swoop.spec.sagIn || 0);
      const desiredTotalLen = baseLen + breathingRoom + slackIn;

      const chord = Math.hypot(xB - xA, yB - yA);
      const totalLen = Math.max(chord, desiredTotalLen);
      const nSegments = Math.max(1, Math.ceil(totalLen / SPHERE_PITCH_IN));
      const pointCount = nSegments + 1;

      try {
        const hanging = buildHangingPolyline({ x: xA, y: yA }, { x: xB, y: yB }, totalLen, pointCount, 60);
        const deepest = hanging.pts.reduce((m, p) => Math.max(m, p.y), -Infinity);
        if (isFinite(deepest)) maxDrop = Math.max(maxDrop, deepest + sphereR);
      } catch (e) {
        const ctrl = (s.swoop.spec.chainAIn + s.swoop.spec.chainBIn) / 2 + s.swoop.spec.sagIn;
        maxDrop = Math.max(maxDrop, ctrl);
      }
    }

    const minX = -padX;
    const maxX = specs.boundaryWidthIn + padX;
    const minY = -padTop;
    const maxY = maxDrop + padBottom;
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }, [previews, swoopPreviews, specs.boundaryWidthIn, specs.ceilingHeightIn]);

  // Camera
  const viewZoom = Math.max(0.0001, view.zoom);
  const viewW = bounds.w / viewZoom;
  const viewH = bounds.h / viewZoom;
  const centerX = (bounds.minX + bounds.maxX) / 2 + (view.panX || 0);
  const centerY = (bounds.minY + bounds.maxY) / 2 + (view.panY || 0);
  const vbX = centerX - viewW / 2;
  const vbY = centerY - viewH / 2;
  const vbW = viewW;
  const vbH = viewH;

  const left = (
    <ViewControls
      view={view}
      onChange={props.onViewChange}
      onFit={() => props.onViewChange({ zoom: 1, panX: 0, panY: 0 })}
      panEnabled={props.panEnabled}
      onTogglePan={props.onTogglePan}
    />
  );

  const centerControls = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="smallLabel">Perspective</span>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={props.specs.previewDepth?.perspectiveFactor ?? 0}
          onChange={(e) => props.onPreviewDepthPatch?.({ perspectiveFactor: Number(e.target.value) })}
          style={{ width: 120 }}
        />
        <input
          type="number"
          value={props.specs.previewDepth?.perspectiveFactor ?? 0}
          step={0.05}
          onChange={(e) => props.onPreviewDepthPatch?.({ perspectiveFactor: Number(e.target.value) })}
          style={{ width: 56 }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="smallLabel">Detail</span>
          <select
            value={props.previewView?.detail ?? specs.previewView?.detail ?? "simple"}
            onChange={(e) => props.onPreviewViewPatch?.({ detail: e.target.value as any })}
          >
            <option value="simple">Simple</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      </div>

      <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="smallLabel">Preview</span>
        <input
          type="range"
          min={0}
          max={360}
          step={5}
          value={props.previewView?.rotationDeg ?? 0}
          onChange={(e) => props.onPreviewViewPatch?.({ rotationDeg: Number(e.target.value) })}
          style={{ width: 140 }}
        />
        <input
          type="number"
          value={props.previewView?.rotationDeg ?? 0}
          onChange={(e) => props.onPreviewViewPatch?.({ rotationDeg: Number(e.target.value) })}
          style={{ width: 56 }}
        />
        <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
          <button className="btn" onClick={() => props.onPreviewViewPatch?.({ rotationDeg: 0 })}>Front</button>
          <button className="btn" onClick={() => props.onPreviewViewPatch?.({ rotationDeg: 180 })}>Back</button>
        </div>
      </div>
    </div>
  );

  return (
    <PanelFrame
      title="Preview"
      headerHint={<span className="muted">Read-only preview (generated from Plan View)</span>}
      left={left}
      center={centerControls}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <svg
          ref={setSvgRef}
          width="100%"
          height="100%"
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: "#fff", touchAction: "none", cursor: props.panEnabled ? "grab" : undefined }}
          onPointerDown={(ev) => {
            if (!props.panEnabled) return;
            ev.preventDefault();
            const svg = svgRef.current;
            if (!svg) return;
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
              try {
                if (svg) svg.style.cursor = props.panEnabled ? "grab" : "default";
              } catch (_) {}
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            (ev.target as Element).setPointerCapture(ev.pointerId);
            try {
              svg.style.cursor = "grabbing";
            } catch (_) {}
          }}
        >
          {/* Ceiling and floor */}
          <line x1={0} y1={0} x2={specs.boundaryWidthIn} y2={0} stroke="#111" strokeWidth={0.08} />
          <line x1={0} y1={specs.ceilingHeightIn} x2={specs.boundaryWidthIn} y2={specs.ceilingHeightIn} stroke="#111" strokeWidth={0.08} />

          {/* Combined drawables: strands + swoop segments + swoop spheres */}
          {(() => {
            type Drawable = { key: string; depth: number; jsx: JSX.Element };
            const drawables: Drawable[] = [];

            const pvView = props.previewView ?? specs.previewView ?? { rotationDeg: 0, rotationStrength: 1, detail: "simple" };
            const layerDepthOffset = (layer: DepthLayer) => {
              const spread = specs.previewDepth?.layerSpreadIn ?? 0;
              return layer === "front" ? -spread : layer === "back" ? spread : 0;
            };

            // 1) strand drawables
            for (const p of previews) {
              if (!p.anchor) continue;
              const proj = projectPreview(specs, p.anchor, pvView.rotationDeg, pvView.rotationStrength);
              const layer = p.strand?.spec.layer ?? "mid";
              const depthEff = proj.depthKey + layerDepthOffset(layer as DepthLayer);
              const sx = proj.xIn;
              const perspective = specs.previewDepth?.perspectiveFactor ?? 0;
              const yShift = computeYShift(specs, depthEff, perspective);
              const isSelected = p.anchor.id === props.selectedAnchorId;
              const col = colorHex(props.palette, p.strand?.spec.colorId ?? "");
              const op = layerOpacity(p.strand?.spec.layer ?? "mid");
              const sphereR = SPHERE_RADIUS_IN;

              const claspEls: JSX.Element[] = [];
              for (let i = 0; i < p.pv.sphereCentersY.length - 1; i++) {
                const yTop = p.pv.sphereCentersY[i] - yShift;
                const yBot = p.pv.sphereCentersY[i + 1] - yShift;
                claspEls.push(...renderClaspBetweenPoints({
                  key: `clasp-${p.strand?.id}-${i}`,
                  xTop: sx,
                  yTop,
                  xBot: sx,
                  yBot,
                  strokeColor: isSelected ? "#ff6666" : "#111",
                  strokeIn: 0.1875,
                  chainHeightIn: 1.0,
                  chainWidthIn: 0.55,
                  eyeDiaIn: 0.75,
                  gapIn: 2.5,
                }));
              }

              const sphereEls: JSX.Element[] = p.pv.sphereCentersY.map((cy, idx) => (
                <circle key={`strand-${p.strand?.id}-sp-${idx}`} cx={sx} cy={cy - yShift} r={sphereR} fill={col} stroke={isSelected ? "#ff6666" : "#111"} strokeWidth={isSelected ? 0.18 : 0.1} />
              ));

              // procedural chain rendering for top and bottom segments
              const topYStart = 0 - yShift;
              const topYEnd = p.pv.sphereCentersY.length ? p.pv.sphereCentersY[0] - yShift : specs.ceilingHeightIn - yShift;
              const topChainEls = renderChainAlongPolyline({
                keyPrefix: `strand-${p.strand?.id}-topchain`,
                points: [{ x: sx, y: topYStart }, { x: sx, y: topYEnd }],
                linkHeightIn: 1,
                strokeIn: isSelected ? 0.18 : 0.1,
                linkWidthIn: 0.55,
                startPhase: 0,
                strokeColor: isSelected ? "#ff6666" : "#111",
              });

              const bottomYStart = p.pv.sphereCentersY.length ? p.pv.sphereCentersY[p.pv.sphereCentersY.length - 1] - yShift : 0 - yShift;
              const bottomYEnd = specs.ceilingHeightIn - yShift;
              const bottomChainEls = renderChainAlongPolyline({
                keyPrefix: `strand-${p.strand?.id}-botchain`,
                points: [{ x: sx, y: bottomYStart }, { x: sx, y: bottomYEnd }],
                linkHeightIn: 1,
                strokeIn: isSelected ? 0.18 : 0.1,
                linkWidthIn: 0.55,
                startPhase: 1,
                strokeColor: isSelected ? "#ff6666" : "#111",
              });

              const jsx = (
                <g key={`strand-${p.strand?.id}`} opacity={op}>
                  {topChainEls}
                  {claspEls}
                  {sphereEls}
                  {bottomChainEls}
                  {p.strand?.spec.moundPreset !== "none" ? (
                    <path
                      d={`M ${sx - 2} ${specs.ceilingHeightIn + 2} C ${sx - 1} ${specs.ceilingHeightIn + 0.5}, ${sx + 1} ${specs.ceilingHeightIn + 3.0}, ${sx + 2} ${
                        specs.ceilingHeightIn + 2
                      } C ${sx + 1} ${specs.ceilingHeightIn + 4.0}, ${sx - 1} ${specs.ceilingHeightIn + 4.0}, ${sx - 2} ${
                        specs.ceilingHeightIn + 2
                      } Z`}
                      fill="#111"
                      opacity={0.9}
                    />
                  ) : null}
                  {p.pv.overCeiling ? (
                    <text x={sx + 1.0} y={specs.ceilingHeightIn - 1.0} fontSize={2.5} fill="#ff6666">
                      !
                    </text>
                  ) : null}
                </g>
              );

              drawables.push({ key: `strand-${p.strand?.id}`, depth: depthEff, jsx });
            }

            // 2) swoop segment + sphere drawables
            for (const sp of swoopPreviews) {
              if (!sp.a || !sp.b) continue;
              const pa = projectPreview(specs, sp.a, pvView.rotationDeg, pvView.rotationStrength);
              const pb = projectPreview(specs, sp.b, pvView.rotationDeg, pvView.rotationStrength);
              const xA = pa.xIn;
              const xB = pb.xIn;

              const perspective = specs.previewDepth?.perspectiveFactor ?? 0;
              const layerA = getLayerForAnchor(sp.swoop.aHoleId);
              const layerB = getLayerForAnchor(sp.swoop.bHoleId);
              const depthA = pa.depthKey + layerDepthOffset(layerA);
              const depthB = pb.depthKey + layerDepthOffset(layerB);

              const col = colorHex(props.palette, sp.swoop.spec.colorId ?? "");
              const chainColor = (col || "").toLowerCase() === "#ffffff" ? "#111" : col;
              const sphereR = SPHERE_RADIUS_IN;
              const sphereCount = Math.max(0, Math.floor(sp.swoop.spec.sphereCount || 0));

              const dx = xB - xA;
              const dir = dx >= 0 ? 1 : -1;
              const span = Math.abs(dx);

              const sphereD = specs.materials?.sphereDiameterIn ?? SPHERE_DIAMETER_IN;
              const gap = SPHERE_GAP_IN;
              const pitchReal = sphereD + gap;
              const yAcenter = Math.max(0, sp.swoop.spec.chainAIn || 0) + sphereR;
              const yBcenter = Math.max(0, sp.swoop.spec.chainBIn || 0) + sphereR;
              const chainLen = Math.max(0, (sphereCount - 1) * pitchReal);

              // sample path points (world coords) into sampledPts
              let sampledPts: { x: number; y: number }[] = [];
              let Lc = 0;
              const samples = Math.max(60, Math.min(240, sphereCount * 20));

              if (chainLen > 0) {
                if (span < 1e-3) {
                  const localStraight: { x: number; y: number }[] = [{ x: 0, y: yAcenter }, { x: 0, y: yBcenter }];
                  const scum: number[] = [0, Math.hypot(0, yBcenter - yAcenter)];
                  for (let i = 0; i <= samples; i++) {
                    const s = (scum[1] * i) / samples;
                    const lp = samplePolylineAtLength(localStraight as any, scum, s);
                    sampledPts.push({ x: xA, y: lp.y });
                  }
                  Lc = scum[1];
                } else {
                  const yAUp = -yAcenter;
                  const yBUp = -yBcenter;
                  const cat = solveCatenaryByLength(0, yAUp, span, yBUp, chainLen);
                  if (cat) {
                    for (let i = 0; i <= samples; i++) {
                      const sLen = (cat.length * i) / samples;
                      const pUp = pointAtArcLength(cat, sLen);
                      const xWorld = xA + dir * pUp.x;
                      sampledPts.push({ x: xWorld, y: -pUp.y });
                    }
                    Lc = cat.length;
                  } else {
                    const localStraight: { x: number; y: number }[] = [{ x: 0, y: yAcenter }, { x: span, y: yBcenter }];
                    const scum: number[] = [0, Math.hypot(span, yBcenter - yAcenter)];
                    for (let i = 0; i <= samples; i++) {
                      const s = (scum[1] * i) / samples;
                      const lp = samplePolylineAtLength(localStraight as any, scum, s);
                      const xWorld = xA + dir * lp.x;
                      sampledPts.push({ x: xWorld, y: lp.y });
                    }
                    Lc = scum[1];
                  }
                }
              } else {
                const midX = 0.5 * (xA + xB);
                const midY = 0.5 * (yAcenter + yBcenter);
                for (let i = 0; i <= samples; i++) sampledPts.push({ x: midX, y: midY });
                Lc = 0;
              }

              // build cumulative length for sampledPts
              const cumSamples: number[] = new Array(sampledPts.length);
              if (sampledPts.length > 0) {
                cumSamples[0] = 0;
                for (let i = 1; i < sampledPts.length; i++) {
                  const dxs = sampledPts[i].x - sampledPts[i - 1].x;
                  const dys = sampledPts[i].y - sampledPts[i - 1].y;
                  cumSamples[i] = cumSamples[i - 1] + Math.hypot(dxs, dys);
                }
              }
              const totalSampleLen = cumSamples.length ? cumSamples[cumSamples.length - 1] : 0;

              // (removed) swoop path segments: we render only spheres and clasps now

              // place spheres by arc-length, produce sphere drawables and clasps
              if (sphereCount > 0) {
                const baseLenPlacement = (sphereCount - 1) * pitchReal;
                const freeSlack = Math.max(0, totalSampleLen - baseLenPlacement);
                const startS = freeSlack / 2;
                const spherePositions: { x: number; y: number; t: number; depth: number }[] = [];
                for (let i = 0; i < sphereCount; i++) {
                  const sLen = startS + i * pitchReal;
                  const sClamped = Math.max(0, Math.min(totalSampleLen, sLen));
                  const p = samplePolylineAtLength(sampledPts as any, cumSamples, sClamped);
                  const xLocal = dir >= 0 ? p.x - xA : xA - p.x;
                  const t = span > 1e-6 ? xLocal / span : (totalSampleLen > 0 ? sClamped / totalSampleLen : 0);
                  const depth = depthA + (depthB - depthA) * t;
                  const y = p.y - computeYShift(specs, depth, perspective);
                  spherePositions.push({ x: p.x, y: p.y, t, depth });
                  const circ = <circle key={`sw-${sp.swoop.id}-sp-${i}`} cx={p.x} cy={y} r={sphereR} fill={col} stroke="#111" strokeWidth={0.08} />;
                  drawables.push({ key: `sw-${sp.swoop.id}-sp-${i}`, depth, jsx: circ });
                }

                // clasps between spheres
                for (let i = 0; i < spherePositions.length - 1; i++) {
                  const a = spherePositions[i];
                  const b = spherePositions[i + 1];
                  const yTop = a.y;
                  const yBot = b.y;
                  const depthMid = 0.5 * (a.depth + b.depth);
                  const claspJsx = <g key={`clasp-swoop-${sp.swoop.id}-${i}`}>{renderClaspBetweenPoints({
                    key: `clasp-swoop-${sp.swoop.id}-${i}`,
                    xTop: a.x,
                    yTop,
                    xBot: b.x,
                    yBot,
                    strokeColor: chainColor,
                    strokeIn: 0.1875,
                    chainHeightIn: 1.0,
                    chainWidthIn: 0.55,
                    eyeDiaIn: 0.75,
                    gapIn: 2.5,
                  })}</g>;
                  drawables.push({ key: `clasp-swoop-${sp.swoop.id}-${i}`, depth: depthMid, jsx: claspJsx });
                }

                // chains from topmost/bottommost sphere to ceiling (anchor)
                if (spherePositions.length > 0) {
                  const top = spherePositions[0];
                  const bottom = spherePositions[spherePositions.length - 1];
                  const ceilYA = 0 - computeYShift(specs, depthA, perspective);
                  const ceilYB = 0 - computeYShift(specs, depthB, perspective);

                  // connect from ceiling anchor to sphere surface (offset by sphere radius)
                  const dxTop = top.x - xA;
                  const dyTop = top.y - ceilYA;
                  const distTop = Math.hypot(dxTop, dyTop) || 1e-9;
                  const uxTop = dxTop / distTop;
                  const uyTop = dyTop / distTop;
                  const topEndX = top.x - uxTop * sphereR;
                  const topEndY = top.y - uyTop * sphereR;
                  const topChainEls = renderChainAlongPolyline({
                    keyPrefix: `swoop-${sp.swoop.id}-topchainA`,
                    points: [{ x: xA, y: ceilYA }, { x: topEndX, y: topEndY }],
                    linkHeightIn: 1,
                    strokeIn: 0.12,
                    linkWidthIn: 0.55,
                    startPhase: 0,
                    strokeColor: chainColor,
                  });
                  const depthTopMid = 0.5 * (depthA + top.depth);
                  for (let i = 0; i < topChainEls.length; i++) drawables.push({ key: `swoop-${sp.swoop.id}-topchainA-${i}`, depth: depthTopMid, jsx: topChainEls[i] });

                  const dxBot = bottom.x - xB;
                  const dyBot = bottom.y - ceilYB;
                  const distBot = Math.hypot(dxBot, dyBot) || 1e-9;
                  const uxBot = dxBot / distBot;
                  const uyBot = dyBot / distBot;
                  const botEndX = bottom.x - uxBot * sphereR;
                  const botEndY = bottom.y - uyBot * sphereR;
                  const topChainElsB = renderChainAlongPolyline({
                    keyPrefix: `swoop-${sp.swoop.id}-topchainB`,
                    points: [{ x: xB, y: ceilYB }, { x: botEndX, y: botEndY }],
                    linkHeightIn: 1,
                    strokeIn: 0.12,
                    linkWidthIn: 0.55,
                    startPhase: 0,
                    strokeColor: chainColor,
                  });
                  const depthBotMid = 0.5 * (depthB + bottom.depth);
                  for (let i = 0; i < topChainElsB.length; i++) drawables.push({ key: `swoop-${sp.swoop.id}-topchainB-${i}`, depth: depthBotMid, jsx: topChainElsB[i] });
                }
              }
            }

            // sort drawables by depth descending (nearer draw last)
            drawables.sort((a, b) => b.depth - a.depth);
            return drawables.map((d) => d.jsx);
          })()}
        </svg>

        {/* separator: adjusts --previewH (bottom of Preview) */}
        <div
          className="resizeHandle"
          role="separator"
          aria-label="Resize front preview height"
          title="Drag to resize front preview"
          onPointerDown={(ev) => {
            ev.preventDefault();
            const root = document.documentElement;
            const style = getComputedStyle(root);
            const planH = parseFloat(style.getPropertyValue("--planH")) || 320;
            const canvasTop = (ev.currentTarget as HTMLElement).closest('.canvasStack')?.getBoundingClientRect().top || 0;
            const min = 120;
            const max = 1200;

            const onMove = (mev: PointerEvent) => {
              const y = mev.clientY;
              const newH = Math.max(min, Math.min(max, y - (canvasTop + planH)));
              root.style.setProperty("--previewH", `${newH}px`);
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
      </div>
    </PanelFrame>
  );
}

