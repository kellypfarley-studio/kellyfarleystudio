import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MenuBar from "./components/MenuBar";
import exportSvgElementToPng from "./utils/export/exportPng";
import serializeSvg, { type FitBounds } from "./utils/export/svgSerialize";
import svgStringToPngBlob from "./utils/export/svgToPng";
import { exportPdfPages } from "./utils/export/exportPdf";
import exportDfaPdf from "./utils/export/exportDfaPdf";
import exportProposalPdf from "./utils/export/exportProposalPdf";
import exportPreviewGif, { renderPreviewGifBytes } from "./utils/export/exportGif";
import { buildProjectCsv } from "./utils/export/exportCsv";
import { buildProjectDxf } from "./utils/export/exportDxf";
import { computePlanFitBounds } from "./panels/PlanViewPanel";
import { computePreviewFitBounds } from "./utils/previewBounds";
import NotesSection from "./components/NotesSection";
import PlanViewToolsBar from "./components/PlanViewToolsBar";
import ProjectSpecsBar from "./components/ProjectSpecsBar";
import ResourceBand from "./components/ResourceBand";
import { calcResources, calcCosts } from "./utils/calcProjectTotals";
import { parseProjectJsonText } from "./utils/export/importProjectJson";
// BackPreviewPanel removed — back view deprecated
import FrontPreviewPanel from "./panels/FrontPreviewPanel";
import PlanViewPanel from "./panels/PlanViewPanel";
import { useAppState } from "./state/useAppState";
import type { MenuAction } from "./types/appTypes";
import {
  ensureProjectFolders,
  isTauriApp,
  listProjectFiles,
  openExportsFolder,
  readProjectFile,
  saveProjectFile,
  writeExportBytes,
  writeExportText,
} from "./utils/tauri/projectStorage";
import type { ProjectListItem } from "./utils/tauri/projectStorage";
// resize handles moved into panels to keep canvasStack children limited to panels

const DEBUG_LAYOUT = false;

