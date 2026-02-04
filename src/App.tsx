import { useEffect, useMemo, useRef, useState } from "react";
import MenuBar from "./components/MenuBar";
import exportSvgElementToPng from "./utils/export/exportPng";
import serializeSvg from "./utils/export/svgSerialize";
import svgStringToPngBlob from "./utils/export/svgToPng";
import { exportPdfPages } from "./utils/export/exportPdf";
import exportDfaPdf from "./utils/export/exportDfaPdf";
import exportProposalPdf from "./utils/export/exportProposalPdf";
import exportPreviewGif, { renderPreviewGifBytes } from "./utils/export/exportGif";
import exportClientViewerZip from "./utils/export/exportClientViewerZip";
import { computePlanFitBounds } from "./panels/PlanViewPanel";
import { computePreviewFitBounds } from "./utils/previewBounds";
import importProjectJson from "./utils/export/importProjectJson";
import NotesSection from "./components/NotesSection";
import PlanViewToolsBar from "./components/PlanViewToolsBar";
import ProjectSpecsBar from "./components/ProjectSpecsBar";
import ResourceBand from "./components/ResourceBand";
import { calcResources, calcCosts } from "./utils/calcProjectTotals";
// BackPreviewPanel removed — back view deprecated
import FrontPreviewPanel from "./panels/FrontPreviewPanel";
import PlanViewPanel from "./panels/PlanViewPanel";
import { useAppState } from "./state/useAppState";
import type { MenuAction } from "./types/appTypes";
// resize handles moved into panels to keep canvasStack children limited to panels

const DEBUG_LAYOUT = false;

