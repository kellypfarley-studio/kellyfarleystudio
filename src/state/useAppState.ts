import { useCallback, useMemo, useState } from "react";
import type {
  Anchor,
  CursorState,
  MenuAction,
  NotesState,
  PaletteColor,
  PlanToolsState,
  ProjectSpecs,
  SelectionState,
  Strand,
  StrandSpec,
  Stack,
  StackSpec,
  Cluster,
  ClusterSpec,
  ClusterStrandSpec,
  ClusterBuilderState,
  Pile,
  PileSpec,
  PileSphereSpec,
  PileBuilderState,
  Swoop,
  SwoopSpec,
  CustomStrand,
  CustomStrandBuilderState,
  CustomStrandNode,
  CustomStrandSpec,
  ToolMode,
  ViewTransform,
  MaterialsDefaults,
  PricingDefaults,
  QuoteSettings,
} from "../types/appTypes";
import { DEFAULT_NOTES, DEFAULT_PALETTE, DEFAULT_SELECTION, DEFAULT_SPECS, DEFAULT_VIEW, makeDefaultPlanTools, makeDefaultCustomBuilder, makeDefaultClusterBuilder, makeDefaultPileBuilder } from "./defaults";
import { exportProjectJson } from "../utils/export/exportProjectJson";
import exportProjectCsv from "../utils/export/exportCsv";
import exportProjectDxf from "../utils/export/exportDxf";
import export3dZip from "../utils/export3d/export3dZip";
import { uid } from "../utils/id";
import { gridCenterOffset } from "../utils/geometry";
import { snapToGridIndex, gridIndexToWorld } from "../utils/gridMath";
import { round } from "../utils/number";

export type AppState = {
  palette: PaletteColor[];
  projectSpecs: ProjectSpecs;
  planTools: PlanToolsState;
  anchors: Anchor[];
  strands: Strand[];
  stacks: Stack[];
  piles: Pile[];
  clusters: Cluster[];
  swoops: Swoop[];
  customStrands: CustomStrand[];
  selection: SelectionState;
  showLabels: boolean;

  planView: ViewTransform;
  frontView: ViewTransform;

  planCursor: CursorState | null;
  notes: NotesState;
};