export default function App() {
  const s = useAppState();
  const planSvgRef = useRef<SVGSVGElement | null>(null);
  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const [planPan, setPlanPan] = useState(false);
  const [frontPan, setFrontPan] = useState(false);
  const isTauri = isTauriApp();
  const [projectList, setProjectList] = useState<ProjectListItem[]>([]);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string>("");
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(() => {
    try {
      return localStorage.getItem("sb.currentProjectPath");
    } catch {
      return null;
    }
  });
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [lastError, setLastError] = useState<string>("");
  const [viewerDebug, setViewerDebug] = useState<string>("");
  const forceNewSaveRef = useRef<boolean>(false);
  const isViewerMode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewerFlag = params.get("viewer");
      if (viewerFlag === "1" || viewerFlag === "true") return true;
      if (params.has("project") || params.has("p") || params.has("data")) return true;
      const path = window.location.pathname.toLowerCase();
      return path.endsWith("/viewer.html") || path.endsWith("/viewer/");
    } catch {
      return false;
    }
  }, []);
  const viewerLoadedRef = useRef(false);
  // backPan removed with BackPreviewPanel
  // canvasRef removed; panels now contain their own resize logic

  const { deleteSelected, clearSelection } = s;

  useEffect(() => {
    if (!isViewerMode) return;
    document.body.classList.add("viewer-mode");
    return () => {
      document.body.classList.remove("viewer-mode");
    };
  }, [isViewerMode]);

  const refreshProjects = useCallback(async () => {
    if (!isTauri) return;
    try {
      const list = await listProjectFiles();
      setProjectList(list);
      const selectedValid = selectedProjectPath && list.some((p) => p.path === selectedProjectPath);
      const currentValid = currentProjectPath && list.some((p) => p.path === currentProjectPath);
      if (selectedValid) {
        // keep user's current selection
        return;
      }
      if (currentValid) {
        setSelectedProjectPath(currentProjectPath as string);
        return;
      }
      if (list.length) {
        setSelectedProjectPath(list[0].path);
      }
    } catch (e) {
      console.error("Failed to refresh project list", e);
    }
  }, [currentProjectPath, isTauri, selectedProjectPath]);

  useEffect(() => {
    if (!isTauri) return;
    (async () => {
      try {
        await ensureProjectFolders();
        await refreshProjects();
      } catch (e) {
        console.error("Failed to prepare project folders", e);
      }
    })();
  }, [isTauri, refreshProjects]);

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

  useEffect(() => {
    if (!isViewerMode || viewerLoadedRef.current) return;
    let projectUrl: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      projectUrl = params.get("project") || params.get("p") || params.get("data");
    } catch {
      return;
    }
    if (!projectUrl) return;

    viewerLoadedRef.current = true;
    let cancelled = false;
    const resolveProjectUrl = (value: string) => {
      try {
        return new URL(value, window.location.href).toString();
      } catch {
        return value;
      }
    };
    const withCacheBust = (url: string) => {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}_=${Date.now()}`;
    };
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    const loadTextWithFetch = async (url: string) => {
      const resp = await fetch(withCacheBust(url), {
        cache: "no-store",
        signal: controller.signal,
        credentials: "omit",
      });
      if (!resp.ok) throw new Error(`Failed to load project (${resp.status})`);
      const text = await resp.text();
      const contentType = resp.headers.get("content-type") || "";
      return { text, contentType, status: resp.status };
    };
    const loadTextWithXHR = (url: string) =>
      new Promise<{ text: string; contentType: string; status: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const timeout = window.setTimeout(() => {
          xhr.abort();
          reject(new Error("XHR timed out"));
        }, 12000);
        xhr.open("GET", withCacheBust(url), true);
        xhr.responseType = "text";
        xhr.onload = () => {
          window.clearTimeout(timeout);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              text: xhr.responseText,
              contentType: xhr.getResponseHeader("content-type") || "",
              status: xhr.status,
            });
          } else {
            reject(new Error(`Failed to load project (${xhr.status})`));
          }
        };
        xhr.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error("XHR network error"));
        };
        xhr.send();
      });

    (async () => {
      try {
        setLastError("");
        setStatusMessage("Loading project…");
        const resolvedUrl = resolveProjectUrl(projectUrl);
        setViewerDebug(`Fetching ${resolvedUrl}`);
        let result: { text: string; contentType: string; status: number } | null = null;
        try {
          result = await loadTextWithFetch(resolvedUrl);
        } catch (fetchErr: any) {
          if (fetchErr?.name === "AbortError") {
            setViewerDebug("Fetch timed out, trying fallback…");
          } else {
            setViewerDebug(`Fetch failed (${fetchErr?.message || "unknown"}), trying fallback…`);
          }
          result = await loadTextWithXHR(resolvedUrl);
        }
        const txt = result.text;
        const contentType = result.contentType || "";
        setViewerDebug(`HTTP ${result.status} · ${contentType || "unknown"} · ${txt.length} bytes`);
        if (!contentType.includes("json") && txt.trim().startsWith("<")) {
          throw new Error("Project response was not JSON");
        }
        const parsed = parseProjectJsonText(txt);
        if (cancelled) return;
        s.loadSnapshot(parsed);
        setStatusMessage("Project loaded");
        setViewerDebug("");
        window.setTimeout(() => setStatusMessage(""), 2000);
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.name === "AbortError" ? "Project load timed out" : e?.message || String(e);
        setLastError(msg);
        setStatusMessage("");
        setViewerDebug(`Error: ${msg}`);
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isViewerMode, s]);

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

  const rasterSizeForFit = (fit: Pick<FitBounds, "w" | "h">, longEdgePx = 2400) => {
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

  const captureSvgToPngBytes = async (svgEl: SVGSVGElement, fitBounds: FitBounds) => {
    const { widthPx, heightPx } = rasterSizeForFit({ w: fitBounds.w, h: fitBounds.h }, 2400);
    const svgString = serializeSvg(svgEl, { fitBounds });
    const pngBlob = await svgStringToPngBlob(svgString, { widthPx, heightPx, backgroundColor: "#ffffff" });
    return new Uint8Array(await pngBlob.arrayBuffer());
  };

  const handleMenuAction = async (action: MenuAction) => {
    setLastError("");
    if (action === "new") {
      try {
        setStatusMessage("New clicked");
        window.setTimeout(() => setStatusMessage(""), 4000);
        s.resetAll();
        forceNewSaveRef.current = true;
      setCurrentProjectPath(null);
        setSelectedProjectPath("");
        setLastSavedAt(null);
        setLastSavedPath(null);
        try {
          localStorage.removeItem("sb.currentProjectPath");
        } catch {
          // ignore storage failures
        }
        setStatusMessage("New project started");
        window.setTimeout(() => setStatusMessage(""), 2500);
        return;
      } catch (e: any) {
        setLastError(e?.message || String(e));
        return;
      }
    }
    if (action === "save" && isTauri) {
      try {
        await ensureProjectFolders();
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
          guides: s.guides,
          showGuides: s.showGuides,
          guidesLocked: s.guidesLocked,
          notes: s.notes,
          showLabels: s.showLabels,
          planView: s.planView,
          frontView: s.frontView,
          views: { planView: s.planView, frontView: s.frontView },
        };
        const path = await saveProjectFile(
          payload,
          s.projectSpecs?.projectName ?? "untitled",
          forceNewSaveRef.current ? null : currentProjectPath,
        );
        setCurrentProjectPath(path);
        setSelectedProjectPath(path);
        setLastSavedAt(new Date().toISOString());
        setLastSavedPath(path);
        forceNewSaveRef.current = false;
        setStatusMessage("Saved");
        window.setTimeout(() => setStatusMessage(""), 2500);
        try {
          localStorage.setItem("sb.currentProjectPath", path);
        } catch {
          // ignore storage failures
        }
        await refreshProjects();
      } catch (e: any) {
        setLastError(e?.message || String(e));
        alert("Save failed: " + (e?.message || String(e)));
      }
      return;
    }
    if (action === "save" && !isTauri) {
      s.onMenuAction(action);
      setLastSavedAt(new Date().toISOString());
      setLastSavedPath(null);
      forceNewSaveRef.current = false;
      setStatusMessage("Saved");
      window.setTimeout(() => setStatusMessage(""), 2500);
      return;
    }
    if (action === "png") {
      try {
        // export plan
        const planEl = planSvgRef.current;
        if (planEl) {
          const planBounds = computePlanFitBounds(s.projectSpecs);
        if (isTauri) {
          const bytes = await captureSvgToPngBytes(planEl, planBounds);
          await writeExportBytes(s.projectSpecs.projectName ?? "Project", "plan.png", bytes);
          setStatusMessage("Exported plan.png");
          window.setTimeout(() => setStatusMessage(""), 2500);
        } else {
          await exportSvgElementToPng(planEl, planBounds, "plan.png");
        }
      }
      // export preview
      const previewEl = previewSvgRef.current;
        if (previewEl) {
          const previewBounds = computePreviewFitBounds(s.projectSpecs, s.strands, s.anchors, s.swoops, s.stacks, s.customStrands, s.clusters);
          if (isTauri) {
            const bytes = await captureSvgToPngBytes(previewEl, previewBounds);
            await writeExportBytes(s.projectSpecs.projectName ?? "Project", "preview.png", bytes);
            setStatusMessage("Exported preview.png");
            window.setTimeout(() => setStatusMessage(""), 2500);
          } else {
            await exportSvgElementToPng(previewEl, previewBounds, "preview.png");
          }
        }
      } catch (e: any) {
        setLastError(e?.message || String(e));
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
        const bytes = await exportPdfPages({
          filenameBase: name,
          subtitle: s.projectSpecs.dueDate ? `Due: ${s.projectSpecs.dueDate}` : undefined,
          pages: [
            { title: "Preview", pngBytes: previewBytes },
          ],
        }, { returnBytes: isTauri });
        if (isTauri && bytes) {
          await writeExportBytes(s.projectSpecs.projectName ?? "Project", `${name}.pdf`, bytes as Uint8Array);
          setStatusMessage("Exported PDF");
          window.setTimeout(() => setStatusMessage(""), 2500);
        }
      } catch (e: any) {
        setLastError(e?.message || String(e));
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

        const bytes = await exportDfaPdf({
          projectSpecs: s.projectSpecs,
          previewPngBytes: previewBytes,
          customerNotes: s.notes.customerNotes,
          artistNotes: s.notes.artistNotes,
        }, { returnBytes: isTauri });
        if (isTauri && bytes) {
          const name = (s.projectSpecs.projectName?.trim() || "Project");
          await writeExportBytes(s.projectSpecs.projectName ?? "Project", `${name}-DFA.pdf`, bytes as Uint8Array);
          setStatusMessage("Exported DFA");
          window.setTimeout(() => setStatusMessage(""), 2500);
        }
      } catch (e: any) {
        setLastError(e?.message || String(e));
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

        const bytes = await exportProposalPdf({
          projectSpecs: s.projectSpecs,
          previewPngBytes: previewBytes!,
          previewGifBytes: gifBytes,
          resources,
          costs,
        }, { returnBytes: isTauri });
        if (isTauri && bytes) {
          const name = (s.projectSpecs.projectName?.trim() || "Project");
          await writeExportBytes(s.projectSpecs.projectName ?? "Project", `${name}-Proposal.pdf`, bytes as Uint8Array);
          setStatusMessage("Exported Proposal");
          window.setTimeout(() => setStatusMessage(""), 2500);
        }
      } catch (e: any) {
        setLastError(e?.message || String(e));
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
        if (isTauri) {
          const gifBytes = await renderPreviewGifBytes({
            svgEl: previewEl,
            fitBounds: previewBounds,
            frameCount: 36,
            delayMs: 60,
            longEdgePx: 1200,
            setFrame: async (_i, deg) => {
              s.setPreviewViewPatch({ rotationDeg: deg });
            },
          });
          await writeExportBytes(s.projectSpecs.projectName ?? "Project", "preview.gif", gifBytes);
          setStatusMessage("Exported GIF");
          window.setTimeout(() => setStatusMessage(""), 2500);
        } else {
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
        }
        s.setPreviewViewPatch({ rotationDeg: currentRotation });
      } catch (e: any) {
        setLastError(e?.message || String(e));
        alert("GIF export failed: " + (e?.message || String(e)));
        console.error("GIF export failed", e);
      }
      return;
    }
    if (action === "publish_viewer") {
      if (!isTauri) {
        alert("Publish Viewer is only available in the desktop app.");
        return;
      }
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

        const rawName = (s.projectSpecs?.projectName ?? "untitled").trim() || "untitled";
        const safeBase = rawName
          .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/(^-+|-+$)/g, "")
          .slice(0, 80) || "untitled";
        const filename = `${safeBase}.ssp.json`;
        const pkg = {
          schemaVersion: "1.0.0",
          savedAt: new Date().toISOString(),
          state: payload,
        };

        let publishDir = "";
        try {
          publishDir = localStorage.getItem("sb.viewerPublishDir") || "";
        } catch {
          // ignore storage failures
        }
        if (!publishDir) {
          const { homeDir, join } = await import("@tauri-apps/api/path");
          const home = await homeDir();
          publishDir = await join(home, "suspended-builder", "suspended-builder-app", "site", "projects");
          try {
            localStorage.setItem("sb.viewerPublishDir", publishDir);
          } catch {
            // ignore storage failures
          }
        }

        const { mkdir, writeTextFile } = await import("@tauri-apps/plugin-fs");
        const { join } = await import("@tauri-apps/api/path");
        await mkdir(publishDir, { recursive: true });
        const outPath = await join(publishDir, filename);
        await writeTextFile(outPath, JSON.stringify(pkg, null, 2));

        let baseUrl = "";
        try {
          baseUrl = localStorage.getItem("sb.viewerBaseUrl") || "";
        } catch {
          // ignore storage failures
        }
          if (!baseUrl || baseUrl === "https://kellyfarleyart.com") {
            baseUrl = "https://kellyfarleystudio.com";
            try {
              localStorage.setItem("sb.viewerBaseUrl", baseUrl);
            } catch {
              // ignore storage failures
            }
          }
        if (baseUrl) {
          const normalizedBase = baseUrl.replace(/\/+$/, "");
          const viewerUrl = `${normalizedBase}/viewer.html?viewer=1&project=/projects/${encodeURIComponent(filename)}`;
          s.setProjectSpecs({ clientViewerUrl: viewerUrl });
          try {
            await navigator.clipboard.writeText(viewerUrl);
          } catch {
            // ignore clipboard failures
          }
          setStatusMessage("Published Viewer + URL copied");
        } else {
          setStatusMessage("Published Viewer");
        }
        window.setTimeout(() => setStatusMessage(""), 2500);
      } catch (e: any) {
        setLastError(e?.message || String(e));
        alert("Publish Viewer failed: " + (e?.message || String(e)));
        console.error("Publish Viewer failed", e);
      }
      return;
    }
    if (action === "csv" && isTauri) {
      try {
        const csv = buildProjectCsv({ projectName: s.projectSpecs?.projectName, projectSpecs: s.projectSpecs, anchors: s.anchors, strands: s.strands, stacks: s.stacks, piles: s.piles, customStrands: s.customStrands, clusters: s.clusters, notes: s.notes });
        const name = (s.projectSpecs?.projectName?.trim() || "project");
        await writeExportText(s.projectSpecs.projectName ?? "Project", `${name}_export.csv`, csv);
        setStatusMessage("Exported CSV");
        window.setTimeout(() => setStatusMessage(""), 2500);
      } catch (e: any) {
        setLastError(e?.message || String(e));
        alert("CSV export failed: " + (e?.message || String(e)));
      }
      return;
    }
    if (action === "dxf" && isTauri) {
      try {
        const { filenameBase, dxf } = buildProjectDxf({ projectName: s.projectSpecs?.projectName, projectSpecs: s.projectSpecs, anchors: s.anchors });
        await writeExportText(s.projectSpecs.projectName ?? "Project", `${filenameBase}_export.dxf`, dxf);
        setStatusMessage("Exported DXF");
        window.setTimeout(() => setStatusMessage(""), 2500);
      } catch (e: any) {
        setLastError(e?.message || String(e));
        alert("DXF export failed: " + (e?.message || String(e)));
      }
      return;
    }
    if (action === "export_3d_zip" && isTauri) {
      try {
        const bytes = await (await import("./utils/export3d/export3dZip")).export3dZip(
          { projectSpecs: s.projectSpecs, anchors: s.anchors, strands: s.strands, stacks: s.stacks, customStrands: s.customStrands },
          undefined,
          { returnBytes: true },
        );
        const name = (s.projectSpecs?.projectName?.trim() || "Project");
        await writeExportBytes(s.projectSpecs.projectName ?? "Project", `${name}_3D.zip`, bytes as Uint8Array);
        setStatusMessage("Exported 3D ZIP");
        window.setTimeout(() => setStatusMessage(""), 2500);
      } catch (e: any) {
        setLastError(e?.message || String(e));
        alert("3D export failed: " + (e?.message || String(e)));
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
      {!isViewerMode ? (
        <MenuBar
          onAction={handleMenuAction}
          viewerOnly={isViewerMode}
          statusMessage={[statusMessage, lastError ? `Error: ${lastError}` : ""].filter(Boolean).join(" | ")}
          isTauri={isTauri}
          projectList={projectList}
          selectedProjectPath={selectedProjectPath}
          onSelectProjectPath={setSelectedProjectPath}
          onRefreshProjects={refreshProjects}
          onOpenProject={async (path) => {
            try {
              const parsed = await readProjectFile(path);
              s.loadSnapshot(parsed);
              setCurrentProjectPath(path);
              setSelectedProjectPath(path);
              setLastSavedAt(null);
              setLastSavedPath(path);
              forceNewSaveRef.current = false;
              try {
                localStorage.setItem("sb.currentProjectPath", path);
              } catch {
                // ignore storage failures
              }
            } catch (e: any) {
              alert("Failed to open project: " + (e?.message || String(e)));
            }
          }}
          onOpenExportsFolder={async () => {
            try {
              await ensureProjectFolders();
              const name = (s.projectSpecs.projectName || "").trim();
              await openExportsFolder(name || undefined);
              setStatusMessage("Opened Exports Folder");
              window.setTimeout(() => setStatusMessage(""), 2500);
            } catch (e: any) {
              setLastError(e?.message || String(e));
              alert("Failed to open exports folder: " + (e?.message || String(e)));
            }
          }}
        />
      ) : null}

      {!isViewerMode ? (
        <>
          <ProjectSpecsBar
            specs={s.projectSpecs}
            onChange={s.setProjectSpecs}
            dueDate={s.projectSpecs.dueDate}
            onDueDateChange={s.setDueDate}
            lastSavedAt={lastSavedAt ?? undefined}
            lastSavedPath={lastSavedPath}
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
              guides={s.guides}
              showGuides={s.showGuides}
              guidesLocked={s.guidesLocked}
              selectedAnchorId={s.selection.selectedAnchorId}
              selectedPileId={s.selection.selectedPileId}
              selectedGuideId={s.selection.selectedGuideId}
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
              onSelectGuide={s.selectGuide}
              onClearSelection={s.clearSelection}
              onMoveAnchor={s.moveAnchor}
              onMovePile={s.movePile}
              onMoveGuide={s.moveGuide}
              onAddGuide={s.addGuide}
              onToggleShowGuides={() => s.setShowGuides(!s.showGuides)}
              onToggleGuidesLocked={() => s.setGuidesLocked(!s.guidesLocked)}
              onTogglePolarGuides={() => s.setProjectSpecs({ showPolarGuides: !s.projectSpecs.showPolarGuides })}
              onToggleSnapGuides={() => s.setProjectSpecs({ snapToGuides: !(s.projectSpecs.snapToGuides !== false) })}
              onToggleSnapBoundary={() => s.setProjectSpecs({ snapToBoundary: !(s.projectSpecs.snapToBoundary !== false) })}
              onToggleMaskOutside={() => s.setProjectSpecs({ maskOutsideBoundary: !s.projectSpecs.maskOutsideBoundary })}
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
              viewerMode={isViewerMode}
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
        <div className="viewerLayout">
          {(() => {
            const noData = s.anchors.length === 0 && s.strands.length === 0;
            const msg = lastError
              ? `Load failed: ${lastError}`
              : statusMessage
                ? statusMessage
                : noData
                  ? "No project data loaded. Check the project URL."
                  : "";
            if (!msg && !viewerDebug) return null;
            return (
              <div className="viewerStatus">
                <div>{msg}</div>
                {viewerDebug ? <div className="viewerDebug">{viewerDebug}</div> : null}
              </div>
            );
          })()}
          <div className="canvasStack viewerCanvas" style={{ minHeight: 0 }} ref={canvasStackRef}>
            <FrontPreviewPanel
              specs={s.projectSpecs}
              view={s.frontView}
              onViewChange={s.setFrontView}
              svgRef={previewSvgRef}
              viewerMode={isViewerMode}
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
          <div className="viewerNotes">
            <div className="viewerNotesTitle">Artist Notes</div>
            <div className="viewerNotesBody">
              {s.notes.artistNotes?.trim() || "Artist notes will appear here."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