export default function App() {
  const s = useAppState();
  const planSvgRef = useRef<SVGSVGElement | null>(null);
  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const [planPan, setPlanPan] = useState(false);
  const [frontPan, setFrontPan] = useState(false);
  const isViewerMode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("viewer") === "1" || params.get("viewer") === "true";
    } catch {
      return false;
    }
  }, []);
  // backPan removed with BackPreviewPanel
  // canvasRef removed; panels now contain their own resize logic

  const { deleteSelected, clearSelection } = s;

  // Global delete/backspace for selected anchor (avoid interfering with typing)
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || (ev.target as HTMLElement | null)?.getAttribute?.("contenteditable") === "true";
      if (isTyping) return;

      if (ev.key === "Backspace" || ev.key === "Delete") {
        deleteSelected();
        ev.preventDefault();
      }
      if (ev.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, clearSelection]);

  // Ensure canvas rows fit the viewport on resize/zoom (Safari zoom can cause overlay).
  // This adjusts --frontH and --backH proportionally when the combined canvas height
  // would exceed available window height minus a reserved area.
  useEffect(() => {
    const root = document.documentElement;

    const debounce = (fn: () => void, wait = 100) => {
      let t: number | undefined;
      return () => {
        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => fn(), wait) as unknown as number;
      };
    };

    const adjust = () => {
      try {
        const style = getComputedStyle(root);
        const allowOverflow = style.getPropertyValue("--previewAllowOverflow")?.trim() === "1";
        if (allowOverflow) return;
        const planH = parseFloat(style.getPropertyValue("--planH")) || 320;
        let previewH = parseFloat(style.getPropertyValue("--previewH")) || 520;
        const gap = 12; // gap between rows

        const reserved = 200; // space reserved for menus/controls/belowStack
        const available = Math.max(200, window.innerHeight - reserved);
        const total = planH + previewH + gap;

        if (total > available) {
          const excess = total - available;
          previewH = Math.max(120, previewH - excess);
          root.style.setProperty("--previewH", `${Math.round(previewH)}px`);
        }
      } catch (e) {
        // ignore
      }
    };

    const onResize = debounce(adjust, 120);
    window.addEventListener("resize", onResize);

    // Safari pinch-zoom sometimes only changes devicePixelRatio; poll for changes.
    let lastDPR = window.devicePixelRatio;
    const dprCheck = window.setInterval(() => {
      if (window.devicePixelRatio !== lastDPR) {
        lastDPR = window.devicePixelRatio;
        adjust();
      }
    }, 200);

    // initial adjust
    adjust();

    return () => {
      window.removeEventListener("resize", onResize);
      clearInterval(dprCheck);
    };
  }, []);

  // Debug logger: automatically prints positioning and stacking info for
  // front canvas and below-stack cards to help diagnose overlap issues.
  useEffect(() => {
    if (!DEBUG_LAYOUT) return;
    let t: number | undefined;
    const logProps = () => {
      try {
        const canvasCards = Array.from(document.querySelectorAll('.canvasStack > .card')) as HTMLElement[];
        const planCard = canvasCards[0];
        const frontCard = canvasCards[1];
        const backCard = canvasCards[2];
        const frontSvg = frontCard?.querySelector('svg') as Element | null;

        const belowCards = Array.from(document.querySelectorAll('.belowStack > .card')) as HTMLElement[];
        const resourcesCard = belowCards[0];
        const notesCard = belowCards[1];

        const report = (el: Element | null | undefined, name: string) => {
          if (!el) {
            console.log(name + ': NOT FOUND');
            return;
          }
          const cs = getComputedStyle(el as Element);
          const rect = (el as Element).getBoundingClientRect();
          const out = {
            position: cs.position,
            zIndex: cs.zIndex,
            top: cs.top,
            bottom: cs.bottom,
            transform: cs.transform,
            willChange: cs.willChange,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            offsetTop: (el as HTMLElement).offsetTop,
            offsetHeight: (el as HTMLElement).offsetHeight,
          };
          console.log(name + ': ' + JSON.stringify(out));
        };

        report(planCard, 'Plan Card');
        report(frontSvg || frontCard, 'Front SVG/Card');
        report(backCard, 'Back Card');
        report(resourcesCard, 'Resources Card');
        report(notesCard, 'Notes Card');
      } catch (e) {
        console.error('debug log failed', e);
      }
    };

    const debounced = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => logProps(), 120) as unknown as number;
    };

    logProps();
    window.addEventListener('resize', debounced);
    let lastDPR = window.devicePixelRatio;
    const iv = window.setInterval(() => {
      if (window.devicePixelRatio !== lastDPR) {
        lastDPR = window.devicePixelRatio;
        logProps();
      }
    }, 200);

    return () => {
      window.removeEventListener('resize', debounced);
      clearInterval(iv);
      if (t) window.clearTimeout(t);
    };
  }, []);

  // Ensure belowStack is placed after the canvasStack visually by setting an inline
  // margin-top equal to the canvasStack height. This compensates for browser
  // compositing quirks (Safari zoom) without changing document flow of the nodes.
  const canvasStackRef = useRef<HTMLDivElement | null>(null);
  const belowStackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const apply = () => {
      const canvas = canvasStackRef.current;
      const below = belowStackRef.current;
      if (!canvas || !below) return;
      // compute margin so the top of `below` is below the bottom of `canvas`
      const canvasRect = canvas.getBoundingClientRect();
      const belowRect = below.getBoundingClientRect();
      const desired = Math.ceil(canvasRect.y + canvasRect.height - belowRect.y + 12);
      // only set when positive and different enough
      if (desired > 0) {
        below.style.marginTop = `${desired}px`;
      } else {
        below.style.marginTop = `12px`;
      }
      if (DEBUG_LAYOUT) {
        console.log('DEBUG apply:', {
          canvasRectY: canvasRect.y,
          canvasRectH: canvasRect.height,
          belowRectY: belowRect.y,
          belowStyleMarginTop: below.style.marginTop,
        });
      }
      // debug log
      // console.debug('apply below margin', { canvasRect, belowRect, desired });
    };

    const rafApply = () => requestAnimationFrame(apply);

    rafApply();
    let lastDPR = window.devicePixelRatio;
    const iv = window.setInterval(() => {
      if (window.devicePixelRatio !== lastDPR) {
        lastDPR = window.devicePixelRatio;
        rafApply();
      }
    }, 200);
    const onResize = () => rafApply();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearInterval(iv);
    };
  }, []);

  const waitNextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const rasterSizeForFit = (fit: { w: number; h: number }, longEdgePx = 2400) => {
    const ratio = fit.h / fit.w;
    if (ratio > 1) {
      const heightPx = longEdgePx;
      const widthPx = Math.max(1, Math.round(longEdgePx / ratio));
      return { widthPx, heightPx };
    }
    const widthPx = longEdgePx;
    const heightPx = Math.max(1, Math.round(longEdgePx * ratio));
    return { widthPx, heightPx };
  };

  const captureSvgToPngBytes = async (svgEl: SVGSVGElement, fitBounds: { x: number; y: number; w: number; h: number }) => {
    const { widthPx, heightPx } = rasterSizeForFit({ w: fitBounds.w, h: fitBounds.h }, 2400);
    const svgString = serializeSvg(svgEl, { fitBounds });
    const pngBlob = await svgStringToPngBlob(svgString, { widthPx, heightPx, backgroundColor: "#ffffff" });
    return new Uint8Array(await pngBlob.arrayBuffer());
  };

  const handleMenuAction = async (action: MenuAction) => {
    if (action === "png") {
      try {
        // export plan
        const planEl = planSvgRef.current;
        if (planEl) {
          const planBounds = computePlanFitBounds(s.projectSpecs);
          await exportSvgElementToPng(planEl, planBounds, "plan.png");
        }
        // export preview
        const previewEl = previewSvgRef.current;
        if (previewEl) {
          const previewBounds = computePreviewFitBounds(s.projectSpecs, s.strands, s.anchors, s.swoops, s.stacks, s.customStrands, s.clusters);
          await exportSvgElementToPng(previewEl, previewBounds, "preview.png");
        }
      } catch (e: any) {
        alert('PNG export failed: ' + (e?.message || String(e)));
        console.error('PNG export failed', e);
      }
      return;
    }
    if (action === "pdf") {
      try {
        const previewEl = previewSvgRef.current;
        if (!previewEl) {
          alert("Cannot export PDF: preview not found.");
          return;
        }

        const previewFit = computePreviewFitBounds(s.projectSpecs, s.strands, s.anchors, s.swoops, s.stacks, s.customStrands, s.clusters);
        await waitNextPaint();
        const previewBytes = await captureSvgToPngBytes(previewEl, previewFit);

        const name = (s.projectSpecs.projectName?.trim() || "Project");
        await exportPdfPages({
          filenameBase: name,
          subtitle: s.projectSpecs.dueDate ? `Due: ${s.projectSpecs.dueDate}` : undefined,
          pages: [
            { title: "Preview", pngBytes: previewBytes },
          ],
        });
      } catch (e: any) {
        console.error("PDF export failed", e);
        alert("PDF export failed: " + (e?.message || String(e)));
      }
      return;
    }
    if (action === "dfa") {
      try {
        const previewEl = previewSvgRef.current;
        if (!previewEl) {
          alert("Cannot export DFA: preview not found.");
          return;
        }

        const previewFit = computePreviewFitBounds(s.projectSpecs, s.strands, s.anchors, s.swoops, s.stacks, s.customStrands, s.clusters);
        await waitNextPaint();
        const previewBytes = await captureSvgToPngBytes(previewEl, previewFit);

        await exportDfaPdf({
          projectSpecs: s.projectSpecs,
          previewPngBytes: previewBytes,
          customerNotes: s.notes.customerNotes,
          artistNotes: s.notes.artistNotes,
        });
      } catch (e: any) {
        console.error("DFA export failed", e);
        alert("DFA export failed: " + (e?.message || String(e)));
      }
      return;
    }
    if (action === "proposal") {
      try {
        const previewEl = previewSvgRef.current;
        if (!previewEl) {
          alert("Cannot export Proposal: preview not found.");
          return;
        }

        const previewFit = computePreviewFitBounds(
          s.projectSpecs,
          s.strands,
          s.anchors,
          s.swoops,
          s.stacks,
          s.customStrands,
          s.clusters,
        );

        const resources = calcResources({
          strands: s.strands,
          stacks: s.stacks,
          piles: s.piles,
          customStrands: s.customStrands,
          clusters: s.clusters,
          anchors: s.anchors,
          swoops: s.swoops,
          projectSpecs: s.projectSpecs,
        });
        const costs = calcCosts(
          { strands: s.strands, stacks: s.stacks, piles: s.piles, customStrands: s.customStrands, clusters: s.clusters, anchors: s.anchors, projectSpecs: s.projectSpecs },
          resources,
        );

        const currentRotation = s.projectSpecs.previewView?.rotationDeg ?? 0;
        let previewBytes: Uint8Array;
        let gifBytes: Uint8Array | undefined;
        try {
          // Make the cover image match the first GIF frame (rotation=0).
          s.setPreviewViewPatch({ rotationDeg: 0 });
          await waitNextPaint();
          previewBytes = await captureSvgToPngBytes(previewEl, previewFit);

          gifBytes = await renderPreviewGifBytes({
            svgEl: previewEl,
            fitBounds: previewFit,
            frameCount: 36,
            delayMs: 60,
            longEdgePx: 900,
            setFrame: async (_i, deg) => {
              s.setPreviewViewPatch({ rotationDeg: deg });
            },
          });
        } finally {
          s.setPreviewViewPatch({ rotationDeg: currentRotation });
        }

        await exportProposalPdf({
          projectSpecs: s.projectSpecs,
          previewPngBytes: previewBytes!,
          previewGifBytes: gifBytes,
          resources,
          costs,
        });
      } catch (e: any) {
        console.error("Proposal export failed", e);
        alert("Proposal export failed: " + (e?.message || String(e)));
      }
      return;
    }
    if (action === "gif") {
      try {
        const previewEl = previewSvgRef.current;
        if (!previewEl) {
          alert("No preview available to export.");
          return;
        }
        const previewBounds = computePreviewFitBounds(s.projectSpecs, s.strands, s.anchors, s.swoops, s.stacks, s.customStrands, s.clusters);
        const currentRotation = s.projectSpecs.previewView?.rotationDeg ?? 0;
        await exportPreviewGif({
          svgEl: previewEl,
          fitBounds: previewBounds,
          filename: "preview.gif",
          frameCount: 36,
          delayMs: 60,
          longEdgePx: 1200,
          setFrame: async (_i, deg) => {
            s.setPreviewViewPatch({ rotationDeg: deg });
          },
        });
        s.setPreviewViewPatch({ rotationDeg: currentRotation });
      } catch (e: any) {
        alert("GIF export failed: " + (e?.message || String(e)));
        console.error("GIF export failed", e);
      }
      return;
    }
    if (action === "viewer_zip") {
      try {
        const payload = {
          projectSpecs: s.projectSpecs,
          planTools: { ...s.planTools, pendingSwoopStartHoleId: null },
          palette: s.palette,
          anchors: s.anchors,
          strands: s.strands,
          stacks: s.stacks,
          piles: s.piles,
          clusters: s.clusters,
          swoops: s.swoops,
          customStrands: s.customStrands,
          notes: s.notes,
          showLabels: s.showLabels,
          planView: s.planView,
          frontView: s.frontView,
          views: { planView: s.planView, frontView: s.frontView },
        };
        exportClientViewerZip(payload, s.projectSpecs?.projectName ?? "untitled");
      } catch (e: any) {
        alert("Viewer export failed: " + (e?.message || String(e)));
        console.error("Viewer export failed", e);
      }
      return;
    }
    s.onMenuAction(action);
  };

  const selectedAnchorId = s.selection.selectedAnchorId ?? null;
  const selectedAnchor = useMemo(
    () => (selectedAnchorId ? s.anchors.find((a) => a.id === selectedAnchorId) ?? null : null),
    [selectedAnchorId, s.anchors],
  );
  const selectedStrand = useMemo(
    () => (selectedAnchorId ? s.strands.find((st) => st.anchorId === selectedAnchorId) ?? null : null),
    [selectedAnchorId, s.strands],
  );
  const selectedStack = useMemo(
    () => (selectedAnchorId ? s.stacks.find((st) => st.anchorId === selectedAnchorId) ?? null : null),
    [selectedAnchorId, s.stacks],
  );
  const selectedPile = useMemo(
    () => (s.selection.selectedPileId ? s.piles.find((p) => p.id === s.selection.selectedPileId) ?? null : null),
    [s.selection.selectedPileId, s.piles],
  );
  const selectedCluster = useMemo(
    () => (selectedAnchorId ? s.clusters.find((cl) => cl.anchorId === selectedAnchorId) ?? null : null),
    [selectedAnchorId, s.clusters],
  );
  const selectedCustomStrand = useMemo(
    () => (selectedAnchorId ? s.customStrands.find((cs) => cs.anchorId === selectedAnchorId) ?? null : null),
    [selectedAnchorId, s.customStrands],
  );
  const selectedSwoop = useMemo(
    () => (s.selection.selectedSwoopId ? s.swoops.find((sw) => sw.id === s.selection.selectedSwoopId) ?? null : null),
    [s.selection.selectedSwoopId, s.swoops],
  );

  return (
    <div className="app">
      <MenuBar
        onAction={handleMenuAction}
        onLoad={async (file: File) => {
          try {
            const parsed = await importProjectJson(file);
            // parsed is the loaded app snapshot (merged with defaults); replace state
            s.loadSnapshot(parsed);
          } catch (e: any) {
            alert("Failed to load project: " + (e?.message || String(e)));
          }
        }}
        viewerOnly={isViewerMode}
      />

      {!isViewerMode ? (
        <>
          <ProjectSpecsBar
            specs={s.projectSpecs}
            onChange={s.setProjectSpecs}
            dueDate={s.projectSpecs.dueDate}
            onDueDateChange={s.setDueDate}
          />
            <PlanViewToolsBar
              tools={s.planTools}
              palette={s.palette}
              sphereDiameterIn={s.projectSpecs.materials?.sphereDiameterIn ?? 4.5}
              cursor={s.planCursor}
              cursorText={s.formatCursor(s.planCursor)}
              selectedAnchor={selectedAnchor}
              selectedStrand={selectedStrand}
              selectedStack={selectedStack}
              selectedPile={selectedPile}
              selectedCluster={selectedCluster}
              selectedCustomStrand={selectedCustomStrand}
              selectedSwoop={selectedSwoop}
            onPatchSelectedStrand={
              selectedAnchorId && selectedStrand
                ? (patch) => s.patchStrandAtAnchor(selectedAnchorId, patch)
                : undefined
            }
            onPatchSelectedStack={
              selectedAnchorId && selectedStack
                ? (patch) => s.patchStackAtAnchor(selectedAnchorId, patch)
                : undefined
            }
            onPatchSelectedPile={
              selectedPile ? (patch) => s.patchPileById(selectedPile.id, patch) : undefined
            }
            onPatchSelectedCluster={
              selectedAnchorId && selectedCluster
                ? (patch) => s.patchClusterAtAnchor(selectedAnchorId, patch)
                : undefined
            }
            onPatchSelectedCustomStrand={
              selectedAnchorId && selectedCustomStrand
                ? (patch) => s.patchCustomStrandAtAnchor(selectedAnchorId, patch)
                : undefined
            }
            onPatchSelectedSwoop={
              selectedSwoop ? (patch) => s.patchSwoopById(selectedSwoop.id, patch) : undefined
            }
            onMode={s.setMode}
            onDraftPatch={s.setDraftStrand}
            onDraftStackPatch={s.setDraftStack}
            pileBuilder={s.planTools.pileBuilder}
            onPileBuilderPatch={s.setPileBuilderPatch}
            onGeneratePileSpheres={s.generatePileSpheres}
            onAppendPileSphere={s.appendPileSphere}
            onUpdatePileSphere={s.updatePileSphere}
            onRemovePileSphere={s.removePileSphere}
            clusterBuilder={s.planTools.clusterBuilder}
            onClusterBuilderPatch={s.setClusterBuilderPatch}
            onAppendClusterStrand={s.appendClusterStrand}
            onUpdateClusterStrand={s.updateClusterStrand}
            onRemoveClusterStrand={s.removeClusterStrand}
            customBuilder={s.planTools.customBuilder}
            onCustomBuilderPatch={s.setCustomBuilderPatch}
            onAppendCustomNode={s.appendCustomNode}
            onRemoveLastCustomNode={s.removeLastCustomNode}
            onDraftSwoopPatch={s.setDraftSwoop}
          />

          <div className="canvasStack" style={{ minHeight: 0 }} ref={canvasStackRef}>
            <PlanViewPanel
              specs={s.projectSpecs}
              view={s.planView}
              onViewChange={s.setPlanView}
              svgRef={planSvgRef}
              mode={s.planTools.mode}
              anchors={s.anchors}
              piles={s.piles}
              clusters={s.clusters}
              selectedAnchorId={s.selection.selectedAnchorId}
              selectedPileId={s.selection.selectedPileId}
              swoops={s.swoops}
              onSwoopAnchorClick={s.onSwoopAnchorClick}
              onSelectSwoop={s.selectSwoop}
              pendingSwoopStartHoleId={s.planTools.pendingSwoopStartHoleId}
              planCursor={s.planCursor}
              onPlaceStrand={s.placeStrandAt}
              onPlaceStack={s.placeStackAt}
              onPlacePile={s.placePileAt}
              onPlaceCluster={s.placeClusterAt}
              onPlaceCustomStrand={s.placeCustomStrandAt}
              onBeginCopyAnchor={s.beginCopyAnchor}
              onPlaceCopyAt={s.placeCopyAt}
              pendingCopyAnchorId={s.planTools.pendingCopyAnchorId ?? null}
              onEnsureStrandHoleAt={s.ensureStrandHoleAt}
              onPlaceCanopyFastener={s.placeCanopyFastenerAt}
              onSelectAnchor={s.selectAnchor}
              onSelectPile={s.selectPile}
              onClearSelection={s.clearSelection}
              onMoveAnchor={s.moveAnchor}
              onMovePile={s.movePile}
              showLabels={s.showLabels}
              onToggleShowLabels={() => s.setShowLabels(!s.showLabels)}
              onCursorMove={(xIn, yIn, inside) => s.setPlanCursor({ xIn, yIn, inside })}
              onCursorLeave={s.clearPlanCursor}
              panEnabled={planPan}
              onTogglePan={() => setPlanPan((v) => !v)}
            />

            <FrontPreviewPanel
              specs={s.projectSpecs}
              view={s.frontView}
              onViewChange={s.setFrontView}
              svgRef={previewSvgRef}
              anchors={s.anchors}
              strands={s.strands}
              stacks={s.stacks}
              piles={s.piles}
              clusters={s.clusters}
              customStrands={s.customStrands}
              swoops={s.swoops}
              previewClusterBuilder={s.planTools.clusterBuilder}
              previewPileBuilder={s.planTools.pileBuilder}
              palette={s.palette}
              selectedAnchorId={s.selection.selectedAnchorId}
              selectedPileId={s.selection.selectedPileId}
              panEnabled={frontPan}
              onTogglePan={() => setFrontPan((v) => !v)}
              previewView={s.projectSpecs.previewView}
              onPreviewDepthPatch={s.setPreviewDepthPatch}
              onPreviewViewPatch={s.setPreviewViewPatch}
            />

            {/* Back preview removed — deprecated */}
          </div>

          <div className="belowStack" ref={belowStackRef}>
            {
              // compute totals from the app state (pure functions)
            }
            <ResourceBand
              resources={calcResources({ strands: s.strands, stacks: s.stacks, piles: s.piles, customStrands: s.customStrands, clusters: s.clusters, anchors: s.anchors, swoops: s.swoops, projectSpecs: s.projectSpecs })}
              costs={calcCosts(
                { strands: s.strands, stacks: s.stacks, piles: s.piles, customStrands: s.customStrands, clusters: s.clusters, anchors: s.anchors, projectSpecs: s.projectSpecs },
                calcResources({ strands: s.strands, stacks: s.stacks, piles: s.piles, customStrands: s.customStrands, clusters: s.clusters, anchors: s.anchors, swoops: s.swoops, projectSpecs: s.projectSpecs }),
              )}
              pricing={s.projectSpecs.pricing}
              quote={s.projectSpecs.quote}
              onPricingPatch={s.setPricingPatch}
              onQuotePatch={s.setQuotePatch}
            />
            <NotesSection notes={s.notes} onChange={s.setNotesPatch} />
          </div>
        </>
      ) : (
        <div className="canvasStack" style={{ minHeight: 0 }} ref={canvasStackRef}>
          <FrontPreviewPanel
            specs={s.projectSpecs}
            view={s.frontView}
            onViewChange={s.setFrontView}
            svgRef={previewSvgRef}
            anchors={s.anchors}
            strands={s.strands}
            stacks={s.stacks}
            piles={s.piles}
            clusters={s.clusters}
            customStrands={s.customStrands}
            swoops={s.swoops}
            previewClusterBuilder={s.planTools.clusterBuilder}
            previewPileBuilder={s.planTools.pileBuilder}
            palette={s.palette}
            selectedAnchorId={s.selection.selectedAnchorId}
            selectedPileId={s.selection.selectedPileId}
            panEnabled={frontPan}
            onTogglePan={() => setFrontPan((v) => !v)}
            previewView={s.projectSpecs.previewView}
            onPreviewDepthPatch={s.setPreviewDepthPatch}
            onPreviewViewPatch={s.setPreviewViewPatch}
          />
        </div>
      )}
    </div>
  );
}