export function useAppState() {
  const [palette, setPalette] = useState<PaletteColor[]>(DEFAULT_PALETTE);
  const [projectSpecs, setProjectSpecsState] = useState<ProjectSpecs>(DEFAULT_SPECS);
  const [planTools, setPlanTools] = useState<PlanToolsState>(() => makeDefaultPlanTools(DEFAULT_PALETTE));
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [strands, setStrands] = useState<Strand[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [piles, setPiles] = useState<Pile[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [swoops, setSwoops] = useState<Swoop[]>([]);
  const [customStrands, setCustomStrands] = useState<CustomStrand[]>([]);
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  const [planView, setPlanView] = useState<ViewTransform>(DEFAULT_VIEW);
  const [frontView, setFrontView] = useState<ViewTransform>(DEFAULT_VIEW);

  const [planCursor, setPlanCursor] = useState<CursorState | null>(null);
  const [notes, setNotes] = useState<NotesState>(DEFAULT_NOTES);

  const offsets = useMemo(() => {
    const ox = gridCenterOffset(projectSpecs.boundaryWidthIn, projectSpecs.gridSpacingIn);
    const oy = gridCenterOffset(projectSpecs.boundaryHeightIn, projectSpecs.gridSpacingIn);
    return { ox, oy };
  }, [projectSpecs.boundaryWidthIn, projectSpecs.boundaryHeightIn, projectSpecs.gridSpacingIn]);

  // snapAndClamp removed - movement now computes grid indices directly via gridMath

  const findAnchorAt = useCallback(
    (xIn: number, yIn: number) => {
      // Strict match: since we snap, exact equality is OK, but use tolerance for safety.
      const eps = 0.0001;
      return anchors.find((a) => Math.abs(a.xIn - xIn) < eps && Math.abs(a.yIn - yIn) < eps) ?? null;
    },
    [anchors],
  );

  const selectAnchor = useCallback((anchorId: string) => {
    setSelection({ selectedAnchorId: anchorId, selectedSwoopId: null, selectedPileId: null });
  }, []);

  const selectSwoop = useCallback((swoopId: string) => {
    setSelection({ selectedAnchorId: null, selectedSwoopId: swoopId, selectedPileId: null });
  }, []);

  const selectPile = useCallback((pileId: string) => {
    setSelection({ selectedAnchorId: null, selectedSwoopId: null, selectedPileId: pileId });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({ selectedAnchorId: null, selectedSwoopId: null, selectedPileId: null });
    // clear any pending swoop start when selection is cleared
    setPlanTools((prev) => ({ ...prev, pendingSwoopStartHoleId: null }));
  }, []);

  const patchSwoopById = useCallback((swoopId: string, patch: Partial<SwoopSpec>) => {
    setSwoops((prev) => prev.map((sw) => (sw.id === swoopId ? { ...sw, spec: { ...sw.spec, ...patch } } : sw)));
  }, []);

  const patchPileById = useCallback((pileId: string, patch: Partial<PileSpec>) => {
    setPiles((prev) => prev.map((p) => (p.id === pileId ? { ...p, spec: { ...p.spec, ...patch } } : p)));
  }, []);

  const placeStrandAt = useCallback(
    (xIn: number, yIn: number) => {
      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
      const existing = findAnchorAt(sx, sy);

      let anchorId = existing?.id;
      if (!anchorId) {
        anchorId = uid("a");
        const newAnchor: Anchor = { id: anchorId, xIn: sx, yIn: sy, type: "strand", holeType: "strand", gridCol: col, gridRow: row };
        setAnchors((prev) => [...prev, newAnchor]);
      } else {
        // ensure type is strand if we're placing a strand here
        setAnchors((prev) =>
          prev.map((a) => (a.id === anchorId ? { ...a, type: "strand" as const, holeType: "strand", xIn: sx, yIn: sy, gridCol: col, gridRow: row } : a)),
        );
      }

      const strandSpec: StrandSpec = { ...planTools.draftStrand };
      setStrands((prev) => {
        const existingStrand = prev.find((s) => s.anchorId === anchorId);
        if (existingStrand) {
          return prev.map((s) => (s.anchorId === anchorId ? { ...s, spec: strandSpec } : s));
        }
        return [...prev, { id: uid("st"), anchorId, spec: strandSpec }];
      });
      // Remove stack at same anchor (mutually exclusive)
      setStacks((prev) => prev.filter((st) => st.anchorId !== anchorId));
      // Remove custom strand at same anchor (mutually exclusive)
      setCustomStrands((prev) => prev.filter((cs) => cs.anchorId !== anchorId));
      // Remove cluster at same anchor (mutually exclusive)
      setClusters((prev) => prev.filter((c) => c.anchorId !== anchorId));

      setSelection({ selectedAnchorId: anchorId });
      return anchorId;
    },
    [findAnchorAt, planTools.draftStrand, projectSpecs],
  );

  const placeStackAt = useCallback(
    (xIn: number, yIn: number) => {
      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
      const existing = findAnchorAt(sx, sy);

      let anchorId = existing?.id;
      if (!anchorId) {
        anchorId = uid("a");
        const newAnchor: Anchor = { id: anchorId, xIn: sx, yIn: sy, type: "strand", holeType: "strand", gridCol: col, gridRow: row };
        setAnchors((prev) => [...prev, newAnchor]);
      } else {
        // ensure type is strand for stack placement
        setAnchors((prev) =>
          prev.map((a) => (a.id === anchorId ? { ...a, type: "strand" as const, holeType: "strand", xIn: sx, yIn: sy, gridCol: col, gridRow: row } : a)),
        );
      }

      const stackSpec: StackSpec = { ...planTools.draftStack };
      setStacks((prev) => {
        const existingStack = prev.find((s) => s.anchorId === anchorId);
        if (existingStack) {
          return prev.map((s) => (s.anchorId === anchorId ? { ...s, spec: stackSpec } : s));
        }
        return [...prev, { id: uid("stk"), anchorId, spec: stackSpec }];
      });
      // Remove strand at same anchor (mutually exclusive)
      setStrands((prev) => prev.filter((s) => s.anchorId !== anchorId));
      // Remove custom strand at same anchor (mutually exclusive)
      setCustomStrands((prev) => prev.filter((cs) => cs.anchorId !== anchorId));
      // Remove cluster at same anchor (mutually exclusive)
      setClusters((prev) => prev.filter((c) => c.anchorId !== anchorId));

      setSelection({ selectedAnchorId: anchorId });
      return anchorId;
    },
    [findAnchorAt, planTools.draftStack, projectSpecs],
  );

  const placePileAt = useCallback(
    (xIn: number, yIn: number) => {
      const spheres = planTools.pileBuilder?.spheres ?? [];
      if (!spheres.length) {
        alert("Pile builder is empty. Generate spheres before placing.");
        return undefined;
      }

      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);

      const spec: PileSpec = {
        spheres: spheres.map((s) => ({ ...s })),
        radiusIn: planTools.pileBuilder.radiusIn,
      };

      const pileId = uid("pl");
      setPiles((prev) => [...prev, { id: pileId, xIn: sx, yIn: sy, spec }]);
      setSelection({ selectedAnchorId: null, selectedSwoopId: null, selectedPileId: pileId });
      return pileId;
    },
    [planTools.pileBuilder, projectSpecs],
  );

  const placeClusterAt = useCallback(
    (xIn: number, yIn: number) => {
      const strands = planTools.clusterBuilder.strands ?? [];
      if (!strands.length) {
        alert("Cluster builder is empty. Add strands before placing.");
        return undefined;
      }

      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
      const existing = findAnchorAt(sx, sy);

      let anchorId = existing?.id;
      if (!anchorId) {
        anchorId = uid("a");
        const newAnchor: Anchor = { id: anchorId, xIn: sx, yIn: sy, type: "strand", holeType: "strand", gridCol: col, gridRow: row };
        setAnchors((prev) => [...prev, newAnchor]);
      } else {
        setAnchors((prev) =>
          prev.map((a) => (a.id === anchorId ? { ...a, type: "strand" as const, holeType: "strand", xIn: sx, yIn: sy, gridCol: col, gridRow: row } : a)),
        );
      }

      const spec: ClusterSpec = {
        strands: [...strands],
        itemRadiusIn: planTools.clusterBuilder.itemRadiusIn,
        spreadIn: planTools.clusterBuilder.spreadIn,
      };
      setClusters((prev) => {
        const existingCluster = prev.find((c) => c.anchorId === anchorId);
        if (existingCluster) {
          return prev.map((c) => (c.anchorId === anchorId ? { ...c, spec } : c));
        }
        return [...prev, { id: uid("cl"), anchorId, spec }];
      });

      // Remove strand/stack/custom at same anchor (mutually exclusive)
      setStrands((prev) => prev.filter((s) => s.anchorId !== anchorId));
      setStacks((prev) => prev.filter((s) => s.anchorId !== anchorId));
      setCustomStrands((prev) => prev.filter((cs) => cs.anchorId !== anchorId));

      setSelection({ selectedAnchorId: anchorId });
      return anchorId;
    },
    [findAnchorAt, planTools.clusterBuilder, projectSpecs],
  );

  const placeCustomStrandAt = useCallback(
    (xIn: number, yIn: number) => {
      const nodes = planTools.customBuilder.nodes ?? [];
      if (!nodes.length) {
        alert("Custom strand builder is empty. Add nodes before placing.");
        return undefined;
      }

      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
      const existing = findAnchorAt(sx, sy);

      let anchorId = existing?.id;
      if (!anchorId) {
        anchorId = uid("a");
        const newAnchor: Anchor = { id: anchorId, xIn: sx, yIn: sy, type: "strand", holeType: "strand", gridCol: col, gridRow: row };
        setAnchors((prev) => [...prev, newAnchor]);
      } else {
        setAnchors((prev) =>
          prev.map((a) => (a.id === anchorId ? { ...a, type: "strand" as const, holeType: "strand", xIn: sx, yIn: sy, gridCol: col, gridRow: row } : a)),
        );
      }

      const spec: CustomStrandSpec = {
        nodes: [...nodes],
        layer: planTools.customBuilder.layer ?? "mid",
      };

      setCustomStrands((prev) => {
        const existingCs = prev.find((s) => s.anchorId === anchorId);
        if (existingCs) {
          return prev.map((s) => (s.anchorId === anchorId ? { ...s, spec } : s));
        }
        return [...prev, { id: uid("cs"), anchorId, spec }];
      });

      // Remove strand/stack at same anchor (mutually exclusive)
      setStrands((prev) => prev.filter((s) => s.anchorId !== anchorId));
      setStacks((prev) => prev.filter((s) => s.anchorId !== anchorId));
      setClusters((prev) => prev.filter((c) => c.anchorId !== anchorId));

      setSelection({ selectedAnchorId: anchorId });
      return anchorId;
    },
    [findAnchorAt, planTools.customBuilder, projectSpecs],
  );

  const beginCopyAnchor = useCallback((anchorId: string) => {
    setPlanTools((prev) => ({ ...prev, pendingCopyAnchorId: anchorId }));
  }, []);

  const placeCopyAt = useCallback(
    (xIn: number, yIn: number) => {
      const sourceId = planTools.pendingCopyAnchorId;
      if (!sourceId) return;

      const sourceAnchor = anchors.find((a) => a.id === sourceId) ?? null;
      if (!sourceAnchor) return;

      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);

      const newAnchorId = uid("a");
      const isFastener = sourceAnchor.holeType === "fastener" || sourceAnchor.type === "canopy_fastener";
      const newAnchor: Anchor = {
        id: newAnchorId,
        xIn: sx,
        yIn: sy,
        type: isFastener ? "canopy_fastener" : "strand",
        holeType: isFastener ? "fastener" : "strand",
        gridCol: col,
        gridRow: row,
      };
      setAnchors((prev) => [...prev, newAnchor]);

      const srcCluster = clusters.find((c) => c.anchorId === sourceId) ?? null;
      const srcCustom = customStrands.find((c) => c.anchorId === sourceId) ?? null;
      const srcStack = stacks.find((s) => s.anchorId === sourceId) ?? null;
      const srcStrand = strands.find((s) => s.anchorId === sourceId) ?? null;

      if (srcCluster) {
        setClusters((prev) => [...prev, { id: uid("cl"), anchorId: newAnchorId, spec: { ...srcCluster.spec } }]);
      } else if (srcCustom) {
        setCustomStrands((prev) => [...prev, { id: uid("cs"), anchorId: newAnchorId, spec: { ...srcCustom.spec } }]);
      } else if (srcStack) {
        setStacks((prev) => [...prev, { id: uid("stk"), anchorId: newAnchorId, spec: { ...srcStack.spec } }]);
      } else if (srcStrand) {
        setStrands((prev) => [...prev, { id: uid("st"), anchorId: newAnchorId, spec: { ...srcStrand.spec } }]);
      }

      setSelection({ selectedAnchorId: newAnchorId });
      setPlanTools((prev) => ({ ...prev, pendingCopyAnchorId: null }));
    },
    [anchors, clusters, customStrands, planTools.pendingCopyAnchorId, projectSpecs, stacks, strands],
  );

  const ensureStrandHoleAt = useCallback((xIn: number, yIn: number): string | undefined => {
    const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
    const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
    const existing = findAnchorAt(sx, sy);

    // Never auto-convert a fastener hole into a strand hole.
    if (existing && existing.holeType === "fastener") {
      return undefined;
    }

    let anchorId = existing?.id;
    if (!anchorId) {
      anchorId = uid("a");
      const newAnchor: Anchor = { id: anchorId, xIn: sx, yIn: sy, type: "strand", holeType: "strand", gridCol: col, gridRow: row };
      setAnchors((prev) => [...prev, newAnchor]);
    } else {
      // ensure anchor is marked as a strand-hole (but do NOT create a Strand)
      setAnchors((prev) => prev.map((a) => (a.id === anchorId ? { ...a, type: "strand" as const, holeType: "strand", xIn: sx, yIn: sy, gridCol: col, gridRow: row } : a)));
    }

    return anchorId;
  }, [findAnchorAt, projectSpecs]);

  const placeCanopyFastenerAt = useCallback(
    (xIn: number, yIn: number) => {
      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
      const existing = findAnchorAt(sx, sy);

      if (!existing) {
        const anchorId = uid("a");
        const newAnchor: Anchor = { id: anchorId, xIn: sx, yIn: sy, type: "canopy_fastener", holeType: "fastener", gridCol: col, gridRow: row };
        setAnchors((prev) => [...prev, newAnchor]);
        setSelection({ selectedAnchorId: anchorId });
        return;
      }

      // convert existing anchor into fastener (and remove any strand at it)
      setAnchors((prev) =>
        prev.map((a) => (a.id === existing.id ? { ...a, type: "canopy_fastener" as const, holeType: "fastener", xIn: sx, yIn: sy, gridCol: col, gridRow: row } : a)),
      );
      setStrands((prev) => prev.filter((s) => s.anchorId !== existing.id));
      setStacks((prev) => prev.filter((s) => s.anchorId !== existing.id));
      setCustomStrands((prev) => prev.filter((s) => s.anchorId !== existing.id));
      setClusters((prev) => prev.filter((c) => c.anchorId !== existing.id));
      // Also remove any swoops that reference this hole; fastener holes cannot be swoop endpoints
      setSwoops((prev) => prev.filter((sw) => sw.aHoleId !== existing.id && sw.bHoleId !== existing.id));
      // If a swoop was mid-placement using this hole as the start, clear the pending state
      setPlanTools((prev) => (prev.pendingSwoopStartHoleId === existing.id ? { ...prev, pendingSwoopStartHoleId: null } : prev));
      setSelection({ selectedAnchorId: existing.id });
    },
    [findAnchorAt, projectSpecs],
  );

    const onSwoopAnchorClick = useCallback(
      (anchorId: string) => {
        // Only handle when in swoop placement mode
        if (planTools.mode !== "place_swoop") return;

        // Guard: fastener holes cannot be swoop endpoints
        const endAnchor = anchors.find((a) => a.id === anchorId) ?? null;
        if (endAnchor?.holeType === "fastener") {
          return;
        }

        const start = planTools.pendingSwoopStartHoleId ?? null;
        if (!start) {
          // set start
          setPlanTools((prev) => ({ ...prev, pendingSwoopStartHoleId: anchorId }));
          return;
        }

        // Start might have turned into a fastener hole after it was picked
        const startAnchor = anchors.find((a) => a.id === start) ?? null;
        if (!startAnchor || startAnchor.holeType === "fastener") {
          setPlanTools((prev) => ({ ...prev, pendingSwoopStartHoleId: anchorId }));
          return;
        }

        // if clicking same anchor, clear pending
        if (start === anchorId) {
          setPlanTools((prev) => ({ ...prev, pendingSwoopStartHoleId: null }));
          return;
        }

        // create swoop connecting start -> anchorId
        const spec = { ...(planTools.draftSwoop ?? { sphereCount: 6, chainAIn: 12, chainBIn: 12, sagIn: 4, colorId: undefined }) };
        const swoop = { id: uid("sw"), aHoleId: start, bHoleId: anchorId, spec };
        setSwoops((prev) => [...prev, swoop]);
        // clear pending
        setPlanTools((prev) => ({ ...prev, pendingSwoopStartHoleId: null }));
      },
      [anchors, planTools, setSwoops],
    );

  const moveAnchor = useCallback(
    (anchorId: string, xIn: number, yIn: number) => {
      // Compute grid index from pointer position, then reproject to world using grid index.
      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
      setAnchors((prev) => prev.map((a) => (a.id === anchorId ? { ...a, xIn: sx, yIn: sy, gridCol: col, gridRow: row } : a)));
      // selection stays
    },
    [projectSpecs],
  );

  const movePile = useCallback(
    (pileId: string, xIn: number, yIn: number) => {
      const { col, row } = snapToGridIndex(xIn, yIn, projectSpecs);
      const { xIn: sx, yIn: sy } = gridIndexToWorld(col, row, projectSpecs);
      setPiles((prev) => prev.map((p) => (p.id === pileId ? { ...p, xIn: sx, yIn: sy } : p)));
    },
    [projectSpecs],
  );

  const deleteSelected = useCallback(() => {
    const anchorId = selection.selectedAnchorId ?? null;
    const swoopId = selection.selectedSwoopId ?? null;
    const pileId = selection.selectedPileId ?? null;

    if (swoopId) {
      setSwoops((prev) => prev.filter((sw) => sw.id !== swoopId));
      setSelection({ selectedAnchorId: null, selectedSwoopId: null, selectedPileId: null });
      return;
    }

    if (pileId) {
      setPiles((prev) => prev.filter((p) => p.id !== pileId));
      setSelection({ selectedAnchorId: null, selectedSwoopId: null, selectedPileId: null });
      return;
    }

    if (!anchorId) return;

    setAnchors((prev) => prev.filter((a) => a.id !== anchorId));
    setStrands((prev) => prev.filter((s) => s.anchorId !== anchorId));
    setStacks((prev) => prev.filter((s) => s.anchorId !== anchorId));
    setCustomStrands((prev) => prev.filter((s) => s.anchorId !== anchorId));
    setClusters((prev) => prev.filter((c) => c.anchorId !== anchorId));
    // Remove any swoops that reference this anchor
    setSwoops((prev) => prev.filter((sw) => sw.aHoleId !== anchorId && sw.bHoleId !== anchorId));
    // Clear mid-placement swoop if needed
    setPlanTools((prev) => (prev.pendingSwoopStartHoleId === anchorId ? { ...prev, pendingSwoopStartHoleId: null } : prev));
    setSelection({ selectedAnchorId: null, selectedSwoopId: null, selectedPileId: null });
  }, [selection]);

  const onMenuAction = useCallback(
    (action: MenuAction) => {
      if (action === "save") {
          const payload = {
            projectSpecs,
            planTools: { ...planTools, pendingSwoopStartHoleId: null },
            palette,
            anchors,
            strands,
            stacks,
            piles,
            clusters,
            swoops,
            customStrands,
            notes,
            showLabels,
            // keep top-level copies for backwards compat with older saved files
            planView,
            frontView,
            views: { planView, frontView },
          };
          exportProjectJson(payload, projectSpecs?.projectName ?? "untitled");
        return;
      }
        if (action === "csv") {
          try {
            exportProjectCsv({ projectName: projectSpecs?.projectName, projectSpecs, anchors, strands, stacks, piles, customStrands, clusters, notes });
                } catch (e) {
                  console.error('CSV export failed', e);
                  alert('CSV export failed: ' + String((e as any)?.message || e));
                }
          return;
        }
        if (action === "dxf") {
          try {
            exportProjectDxf({ projectName: projectSpecs?.projectName, projectSpecs, anchors });
          } catch (e) {
            console.error('DXF export failed', e);
            alert('DXF export failed: ' + String((e as any)?.message || e));
          }
          return;
        }
        if (action === "export_3d_zip") {
          try {
            // Export ZIP containing layout JSON + GLB (use default filename when project name missing)
          export3dZip({ projectSpecs, anchors, strands, stacks, customStrands });
          } catch (e) {
            console.error('3D export failed', e);
            alert('3D export failed: ' + String((e as any)?.message || e));
          }
          return;
        }
      // Export buttons will be implemented later.
      alert(`Not implemented yet: ${action.toUpperCase()}`);
    },
      [anchors, clusters, customStrands, frontView, notes, palette, piles, planTools, planView, projectSpecs, showLabels, strands, stacks, swoops],
    );

  const setProjectSpecs = useCallback((patch: Partial<ProjectSpecs>) => {
    setProjectSpecsState((prevSpecs) => {
      const oldSpecs = prevSpecs;
      const nextSpecs: ProjectSpecs = { ...prevSpecs, ...patch } as ProjectSpecs;

      const gridRelatedChanged =
        (patch.boundaryWidthIn !== undefined && patch.boundaryWidthIn !== oldSpecs.boundaryWidthIn) ||
        (patch.boundaryHeightIn !== undefined && patch.boundaryHeightIn !== oldSpecs.boundaryHeightIn) ||
        (patch.gridSpacingIn !== undefined && patch.gridSpacingIn !== oldSpecs.gridSpacingIn);

      if (gridRelatedChanged) {
        setAnchors((prevAnchors) =>
          prevAnchors.map((a) => {
            if (a.gridCol != null && a.gridRow != null) {
              const { xIn, yIn } = gridIndexToWorld(a.gridCol, a.gridRow, nextSpecs);
              return { ...a, xIn, yIn };
            }
            // no grid indices: compute using old specs, then reproject to new specs
            const { col, row } = snapToGridIndex(a.xIn, a.yIn, oldSpecs);
            const { xIn, yIn } = gridIndexToWorld(col, row, nextSpecs);
            return { ...a, gridCol: col, gridRow: row, xIn, yIn };
          }),
        );
      }

      return nextSpecs;
    });
  }, []);

  const setPreviewDepthPatch = useCallback((patch: Partial<ProjectSpecs["previewDepth"]>) => {
    setProjectSpecsState((prev) => ({
      ...prev,
      previewDepth: {
        ...(prev.previewDepth ?? (DEFAULT_SPECS.previewDepth as NonNullable<ProjectSpecs["previewDepth"]>)),
        ...patch,
      },
    }));
  }, []);

  const setPreviewViewPatch = useCallback((patch: Partial<ProjectSpecs["previewView"]>) => {
    setProjectSpecsState((prev) => ({
      ...prev,
      previewView: {
        ...(prev.previewView ?? (DEFAULT_SPECS.previewView as NonNullable<ProjectSpecs["previewView"]>)),
        ...patch,
      },
    }));
  }, []);

  const setPricingPatch = useCallback((patch: Partial<PricingDefaults>) => {
    setProjectSpecsState((prev) => ({
      ...prev,
      pricing: {
        ...(prev.pricing ?? (DEFAULT_SPECS.pricing as NonNullable<ProjectSpecs["pricing"]>)),
        ...patch,
      },
    }));
  }, []);

  const setMaterialsPatch = useCallback((patch: Partial<MaterialsDefaults>) => {
    setProjectSpecsState((prev) => ({
      ...prev,
      materials: {
        ...(prev.materials ?? (DEFAULT_SPECS.materials as NonNullable<ProjectSpecs["materials"]>)),
        ...patch,
      },
    }));
  }, []);

  const setQuotePatch = useCallback((patch: Partial<QuoteSettings>) => {
    setProjectSpecsState((prev) => ({
      ...prev,
      quote: {
        ...(prev.quote ?? (DEFAULT_SPECS.quote as NonNullable<ProjectSpecs["quote"]>)),
        ...patch,
      },
    }));
  }, []);

  const setDueDate = useCallback((next: string) => {
    setProjectSpecsState((prev) => ({ ...prev, dueDate: next }));
  }, []);

  const setDraftStrand = useCallback((patch: Partial<StrandSpec>) => {
    setPlanTools((prev) => ({ ...prev, draftStrand: { ...prev.draftStrand, ...patch } }));
  }, []);

  const setDraftStack = useCallback((patch: Partial<StackSpec>) => {
    setPlanTools((prev) => ({ ...prev, draftStack: { ...prev.draftStack, ...patch } }));
  }, []);

  const setPileBuilderPatch = useCallback((patch: Partial<PileBuilderState>) => {
    setPlanTools((prev) => ({ ...prev, pileBuilder: { ...prev.pileBuilder, ...patch } }));
  }, []);

  const setClusterBuilderPatch = useCallback((patch: Partial<ClusterBuilderState>) => {
    setPlanTools((prev) => ({ ...prev, clusterBuilder: { ...prev.clusterBuilder, ...patch } }));
  }, []);

  const setDraftSwoop = useCallback((patch: Partial<SwoopSpec>) => {
    setPlanTools((prev) => ({ ...prev, draftSwoop: { ...prev.draftSwoop, ...patch } }));
  }, []);

  const setCustomBuilderPatch = useCallback((patch: Partial<CustomStrandBuilderState>) => {
    setPlanTools((prev) => ({ ...prev, customBuilder: { ...prev.customBuilder, ...patch } }));
  }, []);

  const appendCustomNode = useCallback((node: CustomStrandNode) => {
    setPlanTools((prev) => ({
      ...prev,
      customBuilder: {
        ...prev.customBuilder,
        nodes: [...(prev.customBuilder?.nodes ?? []), node],
      },
    }));
  }, []);

  const removeLastCustomNode = useCallback(() => {
    setPlanTools((prev) => ({
      ...prev,
      customBuilder: {
        ...prev.customBuilder,
        nodes: (prev.customBuilder?.nodes ?? []).slice(0, -1),
      },
    }));
  }, []);

  const generatePileSpheres = useCallback(() => {
    setPlanTools((prev) => {
      const count = Math.max(0, Math.floor(prev.pileBuilder?.sphereCount ?? 0));
      const radius = Math.max(0, prev.pileBuilder?.radiusIn ?? 0);
      const colorId = prev.pileBuilder?.colorId ?? DEFAULT_PALETTE[0]?.id ?? "c1";

      const spheres: PileSphereSpec[] = [];
      for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius; // uniform-ish in area
        spheres.push({
          offsetXIn: r * Math.cos(t),
          offsetYIn: r * Math.sin(t),
          zIn: 0,
          colorId,
        });
      }

      return {
        ...prev,
        pileBuilder: {
          ...prev.pileBuilder,
          spheres,
          selectedIndex: spheres.length ? 0 : null,
          showPreview: true,
        },
      };
    });
  }, []);

  const appendPileSphere = useCallback(() => {
    setPlanTools((prev) => {
      const colorId = prev.pileBuilder?.colorId ?? DEFAULT_PALETTE[0]?.id ?? "c1";
      const spheres = [...(prev.pileBuilder?.spheres ?? [])];
      spheres.push({ offsetXIn: 0, offsetYIn: 0, zIn: 0, colorId });
      return {
        ...prev,
        pileBuilder: {
          ...prev.pileBuilder,
          spheres,
          selectedIndex: spheres.length - 1,
          showPreview: true,
        },
      };
    });
  }, []);

  const updatePileSphere = useCallback((index: number, patch: Partial<PileSphereSpec>) => {
    setPlanTools((prev) => ({
      ...prev,
      pileBuilder: {
        ...prev.pileBuilder,
        spheres: (prev.pileBuilder?.spheres ?? []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
      },
    }));
  }, []);

  const removePileSphere = useCallback((index: number) => {
    setPlanTools((prev) => {
      const spheres = (prev.pileBuilder?.spheres ?? []).filter((_, i) => i !== index);
      const sel = prev.pileBuilder?.selectedIndex ?? null;
      let nextSel: number | null = sel;
      if (sel === index) nextSel = null;
      else if (sel != null && sel > index) nextSel = sel - 1;
      return {
        ...prev,
        pileBuilder: {
          ...prev.pileBuilder,
          spheres,
          selectedIndex: nextSel,
        },
      };
    });
  }, []);

  const patchStrandAtAnchor = useCallback((anchorId: string, patch: Partial<StrandSpec>) => {
    setStrands((prev) => prev.map((s) => (s.anchorId === anchorId ? { ...s, spec: { ...s.spec, ...patch } } : s)));
  }, []);

  const patchStackAtAnchor = useCallback((anchorId: string, patch: Partial<StackSpec>) => {
    setStacks((prev) => prev.map((s) => (s.anchorId === anchorId ? { ...s, spec: { ...s.spec, ...patch } } : s)));
  }, []);

  const patchClusterAtAnchor = useCallback((anchorId: string, patch: Partial<ClusterSpec>) => {
    setClusters((prev) => prev.map((c) => (c.anchorId === anchorId ? { ...c, spec: { ...c.spec, ...patch } } : c)));
  }, []);

  const appendClusterStrand = useCallback((strand: ClusterStrandSpec) => {
    setPlanTools((prev) => ({
      ...prev,
      clusterBuilder: {
        ...prev.clusterBuilder,
        strands: [...(prev.clusterBuilder?.strands ?? []), strand],
        selectedIndex: (prev.clusterBuilder?.strands ?? []).length,
      },
    }));
  }, []);

  const updateClusterStrand = useCallback((index: number, patch: Partial<ClusterStrandSpec>) => {
    setPlanTools((prev) => ({
      ...prev,
      clusterBuilder: {
        ...prev.clusterBuilder,
        strands: (prev.clusterBuilder?.strands ?? []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
      },
    }));
  }, []);

  const removeClusterStrand = useCallback((index: number) => {
    setPlanTools((prev) => ({
      ...prev,
      clusterBuilder: {
        ...prev.clusterBuilder,
        strands: (prev.clusterBuilder?.strands ?? []).filter((_, i) => i !== index),
        selectedIndex: prev.clusterBuilder.selectedIndex === index ? null : (prev.clusterBuilder.selectedIndex != null && prev.clusterBuilder.selectedIndex > index ? prev.clusterBuilder.selectedIndex - 1 : prev.clusterBuilder.selectedIndex),
      },
    }));
  }, []);

  const patchCustomStrandAtAnchor = useCallback((anchorId: string, patch: Partial<CustomStrandSpec>) => {
    setCustomStrands((prev) => prev.map((s) => (s.anchorId === anchorId ? { ...s, spec: { ...s.spec, ...patch } } : s)));
  }, []);

  const setMode = useCallback((mode: ToolMode) => {
    setPlanTools((prev) => ({ ...prev, mode, pendingCopyAnchorId: mode === "copy_anchor" ? prev.pendingCopyAnchorId : null }));
  }, []);

  const setNotesPatch = useCallback((patch: Partial<NotesState>) => {
    setNotes((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadSnapshot = useCallback((snapshot: any) => {
    // snapshot is expected to be a parsed project state (merged with defaults by importer)
    try {
      if (snapshot.palette) setPalette(snapshot.palette);
      if (snapshot.projectSpecs) setProjectSpecsState((prev) => ({ ...prev, ...snapshot.projectSpecs }));
      if (snapshot.planTools) {
        setPlanTools((prev) => ({
          ...prev,
          ...(snapshot.planTools as PlanToolsState),
          // Never resume mid-click swoop placement from a saved file
          pendingSwoopStartHoleId: null,
          customBuilder: {
            ...(prev.customBuilder ?? makeDefaultCustomBuilder(snapshot.palette ?? DEFAULT_PALETTE)),
            ...((snapshot.planTools as any)?.customBuilder ?? {}),
          },
          pileBuilder: {
            ...(prev.pileBuilder ?? makeDefaultPileBuilder(snapshot.palette ?? DEFAULT_PALETTE)),
            ...((snapshot.planTools as any)?.pileBuilder ?? {}),
          },
          clusterBuilder: {
            ...(prev.clusterBuilder ?? makeDefaultClusterBuilder(snapshot.palette ?? DEFAULT_PALETTE)),
            ...((snapshot.planTools as any)?.clusterBuilder ?? {}),
          },
        }));
      }
      if (Array.isArray(snapshot.anchors)) setAnchors(snapshot.anchors as Anchor[]);
      if (Array.isArray(snapshot.strands)) setStrands(snapshot.strands as Strand[]);
      if (Array.isArray(snapshot.stacks)) setStacks(snapshot.stacks as Stack[]);
      if (Array.isArray(snapshot.piles)) setPiles(snapshot.piles as Pile[]);
      if (Array.isArray(snapshot.clusters)) setClusters(snapshot.clusters as Cluster[]);
      if (Array.isArray(snapshot.swoops)) setSwoops(snapshot.swoops as Swoop[]);
      if (Array.isArray(snapshot.customStrands)) setCustomStrands(snapshot.customStrands as CustomStrand[]);
      if (typeof snapshot.showLabels === "boolean") setShowLabels(snapshot.showLabels);
      const v = snapshot.views ?? {};
      const pv = v.planView ?? snapshot.planView;
      const fv = v.frontView ?? snapshot.frontView;
      if (pv) setPlanView(pv as ViewTransform);
      if (fv) setFrontView(fv as ViewTransform);
      if (snapshot.notes) setNotes(snapshot.notes as NotesState);
      // Clear selection/undo history by resetting selection to default
      setSelection({ selectedAnchorId: null, selectedSwoopId: null, selectedPileId: null });
    } catch (e) {
      console.error('loadSnapshot failed', e);
      throw e;
    }
  }, [setPlanTools, setProjectSpecsState]);

  const clearPlanCursor = useCallback(() => setPlanCursor(null), []);

  const formatCursor = useCallback(
    (c: CursorState | null) => {
      if (!c || !c.inside) return "Cursor: —";
      const w = projectSpecs.boundaryWidthIn;
      const h = projectSpecs.boundaryHeightIn;
      const L = round(c.xIn, 2);
      const T = round(c.yIn, 2);
      const R = round(w - c.xIn, 2);
      const B = round(h - c.yIn, 2);
      return `Cursor L:${L}"  T:${T}"  R:${R}"  B:${B}"`;
    },
    [projectSpecs.boundaryHeightIn, projectSpecs.boundaryWidthIn],
  );

  return {
    // state
    palette,
    projectSpecs,
    planTools,
    anchors,
    strands,
    stacks,
    piles,
    clusters,
    swoops,
    customStrands,
    selection,
    showLabels,
    planView,
    frontView,
    planCursor,
    notes,

    // derived helpers
    offsets,
    formatCursor,

    // actions
    onMenuAction,
    setProjectSpecs,
    setDraftStrand,
    setDraftStack,
    setPileBuilderPatch,
    setClusterBuilderPatch,
    setCustomBuilderPatch,
    setDraftSwoop,
    patchStrandAtAnchor,
    patchStackAtAnchor,
    patchPileById,
    patchClusterAtAnchor,
    patchCustomStrandAtAnchor,
    patchSwoopById,
    setMode,
    setPlanTools,
    setSwoops,
    setStacks,
    setPiles,
    setClusters,
    setCustomStrands,

    setShowLabels,

    selectAnchor,
    clearSelection,
    deleteSelected,

    placeStrandAt,
    placeStackAt,
    placePileAt,
    placeClusterAt,
    placeCustomStrandAt,
    beginCopyAnchor,
    placeCopyAt,
    placeCanopyFastenerAt,
    onSwoopAnchorClick,
    ensureStrandHoleAt,
    selectSwoop,
    selectPile,
    moveAnchor,
    movePile,

    setPlanView,
    setFrontView,
    // setBackView removed

    setPlanCursor,
    clearPlanCursor,

    setNotesPatch,
    setPreviewDepthPatch,
    setPreviewViewPatch,
    setPricingPatch,
    setMaterialsPatch,
    setQuotePatch,
    setDueDate,
    loadSnapshot,
    appendCustomNode,
    removeLastCustomNode,
    appendClusterStrand,
    updateClusterStrand,
    removeClusterStrand,
    generatePileSpheres,
    appendPileSphere,
    updatePileSphere,
    removePileSphere,
  };
}
