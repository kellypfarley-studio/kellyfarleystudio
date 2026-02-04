import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Anchor,
  Cluster,
  ClusterBuilderState,
  ClusterSpec,
  ClusterStrandSpec,
  CursorState,
  CustomStrand,
  CustomStrandBuilderState,
  CustomStrandSpec,
  PaletteColor,
  PlanToolsState,
  Pile,
  PileBuilderState,
  PileSpec,
  PileSphereSpec,
  Stack,
  StackSpec,
  Strand,
  StrandSpec,
  ToolMode,
  Swoop,
  SwoopSpec,
} from "../types/appTypes";
import { computeClusterLayout } from "../utils/clusterLayout";

export type PlanViewToolsBarProps = {
  tools: PlanToolsState;
  palette: PaletteColor[];
  sphereDiameterIn: number;
  cursor: CursorState | null;
  cursorText: string;
  selectedAnchor?: Anchor | null;
  selectedStrand?: Strand | null;
  selectedStack?: Stack | null;
  selectedPile?: Pile | null;
  selectedCluster?: Cluster | null;
  selectedCustomStrand?: CustomStrand | null;
  selectedSwoop?: Swoop | null;
  onPatchSelectedStrand?: (patch: Partial<StrandSpec>) => void;
  onPatchSelectedStack?: (patch: Partial<StackSpec>) => void;
  onPatchSelectedPile?: (patch: Partial<PileSpec>) => void;
  onPatchSelectedCluster?: (patch: Partial<ClusterSpec>) => void;
  onPatchSelectedCustomStrand?: (patch: Partial<CustomStrandSpec>) => void;
  onPatchSelectedSwoop?: (patch: Partial<SwoopSpec>) => void;
  onMode: (mode: ToolMode) => void;
  onDraftPatch: (patch: Partial<PlanToolsState["draftStrand"]>) => void;
  onDraftStackPatch: (patch: Partial<PlanToolsState["draftStack"]>) => void;
  pileBuilder: PileBuilderState;
  onPileBuilderPatch: (patch: Partial<PileBuilderState>) => void;
  onGeneratePileSpheres: () => void;
  onAppendPileSphere: () => void;
  onUpdatePileSphere: (index: number, patch: Partial<PileSphereSpec>) => void;
  onRemovePileSphere: (index: number) => void;
  clusterBuilder: ClusterBuilderState;
  onClusterBuilderPatch: (patch: Partial<ClusterBuilderState>) => void;
  onAppendClusterStrand: (strand: ClusterStrandSpec) => void;
  onUpdateClusterStrand: (index: number, patch: Partial<ClusterStrandSpec>) => void;
  onRemoveClusterStrand: (index: number) => void;
  customBuilder: CustomStrandBuilderState;
  onCustomBuilderPatch: (patch: Partial<CustomStrandBuilderState>) => void;
  onAppendCustomNode: (node: CustomStrandBuilderState["nodes"][number]) => void;
  onRemoveLastCustomNode: () => void;
  onDraftSwoopPatch?: (patch: Partial<SwoopSpec>) => void;
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PlanViewToolsBar(props: PlanViewToolsBarProps) {
  const { tools } = props;
  const [linkAB, setLinkAB] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(true);

  const selectedStrandSummary = useMemo(() => {
    const s = props.selectedStrand;
    if (!s) return "";
    const n = s.spec.sphereCount;
    const top = s.spec.topChainLengthIn;
    const bottom = s.spec.bottomChainLengthIn;
    return `Selected strand → spheres: ${n}, top chain: ${top}", bottom chain: ${bottom}"`;
  }, [props.selectedStrand]);

  const selectedStackSummary = useMemo(() => {
    const s = props.selectedStack;
    if (!s) return "";
    const n = s.spec.sphereCount;
    const top = s.spec.topChainLengthIn;
    const bottom = s.spec.bottomChainLengthIn;
    return `Selected stack → spheres: ${n}, top chain: ${top}", bottom chain: ${bottom}"`;
  }, [props.selectedStack]);

  const selectedPileSummary = useMemo(() => {
    const p = props.selectedPile;
    if (!p) return "";
    const n = p.spec?.spheres?.length ?? 0;
    const r = p.spec?.radiusIn ?? 0;
    return `Selected pile → spheres: ${n}, radius: ${r}"`;
  }, [props.selectedPile]);

  const selectedClusterSummary = useMemo(() => {
    const c = props.selectedCluster;
    if (!c) return "";
    return `Selected cluster → strands: ${c.spec.strands?.length ?? 0}, radius: ${c.spec.itemRadiusIn}", spread: ${c.spec.spreadIn}"`;
  }, [props.selectedCluster]);

  const selectedCustomSummary = useMemo(() => {
    const s = props.selectedCustomStrand;
    if (!s) return "";
    const nodes = s.spec.nodes ?? [];
    const sphereCount = nodes.reduce((acc, n) => acc + (n.type === "chain" ? 0 : (n.sphereCount ?? 0)), 0);
    return `Selected custom strand → nodes: ${nodes.length}, spheres: ${sphereCount}`;
  }, [props.selectedCustomStrand]);

  const selectedSwoopSummary = useMemo(() => {
    const s = props.selectedSwoop;
    if (!s) return "";
    return `Selected swoop → spheres: ${s.spec.sphereCount ?? 0}, chain A: ${s.spec.chainAIn}", chain B: ${s.spec.chainBIn}", sag: ${s.spec.sagIn}"`;
  }, [props.selectedSwoop]);

  const loadPileIntoBuilder = (spec: PileSpec) => {
    const spheres = spec.spheres ?? [];
    const firstColor = spheres[0]?.colorId ?? props.pileBuilder.colorId;
    props.onPileBuilderPatch({
      spheres: spheres.map((s) => ({ ...s })),
      sphereCount: spheres.length || props.pileBuilder.sphereCount,
      radiusIn: spec.radiusIn ?? props.pileBuilder.radiusIn,
      colorId: firstColor,
      selectedIndex: spheres.length ? 0 : null,
      showPreview: true,
    });
  };

  const loadClusterIntoBuilder = (spec: ClusterSpec) => {
    const strands = spec.strands ?? [];
    const first = strands[0];
    props.onClusterBuilderPatch({
      strands: [...strands],
      itemRadiusIn: spec.itemRadiusIn,
      spreadIn: spec.spreadIn,
      selectedIndex: strands.length ? 0 : null,
      topChainLengthIn: first?.topChainLengthIn ?? props.clusterBuilder.topChainLengthIn,
      sphereCount: first?.sphereCount ?? props.clusterBuilder.sphereCount,
      bottomSphereCount: first?.bottomSphereCount ?? props.clusterBuilder.bottomSphereCount,
      colorId: first?.colorId ?? props.clusterBuilder.colorId,
      showPreview: true,
    });
  };

  const loadCustomIntoBuilder = (spec: CustomStrandSpec) => {
    const nodes = spec.nodes ?? [];
    const lastStrandColor = [...nodes].reverse().find((n) => n.type === "strand")?.colorId ?? props.customBuilder.strandColorId;
    const lastStackColor = [...nodes].reverse().find((n) => n.type === "stack")?.colorId ?? props.customBuilder.stackColorId;
    props.onCustomBuilderPatch({
      nodes: [...nodes],
      strandColorId: lastStrandColor,
      stackColorId: lastStackColor,
    });
  };

  const instruction = (() => {
    switch (tools.mode) {
      case "select":
        return "Select: click a hole to select. Delete removes selected.";
      case "move_anchor":
        return "Move: click a hole, then click a new position. (Alt disables snap)";
      case "copy_anchor":
        return "Copy: click a hole to copy, then click a new location.";
      case "place_strand":
        return "Strand: set recipe, then click in Plan View to place a hole + strand.";
      case "place_canopy_fastener":
        return "Fastener: places a hole only (for canopy fastening).";
      case "place_swoop":
        return "Swoop: click endpoint A, then endpoint B.";
      case "place_stack":
        return "Stack: set recipe, then click in Plan View to place a hole + stack (no clasp gaps).";
      case "place_pile":
        return "Pile: build a floor pile, then click in Plan View to place it.";
      case "place_custom_strand":
        return "Custom: build nodes, then click in Plan View to place the custom strand.";
      case "place_cluster":
        return "Cluster: set count/size, then click in Plan View to place a shared anchor cluster.";
      default:
        return "";
    }
  })();

  const colorHex = (id: string) => props.palette.find((c) => c.id === id)?.hex ?? "#111";
  const buildPreview = (nodes: CustomStrandBuilderState["nodes"]) => {
    const pxPerIn = 4.0;
    const sphereD = 16;
    const sphereR = sphereD / 2;
    const gapStrand = 6;
    const gapStack = 0;
    const chainStroke = 2;
    const lineX = 30;
    let y = 10;

    const chainSegments: Array<{ y1: number; y2: number }> = [];
    const spheres: Array<{ x: number; y: number; color: string; kind: "strand" | "stack" }> = [];
    const labels: Array<{ x: number; y: number; text: string }> = [];

    nodes.forEach((n) => {
      if (n.type === "chain") {
        const lenPx = Math.max(0, n.lengthIn) * pxPerIn;
        const y1 = y;
        const y2 = y + lenPx;
        chainSegments.push({ y1, y2 });
        labels.push({ x: lineX + 18, y: y1 + (y2 - y1) / 2, text: "chain" });
        y = y2;
      } else if (n.type === "strand") {
        const cnt = Math.max(0, Math.floor(n.sphereCount || 0));
        for (let i = 0; i < cnt; i++) {
          const cy = y + sphereR + i * (sphereD + gapStrand);
          spheres.push({ x: lineX, y: cy, color: colorHex(n.colorId), kind: "strand" });
        }
        if (cnt > 0) {
          labels.push({ x: lineX + 18, y: y + sphereR + ((cnt - 1) * (sphereD + gapStrand)) / 2, text: "strand" });
          y = y + sphereR + (cnt - 1) * (sphereD + gapStrand) + sphereR;
        }
      } else if (n.type === "stack") {
        const cnt = Math.max(0, Math.floor(n.sphereCount || 0));
        for (let i = 0; i < cnt; i++) {
          const cy = y + sphereR + i * (sphereD + gapStack);
          spheres.push({ x: lineX, y: cy, color: colorHex(n.colorId), kind: "stack" });
        }
        if (cnt > 0) {
          labels.push({ x: lineX + 18, y: y + sphereR + ((cnt - 1) * (sphereD + gapStack)) / 2, text: "stack" });
          y = y + sphereR + (cnt - 1) * (sphereD + gapStack) + sphereR;
        }
      }
    });

    const height = Math.max(60, y + 10);
    return { height, chainSegments, spheres, labels, lineX, chainStroke };
  };

  const customNodes = props.customBuilder.nodes ?? [];
  const customPreview = buildPreview(customNodes);

  const chainInvalid = !Number.isFinite(props.customBuilder.chainLengthIn) || props.customBuilder.chainLengthIn <= 0;
  const strandInvalid = !Number.isFinite(props.customBuilder.strandSphereCount) || props.customBuilder.strandSphereCount <= 0;
  const stackInvalid = !Number.isFinite(props.customBuilder.stackSphereCount) || props.customBuilder.stackSphereCount <= 0;

  const clusterTopInvalid = !Number.isFinite(props.clusterBuilder.topChainLengthIn) || props.clusterBuilder.topChainLengthIn <= 0;
  const clusterSphereInvalid = !Number.isFinite(props.clusterBuilder.sphereCount) || props.clusterBuilder.sphereCount <= 0;
  const clusterBottomInvalid = !Number.isFinite(props.clusterBuilder.bottomSphereCount) || props.clusterBuilder.bottomSphereCount < 0;
  const clusterStrands = props.clusterBuilder.strands ?? [];
  const clusterItems = computeClusterLayout(
    { strands: clusterStrands, itemRadiusIn: props.clusterBuilder.itemRadiusIn, spreadIn: props.clusterBuilder.spreadIn },
  );
  const clusterMaxR = Math.max(1, props.clusterBuilder.spreadIn || 1);
  const clusterScale = 60 / clusterMaxR;
  const dragRef = useRef<{ active: boolean; index: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const pileSpheres = props.pileBuilder.spheres ?? [];
  const pileSelectedIndex = props.pileBuilder.selectedIndex;
  const pileMaxR = Math.max(1, props.pileBuilder.radiusIn || 1);
  const pileScale = 60 / pileMaxR;
  const pileDragRef = useRef<{ active: boolean; index: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const pileCountInvalid = !Number.isFinite(props.pileBuilder.sphereCount) || props.pileBuilder.sphereCount <= 0;
  const pileRadiusInvalid = !Number.isFinite(props.pileBuilder.radiusIn) || props.pileBuilder.radiusIn <= 0;
  const pileSelectedSphere = pileSelectedIndex != null ? pileSpheres[pileSelectedIndex] ?? null : null;
  const pileSpherePxR = Math.max(3, Math.min(20, (props.sphereDiameterIn / 2) * pileScale));
  const pileZMax = Math.max(12, props.sphereDiameterIn * 12);

  const pendingPileSettleRef = useRef(false);
  const pileLiveRef = useRef<{ spheres: PileSphereSpec[]; radiusIn: number; auto: boolean }>({
    spheres: pileSpheres,
    radiusIn: props.pileBuilder.radiusIn,
    auto: props.pileBuilder.autoSettleZ,
  });

  useEffect(() => {
    pileLiveRef.current = {
      spheres: pileSpheres,
      radiusIn: props.pileBuilder.radiusIn,
      auto: props.pileBuilder.autoSettleZ,
    };
  }, [pileSpheres, props.pileBuilder.radiusIn, props.pileBuilder.autoSettleZ]);

  const clampXYToRadius = (x: number, y: number, radiusIn: number) => {
    const r = Math.max(0, radiusIn);
    const d = Math.hypot(x, y);
    if (d <= r || d <= 1e-9) return { x, y };
    const k = r / d;
    return { x: x * k, y: y * k };
  };

  const settlePilePhysics = (
    spheresIn: PileSphereSpec[],
    args: {
      radiusIn: number;
      pinnedIndex?: number | null;
      pinnedXY?: { x: number; y: number } | null;
      pinnedZ?: number | null;
      iterations?: number;
      gravityIn?: number;
    },
  ): PileSphereSpec[] => {
    const D = Math.max(0.0001, props.sphereDiameterIn);
    const R = Math.max(0, args.radiusIn);
    const iters = Math.max(0, Math.floor(args.iterations ?? 60));
    const g = Math.max(0, args.gravityIn ?? D * 0.06);

    const pinnedIndex = args.pinnedIndex ?? null;
    const pinnedXY = args.pinnedXY ?? null;
    const pinnedZ = args.pinnedZ;

    const xs = spheresIn.map((s) => (Number.isFinite(s.offsetXIn) ? s.offsetXIn : 0));
    const ys = spheresIn.map((s) => (Number.isFinite(s.offsetYIn) ? s.offsetYIn : 0));
    const zs = spheresIn.map((s) => Math.max(0, Number.isFinite(s.zIn) ? (s.zIn as number) : 0));

    const settleZFor = (index: number) => {
      const x = xs[index] ?? 0;
      const y = ys[index] ?? 0;
      let z = 0;
      for (let j = 0; j < spheresIn.length; j++) {
        if (j === index) continue;
        const dx = x - (xs[j] ?? 0);
        const dy = y - (ys[j] ?? 0);
        const d = Math.hypot(dx, dy);
        if (d >= D) continue;
        const lift = Math.sqrt(Math.max(0, D * D - d * d));
        z = Math.max(z, Math.max(0, zs[j] ?? 0) + lift);
      }
      return z;
    };

    const enforcePinned = () => {
      if (pinnedIndex == null) return;
      if (pinnedXY) {
        const cl = clampXYToRadius(pinnedXY.x, pinnedXY.y, R);
        xs[pinnedIndex] = cl.x;
        ys[pinnedIndex] = cl.y;
      }
      if (typeof pinnedZ === "number") {
        zs[pinnedIndex] = Math.max(0, pinnedZ);
      } else if (pinnedXY) {
        // If z isn't pinned, automatically settle the pinned sphere on top of others.
        zs[pinnedIndex] = settleZFor(pinnedIndex);
      }
    };

    const clampAll = () => {
      for (let i = 0; i < spheresIn.length; i++) {
        zs[i] = Math.max(0, zs[i] ?? 0);
        const cl = clampXYToRadius(xs[i] ?? 0, ys[i] ?? 0, R);
        xs[i] = cl.x;
        ys[i] = cl.y;
      }
    };

    enforcePinned();
    clampAll();

    const eps = 1e-6;
    for (let iter = 0; iter < iters; iter++) {
      // Gravity pass (skip the pinned sphere; it uses settleZFor/pinnedZ instead).
      for (let i = 0; i < spheresIn.length; i++) {
        if (i === pinnedIndex && pinnedXY) continue;
        zs[i] = Math.max(0, (zs[i] ?? 0) - g);
      }

      enforcePinned();

      // Collision pass (3D) — resolve overlaps between spheres.
      for (let i = 0; i < spheresIn.length; i++) {
        for (let j = i + 1; j < spheresIn.length; j++) {
          let dx = (xs[j] ?? 0) - (xs[i] ?? 0);
          let dy = (ys[j] ?? 0) - (ys[i] ?? 0);
          let dz = (zs[j] ?? 0) - (zs[i] ?? 0);
          let dist = Math.hypot(dx, dy, dz);
          if (!Number.isFinite(dist) || dist >= D) continue;

          if (dist < eps) {
            dx = (Math.random() - 0.5) || 0.1;
            dy = (Math.random() - 0.5) || -0.1;
            dz = (Math.random() - 0.5) || 0.2;
            dist = Math.hypot(dx, dy, dz);
          }

          const overlap = D - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          const iPinned = pinnedIndex === i && pinnedXY;
          const jPinned = pinnedIndex === j && pinnedXY;

          if (iPinned && !jPinned) {
            xs[j] = (xs[j] ?? 0) + nx * overlap;
            ys[j] = (ys[j] ?? 0) + ny * overlap;
            zs[j] = (zs[j] ?? 0) + nz * overlap;
          } else if (jPinned && !iPinned) {
            xs[i] = (xs[i] ?? 0) - nx * overlap;
            ys[i] = (ys[i] ?? 0) - ny * overlap;
            zs[i] = (zs[i] ?? 0) - nz * overlap;
          } else {
            const half = overlap * 0.5;
            xs[i] = (xs[i] ?? 0) - nx * half;
            ys[i] = (ys[i] ?? 0) - ny * half;
            zs[i] = (zs[i] ?? 0) - nz * half;
            xs[j] = (xs[j] ?? 0) + nx * half;
            ys[j] = (ys[j] ?? 0) + ny * half;
            zs[j] = (zs[j] ?? 0) + nz * half;
          }
        }
      }

      clampAll();
      enforcePinned();
    }

    return spheresIn.map((s, i) => ({
      ...s,
      offsetXIn: xs[i] ?? 0,
      offsetYIn: ys[i] ?? 0,
      zIn: zs[i] ?? 0,
    }));
  };

  const applyPileSpherePatch = (
    index: number,
    patch: Partial<PileSphereSpec>,
    opts?: { pinZ?: boolean; iterations?: number },
  ) => {
    const live = pileLiveRef.current;
    const base = live.spheres.map((s) => ({ ...s }));
    if (!base[index]) return;

    let next = base.map((s, i) => (i === index ? { ...s, ...patch } : s));

    // Even with physics off, keep the edited sphere inside the pile footprint.
    if ("offsetXIn" in patch || "offsetYIn" in patch) {
      const sp = next[index];
      const cl = clampXYToRadius(sp.offsetXIn ?? 0, sp.offsetYIn ?? 0, live.radiusIn);
      next = next.map((s, i) => (i === index ? { ...s, offsetXIn: cl.x, offsetYIn: cl.y } : s));
    }

    const touchesPos = "offsetXIn" in patch || "offsetYIn" in patch || "zIn" in patch;
    if (!live.auto || !touchesPos) {
      props.onPileBuilderPatch({ spheres: next });
      return;
    }

    const pinned = next[index];
    const pinnedXY = { x: pinned.offsetXIn ?? 0, y: pinned.offsetYIn ?? 0 };
    const pinnedZ = opts?.pinZ ? (pinned.zIn ?? 0) : null;
    const settled = settlePilePhysics(next, {
      radiusIn: live.radiusIn,
      pinnedIndex: index,
      pinnedXY,
      pinnedZ,
      iterations: Math.max(0, Math.floor(opts?.iterations ?? 40)),
    });
    props.onPileBuilderPatch({ spheres: settled });
  };

  useEffect(() => {
    if (!pendingPileSettleRef.current) return;
    pendingPileSettleRef.current = false;
    if (!props.pileBuilder.autoSettleZ) return;
    if (!pileSpheres.length) return;
    const settled = settlePilePhysics(pileSpheres, { radiusIn: props.pileBuilder.radiusIn, iterations: 120 });
    props.onPileBuilderPatch({ spheres: settled });
  }, [pileSpheres, props.pileBuilder.autoSettleZ, props.pileBuilder.radiusIn, props.onPileBuilderPatch, props.sphereDiameterIn]);

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || (ev.target as HTMLElement | null)?.getAttribute?.("contenteditable") === "true";
      if (isTyping) return;

      if (ev.key === "Backspace" || ev.key === "Delete") {
        if (tools.mode === "place_cluster") {
          const idx = props.clusterBuilder.selectedIndex;
          if (idx != null) {
            props.onRemoveClusterStrand(idx);
            ev.preventDefault();
          }
        }
        if (tools.mode === "place_pile") {
          const idx = props.pileBuilder.selectedIndex;
          if (idx != null) {
            props.onRemovePileSphere(idx);
            ev.preventDefault();
          }
        }
      }

      const k = ev.key.toLowerCase();
      if (k === "s") props.onMode("select");
      if (k === "m") props.onMode("move_anchor");
      if (k === "c") props.onMode("copy_anchor");
      if (k === "f") props.onMode("place_canopy_fastener");
      if (k === "r") props.onMode("place_strand");
      if (k === "t") props.onMode("place_stack");
      if (k === "p") props.onMode("place_pile");
      if (k === "w") props.onMode("place_swoop");
      if (k === "u") props.onMode("place_custom_strand");
      if (k === "l") props.onMode("place_cluster");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    tools.mode,
    props.clusterBuilder.selectedIndex,
    props.pileBuilder.selectedIndex,
    props.onRemoveClusterStrand,
    props.onRemovePileSphere,
    props.onMode,
  ]);

  return (
    <div className="card toolsBar pvTools" style={{ paddingBottom: 0 }}>
      <div className="pvToolsRow pvToolsRow--modes">
        <div className="panelTitle">Plan View tools</div>
        <div className="btnGroup" title="Tool mode">
          <button className={tools.mode === "select" ? "active" : ""} onClick={() => props.onMode("select")}>
            Select
          </button>
          <button className={tools.mode === "move_anchor" ? "active" : ""} onClick={() => props.onMode("move_anchor")}>
            Move
          </button>
          <button className={tools.mode === "copy_anchor" ? "active" : ""} onClick={() => props.onMode("copy_anchor")}>
            Copy
          </button>
        </div>
      </div>

      <div className="pvToolsRow pvToolsRow--builders">
        <div className="btnGroup" title="Builder tools">
          <button className={tools.mode === "place_canopy_fastener" ? "active" : ""} onClick={() => props.onMode("place_canopy_fastener")}>
            Fastener
          </button>
          <button className={tools.mode === "place_strand" ? "active" : ""} onClick={() => props.onMode("place_strand")}>
            Strand
          </button>
          <button className={tools.mode === "place_stack" ? "active" : ""} onClick={() => props.onMode("place_stack")}>
            Stack
          </button>
          <button className={tools.mode === "place_pile" ? "active" : ""} onClick={() => props.onMode("place_pile")}>
            Pile
          </button>
          <button className={tools.mode === "place_swoop" ? "active" : ""} onClick={() => props.onMode("place_swoop")}>
            Swoop
          </button>
          <button className={tools.mode === "place_custom_strand" ? "active" : ""} onClick={() => props.onMode("place_custom_strand")}>
            Custom
          </button>
          <button className={tools.mode === "place_cluster" ? "active" : ""} onClick={() => props.onMode("place_cluster")}>
            Cluster
          </button>
        </div>
      </div>

      <div className="planToolsHint">
        Mode shortcuts: <span className="kbd">S</span> Select · <span className="kbd">M</span> Move · <span className="kbd">C</span> Copy
        <span className="hintSpacer">|</span>
        Builder shortcuts: <span className="kbd">F</span> Fastener · <span className="kbd">R</span> Strand · <span className="kbd">T</span> Stack · <span className="kbd">P</span> Pile · <span className="kbd">W</span> Swoop · <span className="kbd">U</span> Custom · <span className="kbd">L</span> Cluster
      </div>

      {tools.mode === "select" && (props.selectedAnchor || props.selectedStrand || props.selectedStack || props.selectedPile || props.selectedCluster || props.selectedCustomStrand || props.selectedSwoop) ? (
        <div className="pvToolsRow" style={{ paddingTop: 0 }}>
          <div className="smallLabel" style={{ marginRight: 12 }}>
            {props.selectedAnchor ? `Selected hole: ${props.selectedAnchor.label ?? props.selectedAnchor.id}` : ""}
          </div>
          {props.selectedStrand ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedStrandSummary}</div>
              <div className="field">
                <span className="smallLabel">Color</span>
                <select
                  value={props.selectedStrand.spec.colorId ?? props.palette[0]?.id ?? ""}
                  onChange={(e) => props.onPatchSelectedStrand?.({ colorId: e.target.value })}
                >
                  {props.palette.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.id}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          {props.selectedStack ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedStackSummary}</div>
              <div className="field">
                <span className="smallLabel">Color</span>
                <select
                  value={props.selectedStack.spec.colorId ?? props.palette[0]?.id ?? ""}
                  onChange={(e) => props.onPatchSelectedStack?.({ colorId: e.target.value })}
                >
                  {props.palette.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.id}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          {props.selectedPile ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedPileSummary}</div>
            </>
          ) : null}
          {props.selectedCluster ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedClusterSummary}</div>
            </>
          ) : null}
          {props.selectedCustomStrand ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedCustomSummary}</div>
            </>
          ) : null}
          {props.selectedSwoop ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedSwoopSummary}</div>
            </>
          ) : null}
        </div>
      ) : null}

      {tools.mode === "select" && props.selectedSwoop ? (
        <div className="pvToolsRow">
          <div className="field">
            <span className="smallLabel">Sphere Count</span>
            <input
              value={props.selectedSwoop.spec.sphereCount}
              onChange={(e) => props.onPatchSelectedSwoop?.({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
              style={{ width: 62 }}
            />
          </div>
          <div className="field">
            <span className="smallLabel">Chain A</span>
            <input
              value={props.selectedSwoop.spec.chainAIn}
              onChange={(e) => props.onPatchSelectedSwoop?.({ chainAIn: Math.max(0, num(e.target.value)) })}
              style={{ width: 62 }}
            />
            <span className="smallLabel">"</span>
          </div>
          <div className="field">
            <span className="smallLabel">Chain B</span>
            <input
              value={props.selectedSwoop.spec.chainBIn}
              onChange={(e) => props.onPatchSelectedSwoop?.({ chainBIn: Math.max(0, num(e.target.value)) })}
              style={{ width: 62 }}
            />
            <span className="smallLabel">"</span>
          </div>
          <div className="field">
            <span className="smallLabel">Sag</span>
            <input
              value={props.selectedSwoop.spec.sagIn}
              onChange={(e) => props.onPatchSelectedSwoop?.({ sagIn: Math.max(0, num(e.target.value)) })}
              style={{ width: 62 }}
            />
            <span className="smallLabel">"</span>
          </div>
          <div className="field">
            <span className="smallLabel">Color</span>
            <select
              value={props.selectedSwoop.spec.colorId ?? props.palette[0]?.id ?? ""}
              onChange={(e) => props.onPatchSelectedSwoop?.({ colorId: e.target.value })}
            >
              {props.palette.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {tools.mode === "select" && props.selectedStrand ? (
        <div className="pvToolsRow">
          <div className="field">
            <span className="smallLabel">Sphere Count</span>
            <input
              value={props.selectedStrand.spec.sphereCount}
              onChange={(e) => props.onPatchSelectedStrand?.({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
              style={{ width: 62 }}
            />
          </div>
          <div className="field">
            <span className="smallLabel">Top Chain</span>
            <input
              value={props.selectedStrand.spec.topChainLengthIn}
              onChange={(e) => props.onPatchSelectedStrand?.({ topChainLengthIn: Math.max(0, num(e.target.value)) })}
              style={{ width: 62 }}
            />
            <span className="smallLabel">"</span>
          </div>
          <div className="field">
            <span className="smallLabel">Bottom Chain</span>
            <input
              value={props.selectedStrand.spec.bottomChainLengthIn}
              onChange={(e) => props.onPatchSelectedStrand?.({ bottomChainLengthIn: Math.max(0, num(e.target.value)) })}
              style={{ width: 62 }}
            />
            <span className="smallLabel">"</span>
          </div>
          <div className="field">
            <span className="smallLabel">Mound</span>
            <select
              value={props.selectedStrand.spec.moundPreset}
              onChange={(e) => props.onPatchSelectedStrand?.({ moundPreset: e.target.value as any })}
            >
              <option value="none">None</option>
              <option value="6">6</option>
              <option value="12">12</option>
              <option value="18">18</option>
              <option value="24">24</option>
              <option value="36">36</option>
            </select>
          </div>
        </div>
      ) : null}

      {tools.mode === "select" && props.selectedStack ? (
        <div className="pvToolsRow">
          <div className="field">
            <span className="smallLabel">Sphere Count</span>
            <input
              value={props.selectedStack.spec.sphereCount}
              onChange={(e) => props.onPatchSelectedStack?.({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
              style={{ width: 62 }}
            />
          </div>
          <div className="field">
            <span className="smallLabel">Top Chain</span>
            <input
              value={props.selectedStack.spec.topChainLengthIn}
              onChange={(e) => props.onPatchSelectedStack?.({ topChainLengthIn: Math.max(0, num(e.target.value)) })}
              style={{ width: 62 }}
            />
            <span className="smallLabel">"</span>
          </div>
          <div className="field">
            <span className="smallLabel">Bottom Chain</span>
            <input
              value={props.selectedStack.spec.bottomChainLengthIn}
              onChange={(e) => props.onPatchSelectedStack?.({ bottomChainLengthIn: Math.max(0, num(e.target.value)) })}
              style={{ width: 62 }}
            />
            <span className="smallLabel">"</span>
          </div>
          <div className="field">
            <span className="smallLabel">Mound</span>
            <select
              value={props.selectedStack.spec.moundPreset}
              onChange={(e) => props.onPatchSelectedStack?.({ moundPreset: e.target.value as any })}
            >
              <option value="none">None</option>
              <option value="6">6</option>
              <option value="12">12</option>
              <option value="18">18</option>
              <option value="24">24</option>
              <option value="36">36</option>
            </select>
          </div>
        </div>
      ) : null}

      {tools.mode === "select" && props.selectedPile ? (
        <div className="pvToolsRow">
          <div className="field">
            <button
              className="btn"
              onClick={() => {
                loadPileIntoBuilder(props.selectedPile!.spec);
                props.onMode("place_pile");
              }}
            >
              Edit in Pile Builder
            </button>
          </div>
          <div className="field">
            <button
              className="btn"
              onClick={() => props.onPatchSelectedPile?.({
                spheres: [...(props.pileBuilder.spheres ?? [])],
                radiusIn: props.pileBuilder.radiusIn,
              })}
              disabled={!props.pileBuilder.spheres?.length}
            >
              Apply Builder to Selected
            </button>
          </div>
        </div>
      ) : null}

      {tools.mode === "select" && props.selectedCluster ? (
        <div className="pvToolsRow">
          <div className="field">
            <button
              className="btn"
              onClick={() => {
                loadClusterIntoBuilder(props.selectedCluster!.spec);
                props.onMode("place_cluster");
              }}
            >
              Edit in Cluster Builder
            </button>
          </div>
          <div className="field">
            <button
              className="btn"
              onClick={() => props.onPatchSelectedCluster?.({
                strands: [...props.clusterBuilder.strands],
                itemRadiusIn: props.clusterBuilder.itemRadiusIn,
                spreadIn: props.clusterBuilder.spreadIn,
              })}
              disabled={!props.clusterBuilder.strands?.length}
            >
              Apply Builder to Selected
            </button>
          </div>
        </div>
      ) : null}

      {tools.mode === "select" && props.selectedCustomStrand ? (
        <div className="pvToolsRow">
          <div className="field">
            <button
              className="btn"
              onClick={() => {
                loadCustomIntoBuilder(props.selectedCustomStrand!.spec);
                setShowCustomBuilder(true);
                props.onMode("place_custom_strand");
              }}
            >
              Edit in Custom Builder
            </button>
          </div>
          <div className="field">
            <button
              className="btn"
              onClick={() => props.onPatchSelectedCustomStrand?.({ nodes: [...props.customBuilder.nodes] })}
              disabled={!props.customBuilder.nodes?.length}
            >
              Apply Builder to Selected
            </button>
          </div>
        </div>
      ) : null}

      {tools.mode === "place_strand" ? (
      <div className="pvToolsRow pvToolsRow--strand">
        <div className="btnGroup" title="Tool mode">
          <button className={tools.mode === "place_strand" ? "active" : ""} onClick={() => props.onMode("place_strand")}>
            Strand
          </button>
        </div>
        <div className="field">
          <span className="smallLabel">Sphere Count</span>
          <input
            value={tools.draftStrand.sphereCount}
            onChange={(e) => props.onDraftPatch({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62 }}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Top Chain</span>
          <input
            value={tools.draftStrand.topChainLengthIn}
            onChange={(e) => props.onDraftPatch({ topChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Bottom Chain</span>
          <input
            value={tools.draftStrand.bottomChainLengthIn}
            onChange={(e) => props.onDraftPatch({ bottomChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Mound</span>
          <select value={tools.draftStrand.moundPreset} onChange={(e) => props.onDraftPatch({ moundPreset: e.target.value as any })}>
            <option value="none">None</option>
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="18">18</option>
            <option value="24">24</option>
            <option value="36">36</option>
          </select>
        </div>

        <div className="field">
          <span className="smallLabel">Color</span>
          <select value={tools.draftStrand.colorId} onChange={(e) => props.onDraftPatch({ colorId: e.target.value })}>
            {props.palette.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.id}
              </option>
            ))}
          </select>
        </div>
      </div>
      ) : null}

      {tools.mode === "place_stack" ? (
      <div className="pvToolsRow pvToolsRow--stack">
        <div className="btnGroup" title="Tool mode">
          <button className={tools.mode === "place_stack" ? "active" : ""} onClick={() => props.onMode("place_stack")}>
            Stack
          </button>
        </div>
        <div className="field">
          <span className="smallLabel">Sphere Count</span>
          <input
            value={tools.draftStack.sphereCount}
            onChange={(e) => props.onDraftStackPatch({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62 }}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Top Chain</span>
          <input
            value={tools.draftStack.topChainLengthIn}
            onChange={(e) => props.onDraftStackPatch({ topChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Bottom Chain</span>
          <input
            value={tools.draftStack.bottomChainLengthIn}
            onChange={(e) => props.onDraftStackPatch({ bottomChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Mound</span>
          <select value={tools.draftStack.moundPreset} onChange={(e) => props.onDraftStackPatch({ moundPreset: e.target.value as any })}>
            <option value="none">None</option>
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="18">18</option>
            <option value="24">24</option>
            <option value="36">36</option>
          </select>
        </div>

        <div className="field">
          <span className="smallLabel">Color</span>
          <select value={tools.draftStack.colorId} onChange={(e) => props.onDraftStackPatch({ colorId: e.target.value })}>
            {props.palette.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.id}
              </option>
            ))}
          </select>
        </div>
      </div>
      ) : null}

      {tools.mode === "place_pile" ? (
      <div className="pvToolsRow pvToolsRow--pile">
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={props.pileBuilder.showPreview}
              onChange={(e) => props.onPileBuilderPatch({ showPreview: e.target.checked })}
            />
            <span className="smallLabel">Show Preview</span>
          </label>
        </div>

        <div className="field">
          <span className="smallLabel">Count</span>
          <input
            value={props.pileBuilder.sphereCount}
            onChange={(e) => props.onPileBuilderPatch({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62, borderColor: pileCountInvalid ? "#ff6666" : undefined }}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Radius</span>
          <input
            value={props.pileBuilder.radiusIn}
            onChange={(e) => {
              const r = Math.max(0, num(e.target.value));
              const clamped = pileSpheres.map((s) => {
                const cl = clampXYToRadius(s.offsetXIn ?? 0, s.offsetYIn ?? 0, r);
                return { ...s, offsetXIn: cl.x, offsetYIn: cl.y };
              });
              pendingPileSettleRef.current = true;
              props.onPileBuilderPatch({ radiusIn: r, spheres: clamped });
            }}
            style={{ width: 62, borderColor: pileRadiusInvalid ? "#ff6666" : undefined }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={props.pileBuilder.autoSettleZ}
              onChange={(e) => {
                pendingPileSettleRef.current = true;
                props.onPileBuilderPatch({ autoSettleZ: e.target.checked });
              }}
            />
            <span className="smallLabel">Physics</span>
          </label>
        </div>

        <div className="field">
          <span className="smallLabel">Color</span>
          <select
            value={pileSelectedSphere?.colorId ?? props.pileBuilder.colorId}
            onChange={(e) => {
              const id = e.target.value;
              if (pileSelectedIndex == null) {
                props.onPileBuilderPatch({ colorId: id });
                return;
              }
              const next = pileSpheres.map((s, i) => (i === pileSelectedIndex ? { ...s, colorId: id } : s));
              props.onPileBuilderPatch({ colorId: id, spheres: next });
            }}
          >
            {props.palette.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.id}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <button
            className="btn"
            onClick={() => {
              pendingPileSettleRef.current = true;
              props.onGeneratePileSpheres();
              props.onPileBuilderPatch({ showPreview: true });
            }}
            disabled={pileCountInvalid || pileRadiusInvalid}
          >
            Generate
          </button>
        </div>

        <div className="field">
          <button
            className="btn"
            onClick={() => {
              pendingPileSettleRef.current = true;
              props.onAppendPileSphere();
              props.onPileBuilderPatch({ showPreview: true });
            }}
          >
            Add Sphere
          </button>
        </div>

        <div className="field">
          <button
            className="btn"
            onClick={() => {
              if (pileSelectedIndex == null) return;
              pendingPileSettleRef.current = true;
              props.onRemovePileSphere(pileSelectedIndex);
            }}
            disabled={pileSelectedIndex == null}
          >
            Remove Selected
          </button>
        </div>
      </div>
      ) : null}

      {tools.mode === "place_pile" ? (
      <div className="pvToolsRow pvToolsRow--pile">
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 6, background: "#fff" }}>
            <div className="smallLabel" style={{ marginBottom: 6 }}>Pile Builder (Top)</div>
            <svg width={160} height={160} viewBox="-80 -80 160 160" style={{ display: "block", touchAction: "none" }}>
              <circle cx={0} cy={0} r={60} fill="none" stroke="#ddd" strokeWidth={1} strokeDasharray="4 3" />
              {pileSpheres.map((sp, idx) => {
                const sel = pileSelectedIndex === idx;
                const x = (sp.offsetXIn ?? 0) * pileScale;
                const y = (sp.offsetYIn ?? 0) * pileScale;
                return (
                  <circle
                    key={`pile-sph-${idx}`}
                    cx={x}
                    cy={y}
                    r={pileSpherePxR}
                    fill={colorHex(sp.colorId)}
                    stroke={sel ? "#ff6666" : "#111"}
                    strokeWidth={sel ? 2 : 1}
                    opacity={1}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      props.onPileBuilderPatch({ selectedIndex: idx, showPreview: true });

                      const svgEl = (ev.currentTarget as SVGCircleElement).ownerSVGElement;
                      if (!svgEl) return;
                      const r2 = svgEl.getBoundingClientRect();
                      const startX = ev.clientX - r2.left - r2.width / 2;
                      const startY = ev.clientY - r2.top - r2.height / 2;
                      pileDragRef.current = {
                        active: true,
                        index: idx,
                        startX,
                        startY,
                        baseX: sp.offsetXIn ?? 0,
                        baseY: sp.offsetYIn ?? 0,
                      };

                      const onMove = (mev: PointerEvent) => {
                        const d = pileDragRef.current;
                        if (!d || !d.active) return;
                        const rr = svgEl.getBoundingClientRect();
                        const mx = mev.clientX - rr.left - rr.width / 2;
                        const my = mev.clientY - rr.top - rr.height / 2;
                        const dx = (mx - d.startX) / pileScale;
                        const dy = (my - d.startY) / pileScale;
                        const nextX = d.baseX + dx;
                        const nextY = d.baseY + dy;
                        applyPileSpherePatch(d.index, { offsetXIn: nextX, offsetYIn: nextY }, { iterations: 12 });
                      };

                      const onUp = (uev: PointerEvent) => {
                        const d = pileDragRef.current;
                        if (d && d.active) {
                          const rr = svgEl.getBoundingClientRect();
                          const mx = uev.clientX - rr.left - rr.width / 2;
                          const my = uev.clientY - rr.top - rr.height / 2;
                          const dx = (mx - d.startX) / pileScale;
                          const dy = (my - d.startY) / pileScale;
                          const nextX = d.baseX + dx;
                          const nextY = d.baseY + dy;
                          applyPileSpherePatch(d.index, { offsetXIn: nextX, offsetYIn: nextY }, { iterations: 160 });
                          d.active = false;
                        }
                        window.removeEventListener("pointermove", onMove);
                        window.removeEventListener("pointerup", onUp);
                      };

                      window.addEventListener("pointermove", onMove);
                      window.addEventListener("pointerup", onUp);
                      (ev.target as Element).setPointerCapture(ev.pointerId);
                    }}
                  />
                );
              })}
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="smallLabel muted">
              {pileSpheres.length ? `${pileSpheres.length} sphere(s) in pile.` : "No pile spheres yet."}
            </div>

            <div className="field">
              <span className="smallLabel">Selected</span>
              <span className="smallLabel">{pileSelectedIndex != null ? `Sphere ${pileSelectedIndex + 1}` : "—"}</span>
            </div>

            <div className="field">
              <span className="smallLabel">Offset X</span>
              <input
                value={pileSelectedSphere?.offsetXIn ?? 0}
                onChange={(e) => {
                  if (pileSelectedIndex == null) return;
                  applyPileSpherePatch(pileSelectedIndex, { offsetXIn: num(e.target.value) }, { iterations: 80 });
                }}
                style={{ width: 62 }}
                disabled={pileSelectedIndex == null}
              />
              <span className="smallLabel">"</span>
            </div>

            <div className="field">
              <span className="smallLabel">Offset Y</span>
              <input
                value={pileSelectedSphere?.offsetYIn ?? 0}
                onChange={(e) => {
                  if (pileSelectedIndex == null) return;
                  applyPileSpherePatch(pileSelectedIndex, { offsetYIn: num(e.target.value) }, { iterations: 80 });
                }}
                style={{ width: 62 }}
                disabled={pileSelectedIndex == null}
              />
              <span className="smallLabel">"</span>
            </div>

            <div className="field">
              <span className="smallLabel">Height (Z)</span>
              <input
                type="range"
                min={0}
                max={pileZMax}
                step={0.25}
                value={pileSelectedSphere?.zIn ?? 0}
                onChange={(e) => {
                  if (pileSelectedIndex == null) return;
                  applyPileSpherePatch(
                    pileSelectedIndex,
                    { zIn: Math.max(0, num(e.target.value)) },
                    { pinZ: true, iterations: 80 },
                  );
                }}
                style={{ width: 140 }}
                disabled={pileSelectedIndex == null}
              />
              <input
                type="number"
                value={pileSelectedSphere?.zIn ?? 0}
                step={0.25}
                onChange={(e) => {
                  if (pileSelectedIndex == null) return;
                  applyPileSpherePatch(
                    pileSelectedIndex,
                    { zIn: Math.max(0, num(e.target.value)) },
                    { pinZ: true, iterations: 80 },
                  );
                }}
                style={{ width: 62 }}
                disabled={pileSelectedIndex == null}
              />
              <span className="smallLabel">"</span>
            </div>

            <div className="field">
              <button
                className="btn"
                onClick={() => {
                  if (!pileSpheres.length) return;
                  const settled = settlePilePhysics(pileSpheres, {
                    radiusIn: props.pileBuilder.radiusIn,
                    iterations: 200,
                  });
                  props.onPileBuilderPatch({ spheres: settled });
                }}
                disabled={!pileSpheres.length}
              >
                Settle Pile
              </button>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {tools.mode === "place_cluster" ? (
      <div className="pvToolsRow pvToolsRow--cluster">
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={props.clusterBuilder.showPreview}
              onChange={(e) => props.onClusterBuilderPatch({ showPreview: e.target.checked })}
            />
            <span className="smallLabel">Show Preview</span>
          </label>
        </div>

        <div className="field">
          <span className="smallLabel">Radius</span>
          <input
            value={props.clusterBuilder.itemRadiusIn}
            onChange={(e) => props.onClusterBuilderPatch({ itemRadiusIn: num(e.target.value) })}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Spread</span>
          <input
            value={props.clusterBuilder.spreadIn}
            onChange={(e) => props.onClusterBuilderPatch({ spreadIn: num(e.target.value) })}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>
      </div>
      ) : null}

      {tools.mode === "place_cluster" ? (
      <div className="pvToolsRow pvToolsRow--cluster">
        <div className="field">
          <span className="smallLabel">Top Chain</span>
          <input
            value={props.clusterBuilder.topChainLengthIn}
            onChange={(e) => props.onClusterBuilderPatch({ topChainLengthIn: num(e.target.value) })}
            style={{ width: 62, borderColor: clusterTopInvalid ? "#ff6666" : undefined }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Spheres</span>
          <input
            value={props.clusterBuilder.sphereCount}
            onChange={(e) => props.onClusterBuilderPatch({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62, borderColor: clusterSphereInvalid ? "#ff6666" : undefined }}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Bottom</span>
          <input
            value={props.clusterBuilder.bottomSphereCount}
            onChange={(e) => props.onClusterBuilderPatch({ bottomSphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62, borderColor: clusterBottomInvalid ? "#ff6666" : undefined }}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Color</span>
          <select
            value={props.clusterBuilder.colorId}
            onChange={(e) => props.onClusterBuilderPatch({ colorId: e.target.value })}
          >
            {props.palette.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.id}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="smallLabel">Offset X</span>
          <input
            value={props.clusterBuilder.selectedIndex != null ? (clusterStrands[props.clusterBuilder.selectedIndex]?.offsetXIn ?? 0) : 0}
            onChange={(e) => {
              const idx = props.clusterBuilder.selectedIndex;
              if (idx == null) return;
              props.onUpdateClusterStrand(idx, { offsetXIn: num(e.target.value) });
            }}
            style={{ width: 62 }}
            disabled={props.clusterBuilder.selectedIndex == null}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Offset Y</span>
          <input
            value={props.clusterBuilder.selectedIndex != null ? (clusterStrands[props.clusterBuilder.selectedIndex]?.offsetYIn ?? 0) : 0}
            onChange={(e) => {
              const idx = props.clusterBuilder.selectedIndex;
              if (idx == null) return;
              props.onUpdateClusterStrand(idx, { offsetYIn: num(e.target.value) });
            }}
            style={{ width: 62 }}
            disabled={props.clusterBuilder.selectedIndex == null}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <button
            className="btn"
            onClick={() => {
              if (clusterTopInvalid || clusterSphereInvalid || clusterBottomInvalid) return;
              props.onAppendClusterStrand({
                topChainLengthIn: props.clusterBuilder.topChainLengthIn,
                sphereCount: props.clusterBuilder.sphereCount,
                bottomSphereCount: props.clusterBuilder.bottomSphereCount,
                colorId: props.clusterBuilder.colorId,
              });
            }}
            disabled={clusterTopInvalid || clusterSphereInvalid || clusterBottomInvalid}
          >
            Add Strand
          </button>
        </div>

        <div className="field">
          <button
            className="btn"
            onClick={() => {
              const idx = props.clusterBuilder.selectedIndex;
              if (idx == null) return;
              props.onUpdateClusterStrand(idx, {
                topChainLengthIn: props.clusterBuilder.topChainLengthIn,
                sphereCount: props.clusterBuilder.sphereCount,
                bottomSphereCount: props.clusterBuilder.bottomSphereCount,
                colorId: props.clusterBuilder.colorId,
              });
            }}
            disabled={props.clusterBuilder.selectedIndex == null}
          >
            Update
          </button>
        </div>
      </div>
      ) : null}

      {tools.mode === "place_cluster" ? (
      <div className="pvToolsRow pvToolsRow--cluster">
        <div className="field">
          <button
            className="btn"
            onClick={() => {
              const idx = props.clusterBuilder.selectedIndex;
              if (idx == null) return;
              props.onRemoveClusterStrand(idx);
            }}
            disabled={props.clusterBuilder.selectedIndex == null}
          >
            Remove Selected
          </button>
        </div>

        <div className="smallLabel muted">
          {clusterStrands.length === 0 ? "No cluster strands yet." : `${clusterStrands.length} strand(s) in cluster.`}
        </div>
      </div>
      ) : null}

      {tools.mode === "place_cluster" && clusterStrands.length > 0 ? (
        <div className="pvToolsRow pvToolsRow--cluster">
          <div className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 6, background: "#fff" }}>
              <div className="smallLabel" style={{ marginBottom: 6 }}>Cluster Preview (Plan)</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <svg
                  width={160}
                  height={160}
                  viewBox="-80 -80 160 160"
                  style={{ display: "block", touchAction: "none" }}
                >
                  {clusterItems.map((it, idx) => {
                    const r = props.clusterBuilder.itemRadiusIn || 1;
                    const sel = props.clusterBuilder.selectedIndex === idx;
                    const offX = clusterStrands[idx]?.offsetXIn ?? 0;
                    const offY = clusterStrands[idx]?.offsetYIn ?? 0;
                    return (
                      <circle
                        key={`cluster-dot-${idx}`}
                        cx={(it.xIn + offX) * clusterScale}
                        cy={(it.yIn + offY) * clusterScale}
                        r={r * clusterScale}
                        fill="none"
                        stroke={sel ? "#ff6666" : "#0077cc"}
                        strokeWidth={sel ? 2 : 1}
                        style={{ cursor: "grab" }}
                        onPointerDown={(ev) => {
                          ev.preventDefault();
                          props.onClusterBuilderPatch({ selectedIndex: idx, topChainLengthIn: clusterStrands[idx].topChainLengthIn, sphereCount: clusterStrands[idx].sphereCount, bottomSphereCount: clusterStrands[idx].bottomSphereCount, colorId: clusterStrands[idx].colorId });

                          const svgEl = ev.currentTarget.ownerSVGElement as SVGSVGElement;
                          if (!svgEl) return;
                          const rect = svgEl.getBoundingClientRect();
                          const px = ev.clientX - rect.left - rect.width / 2;
                          const py = ev.clientY - rect.top - rect.height / 2;

                          dragRef.current = {
                            active: true,
                            index: idx,
                            startX: px,
                            startY: py,
                            baseX: clusterStrands[idx]?.offsetXIn ?? 0,
                            baseY: clusterStrands[idx]?.offsetYIn ?? 0,
                          };

                          const onMove = (mev: PointerEvent) => {
                            const d = dragRef.current;
                            if (!d || !d.active) return;
                            const r2 = svgEl.getBoundingClientRect();
                            const mx = mev.clientX - r2.left - r2.width / 2;
                            const my = mev.clientY - r2.top - r2.height / 2;
                            const dx = (mx - d.startX) / clusterScale;
                            const dy = (my - d.startY) / clusterScale;
                            props.onUpdateClusterStrand(d.index, { offsetXIn: d.baseX + dx, offsetYIn: d.baseY + dy });
                          };

                          const onUp = () => {
                            if (dragRef.current) dragRef.current.active = false;
                            window.removeEventListener("pointermove", onMove);
                            window.removeEventListener("pointerup", onUp);
                          };

                          window.addEventListener("pointermove", onMove);
                          window.addEventListener("pointerup", onUp);
                          (ev.target as Element).setPointerCapture(ev.pointerId);
                        }}
                      />
                    );
                  })}
                </svg>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {clusterStrands.map((s, idx) => (
                    <button
                      key={`cluster-item-${idx}`}
                      className={`btn ${props.clusterBuilder.selectedIndex === idx ? "btnPrimary" : ""}`}
                      onClick={() => props.onClusterBuilderPatch({ selectedIndex: idx, topChainLengthIn: s.topChainLengthIn, sphereCount: s.sphereCount, bottomSphereCount: s.bottomSphereCount, colorId: s.colorId })}
                    >
                      {`Strand ${idx + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="smallLabel muted">
              Click a strand to edit it. Most recent is last.
            </div>
          </div>
        </div>
      ) : null}

      {tools.mode === "place_swoop" ? (
      <div className="pvToolsRow pvToolsRow--swoop">
        <div className="field">
          <span className="smallLabel">Sphere Count</span>
          <input
            value={(tools.draftSwoop?.sphereCount ?? 6)}
            onChange={(e) => props.onDraftSwoopPatch && props.onDraftSwoopPatch({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62 }}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Chain A</span>
          <input
            value={(tools.draftSwoop?.chainAIn ?? 12)}
            onChange={(e) => {
              const v = num(e.target.value);
              if (props.onDraftSwoopPatch) props.onDraftSwoopPatch({ chainAIn: v });
              if (linkAB && props.onDraftSwoopPatch) props.onDraftSwoopPatch({ chainBIn: v });
            }}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Chain B</span>
          <input
            value={(tools.draftSwoop?.chainBIn ?? tools.draftSwoop?.chainAIn ?? 12)}
            onChange={(e) => props.onDraftSwoopPatch && props.onDraftSwoopPatch({ chainBIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={linkAB}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Sag</span>
          <input
            value={(tools.draftSwoop?.sagIn ?? 12)}
            onChange={(e) => props.onDraftSwoopPatch && props.onDraftSwoopPatch({ sagIn: num(e.target.value) })}
            style={{ width: 62 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={linkAB} onChange={(e) => setLinkAB(e.target.checked)} />
            <span className="smallLabel">Link A/B</span>
          </label>
        </div>
      </div>
      ) : null}

      {tools.mode === "place_custom_strand" ? (
      <div className="pvToolsRow pvToolsRow--custom">
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn" onClick={() => setShowCustomBuilder((v) => !v)}>
            {showCustomBuilder ? "Hide Builder" : "Show Builder"}
          </button>
          {!showCustomBuilder ? <span className="smallLabel muted">Custom builder hidden</span> : null}
        </div>
      </div>
      ) : null}

      {tools.mode === "place_custom_strand" && showCustomBuilder ? (
        <div className="pvToolsRow pvToolsRow--custom">
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="smallLabel">Top Chain</span>
          <input
            value={props.customBuilder.chainLengthIn}
            onChange={(e) => props.onCustomBuilderPatch({ chainLengthIn: num(e.target.value) })}
            style={{ width: 62, borderColor: chainInvalid ? "#ff6666" : undefined }}
          />
          <span className="smallLabel">"</span>
          <button className="btn" onClick={() => !chainInvalid && props.onAppendCustomNode({ type: "chain", lengthIn: props.customBuilder.chainLengthIn })} disabled={chainInvalid}>
            Add
          </button>
        </div>

        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="smallLabel">Strand Spheres</span>
          <input
            value={props.customBuilder.strandSphereCount}
            onChange={(e) => props.onCustomBuilderPatch({ strandSphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62, borderColor: strandInvalid ? "#ff6666" : undefined }}
          />
          <div className="field" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="smallLabel">Color</span>
            <select value={props.customBuilder.strandColorId} onChange={(e) => props.onCustomBuilderPatch({ strandColorId: e.target.value })}>
              {props.palette.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.id}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn"
            onClick={() => !strandInvalid && props.onAppendCustomNode({ type: "strand", sphereCount: props.customBuilder.strandSphereCount, colorId: props.customBuilder.strandColorId })}
            disabled={strandInvalid}
          >
            Add
          </button>
        </div>

        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="smallLabel">Chain</span>
          <input
            value={props.customBuilder.chainLengthIn}
            onChange={(e) => props.onCustomBuilderPatch({ chainLengthIn: num(e.target.value) })}
            style={{ width: 62, borderColor: chainInvalid ? "#ff6666" : undefined }}
          />
          <span className="smallLabel">"</span>
          <button className="btn" onClick={() => !chainInvalid && props.onAppendCustomNode({ type: "chain", lengthIn: props.customBuilder.chainLengthIn })} disabled={chainInvalid}>
            Add
          </button>
        </div>

        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="smallLabel">Stack Spheres</span>
          <input
            value={props.customBuilder.stackSphereCount}
            onChange={(e) => props.onCustomBuilderPatch({ stackSphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62, borderColor: stackInvalid ? "#ff6666" : undefined }}
          />
          <div className="field" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="smallLabel">Color</span>
            <select value={props.customBuilder.stackColorId} onChange={(e) => props.onCustomBuilderPatch({ stackColorId: e.target.value })}>
              {props.palette.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.id}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn"
            onClick={() => !stackInvalid && props.onAppendCustomNode({ type: "stack", sphereCount: props.customBuilder.stackSphereCount, colorId: props.customBuilder.stackColorId })}
            disabled={stackInvalid}
          >
            Add
          </button>
        </div>

        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn" onClick={props.onRemoveLastCustomNode} disabled={customNodes.length === 0}>
            Remove Last Node
          </button>
          {customNodes.length === 0 ? <span className="smallLabel muted">No nodes yet</span> : null}
        </div>

        <div className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 6, background: "#fff" }}>
            <svg width={140} height={customPreview.height} viewBox={`0 0 140 ${customPreview.height}`} style={{ display: "block" }}>
              {customPreview.chainSegments.map((seg, i) => (
                <line key={`ch-${i}`} x1={customPreview.lineX} y1={seg.y1} x2={customPreview.lineX} y2={seg.y2} stroke="#999" strokeWidth={customPreview.chainStroke} />
              ))}
              {customPreview.spheres.map((s, i) => (
                <circle
                  key={`sp-${i}`}
                  cx={s.x}
                  cy={s.y}
                  r={8}
                  fill={s.color}
                  stroke={s.kind === "stack" ? "#111" : "#333"}
                  strokeWidth={s.kind === "stack" ? 2.5 : 1.5}
                />
              ))}
              {customPreview.labels.map((l, i) => (
                <text key={`lb-${i}`} x={l.x} y={l.y} fontSize={10} fill="#666">
                  {l.text}
                </text>
              ))}
            </svg>
          </div>
          <div className="smallLabel muted">
            Preview updates after each Add.
            {chainInvalid || strandInvalid || stackInvalid ? " Fix invalid inputs to add." : ""}
          </div>
        </div>
        </div>
      ) : null}

      <div className="planToolsInstructions">
        {instruction}
      </div>
    </div>
  );
}
