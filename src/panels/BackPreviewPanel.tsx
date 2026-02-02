import { useMemo, useRef } from "react";
import type { Anchor, PaletteColor, ProjectSpecs, Strand, ViewTransform } from "../types/appTypes";
import PanelFrame from "../components/PanelFrame";
import ViewControls from "../components/ViewControls";
import { computeStrandPreview, SPHERE_RADIUS_IN } from "../utils/previewGeometry";
import renderChainAlongPolyline from "../utils/proceduralChain";
import { projectPreview, computeYShift } from "../utils/rotationProjection";

export type BackPreviewPanelProps = {
  specs: ProjectSpecs;
  view: ViewTransform;
  onViewChange: (next: ViewTransform) => void;

  anchors: Anchor[];
  strands: Strand[];
  palette: PaletteColor[];
  selectedAnchorId: string | null;
  panEnabled?: boolean;
  onTogglePan?: () => void;
  previewView?: ProjectSpecs["previewView"];
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

function colorHex(palette: PaletteColor[], id: string): string {
  return palette.find((c) => c.id === id)?.hex ?? "#111";
}

function layerOpacityBack(layer: string): number {
  if (layer === "back") return 1.0;
  if (layer === "mid") return 0.7;
  return 0.45;
}

export default function BackPreviewPanel(props: BackPreviewPanelProps) {
  const { specs, view } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panRef = useRef<{ active: boolean; start: { x: number; y: number }; initPan: { x: number; y: number } }>({ active: false, start: { x: 0, y: 0 }, initPan: { x: 0, y: 0 } });

  const anchorById = useMemo(() => {
    const m = new Map<string, Anchor>();
    for (const a of props.anchors) m.set(a.id, a);
    return m;
  }, [props.anchors]);

  const previews = useMemo(() => {
    return props.strands.map((s) => {
      const a = anchorById.get(s.anchorId);
      const pv = computeStrandPreview(specs, s.spec);
      return { strand: s, anchor: a ?? null, pv };
    });
  }, [anchorById, props.strands, specs]);

  const bounds = useMemo(() => {
    const r = SPHERE_RADIUS_IN;
    const padX = r + 2;
    const padTop = 2;
    const padBottom = 12;

    let maxDrop = specs.ceilingHeightIn;
    for (const p of previews) {
      maxDrop = Math.max(maxDrop, p.pv.totalDropIn);
    }

    const minX = -padX;
    const maxX = specs.boundaryWidthIn + padX;
    const minY = -padTop;
    const maxY = maxDrop + padBottom;
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }, [previews, specs.boundaryWidthIn, specs.ceilingHeightIn]);

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
    <ViewControls view={view} onChange={props.onViewChange} onFit={() => props.onViewChange({ zoom: 1, panX: 0, panY: 0 })} />
  );

  return (
    <PanelFrame
      title="Back Design"
      headerHint={<span className="muted">Read-only preview (rear emphasis)</span>}
      left={left}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ background: "#fff", touchAction: "none", flex: 1 }}
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
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            (ev.target as Element).setPointerCapture(ev.pointerId);
          }}
        >
          {/* Ceiling and floor */}
          <line x1={0} y1={0} x2={specs.boundaryWidthIn} y2={0} stroke="#111" strokeWidth={0.08} />
          <line x1={0} y1={specs.ceilingHeightIn} x2={specs.boundaryWidthIn} y2={specs.ceilingHeightIn} stroke="#111" strokeWidth={0.08} />

          <g>
            {(() => {
              const pvView = props.previewView ?? specs.previewView ?? { rotationDeg: 0, rotationStrength: 1, detail: "simple" };
              // For back preview, compute projection using rotationDeg + 180 to mirror view
              const mapped = previews.map((p) => {
                if (!p.anchor) return { ...p, proj: null };
                const proj = projectPreview(specs, p.anchor, (pvView.rotationDeg ?? 0) + 180, pvView.rotationStrength ?? 1);
                return { ...p, proj };
              });

              // sort by depthKey ascending so farther items draw first
              // tie-break with layer priority so back-layer strands draw on top in Back view
              const layerPriorityBack = (layer?: string) => (layer === "back" ? 2 : layer === "mid" ? 1 : 0);
              const sorted = mapped.sort((a, b) => {
                const ka = a.proj?.depthKey ?? 0;
                const kb = b.proj?.depthKey ?? 0;
                if (ka !== kb) return ka - kb;
                const la = a.strand?.spec.layer ?? "mid";
                const lb = b.strand?.spec.layer ?? "mid";
                return layerPriorityBack(la) - layerPriorityBack(lb);
              });

              return sorted.map(({ strand, anchor, pv, proj }) => {
                if (!anchor || !proj) return null;
                const sx = proj.xIn;
                const perspective = specs.previewDepth?.perspectiveFactor ?? 0;
                const yShift = computeYShift(specs, proj.depthKey, perspective);

                const col = colorHex(props.palette, strand.spec.colorId);
                const op = layerOpacityBack(strand.spec.layer);
                const isSelected = anchor.id === props.selectedAnchorId;

                const sphereR = SPHERE_RADIUS_IN;
                const strokeW = isSelected ? 0.18 : 0.10;


                return (
                  <g key={strand.id} opacity={op}>
                    {(() => {
                      const topYStart = 0 - yShift;
                      const topYEnd = pv.sphereCentersY.length ? pv.sphereCentersY[0] - yShift : specs.ceilingHeightIn - yShift;
                      return renderChainAlongPolyline({
                        keyPrefix: `strand-${strand.id}-topchain`,
                        points: [{ x: sx, y: topYStart }, { x: sx, y: topYEnd }],
                        linkHeightIn: 1,
                        strokeIn: strokeW,
                        linkWidthIn: 0.55,
                        startPhase: 0,
                        strokeColor: col,
                      });
                    })()}

                    {pv.sphereCentersY.map((cy, idx) => (
                      <circle key={idx} cx={sx} cy={cy - yShift} r={sphereR} fill="#fff" stroke={col} strokeWidth={strokeW} />
                    ))}


                    {(() => {
                      const bottomYStart = pv.sphereCentersY.length ? pv.sphereCentersY[pv.sphereCentersY.length - 1] - yShift : 0 - yShift;
                      const bottomYEnd = specs.ceilingHeightIn - yShift;
                      return renderChainAlongPolyline({
                        keyPrefix: `strand-${strand.id}-botchain`,
                        points: [{ x: sx, y: bottomYStart }, { x: sx, y: bottomYEnd }],
                        linkHeightIn: 1,
                        strokeIn: strokeW,
                        linkWidthIn: 0.55,
                        startPhase: 1,
                        strokeColor: col,
                      });
                    })()}

                    {strand.spec.moundPreset !== "none" ? (
                      <path
                        d={`
                      M ${sx - 2} ${specs.ceilingHeightIn + 2}
                      C ${sx - 1} ${specs.ceilingHeightIn + 0.5}, ${sx + 1} ${specs.ceilingHeightIn + 3.0}, ${sx + 2} ${
                          specs.ceilingHeightIn + 2
                        }
                      C ${sx + 1} ${specs.ceilingHeightIn + 4.0}, ${sx - 1} ${specs.ceilingHeightIn + 4.0}, ${sx - 2} ${
                          specs.ceilingHeightIn + 2
                        }
                      Z
                    `}
                        fill="#111"
                        opacity={0.9}
                      />
                    ) : null}

                    {pv.overCeiling ? (
                      <text x={sx + 1.0} y={specs.ceilingHeightIn - 1.0} fontSize={2.5} fill="#ff6666">
                        !
                      </text>
                    ) : null}
                  </g>
                );
              });
            })()}
          </g>
        </svg>

        {/* separator at bottom of Back to adjust --backH */}
        <div
          className="resizeHandle"
          role="separator"
          aria-label="Resize back preview height"
          title="Drag to resize back preview"
          onPointerDown={(ev) => {
            ev.preventDefault();
            const root = document.documentElement;
            const style = getComputedStyle(root);
            const planH = parseFloat(style.getPropertyValue("--planH")) || 320;
            const frontH = parseFloat(style.getPropertyValue("--frontH")) || 520;
            const canvasTop = (ev.currentTarget as HTMLElement).closest('.canvasStack')?.getBoundingClientRect().top || 0;
            const min = 120;
            const max = 1200;

            const onMove = (mev: PointerEvent) => {
              const y = mev.clientY;
              const newH = Math.max(min, Math.min(max, y - (canvasTop + planH + frontH)));
              root.style.setProperty("--backH", `${newH}px`);
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
