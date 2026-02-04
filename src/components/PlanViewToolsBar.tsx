import { useMemo, useRef, useState } from "react";
import type { Anchor, Cluster, ClusterBuilderState, ClusterSpec, ClusterStrandSpec, CursorState, CustomStrand, CustomStrandBuilderState, CustomStrandSpec, PaletteColor, PlanToolsState, Stack, StackSpec, Strand, StrandSpec, ToolMode, SwoopSpec } from "../types/appTypes";
import { computeClusterLayout } from "../utils/clusterLayout";

export type PlanViewToolsBarProps = {
  tools: PlanToolsState;
  palette: PaletteColor[];
  cursor: CursorState | null;
  cursorText: string;
  selectedAnchor?: Anchor | null;
  selectedStrand?: Strand | null;
  selectedStack?: Stack | null;
  selectedCluster?: Cluster | null;
  selectedCustomStrand?: CustomStrand | null;
  onPatchSelectedStrand?: (patch: Partial<StrandSpec>) => void;
  onPatchSelectedStack?: (patch: Partial<StackSpec>) => void;
  onPatchSelectedCluster?: (patch: Partial<ClusterSpec>) => void;
  onPatchSelectedCustomStrand?: (patch: Partial<CustomStrandSpec>) => void;
  onMode: (mode: ToolMode) => void;
  onDraftPatch: (patch: Partial<PlanToolsState["draftStrand"]>) => void;
  onDraftStackPatch: (patch: Partial<PlanToolsState["draftStack"]>) => void;
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

  const instruction = (() => {
    switch (tools.mode) {
      case "select":
        return "Select: click a hole to select. Delete removes selected.";
      case "move_anchor":
        return "Move: click a hole, then click a new position. (Alt disables snap)";
      case "place_strand":
        return "Strand: set recipe, then click in Plan View to place a hole + strand.";
      case "place_canopy_fastener":
        return "Fastener: places a hole only (for canopy fastening).";
      case "place_swoop":
        return "Swoop: click endpoint A, then endpoint B.";
      case "place_stack":
        return "Stack: set recipe, then click in Plan View to place a hole + stack (no clasp gaps).";
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
          <button className={tools.mode === "place_canopy_fastener" ? "active" : ""} onClick={() => props.onMode("place_canopy_fastener")}>
            Fastener
          </button>
        </div>
      </div>

      {tools.mode === "select" && (props.selectedAnchor || props.selectedStrand || props.selectedStack || props.selectedCluster || props.selectedCustomStrand) ? (
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
          {props.selectedCluster ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedClusterSummary}</div>
              <div className="field">
                <span className="smallLabel">Items</span>
                <input
                  value={props.selectedCluster.spec.itemCount}
                  onChange={(e) => props.onPatchSelectedCluster?.({ itemCount: Math.max(0, Math.floor(num(e.target.value))) })}
                  style={{ width: 52 }}
                />
              </div>
            </>
          ) : null}
          {props.selectedCustomStrand ? (
            <>
              <div className="smallLabel" style={{ marginRight: 12 }}>{selectedCustomSummary}</div>
              <div className="field">
                <span className="smallLabel">Layer</span>
                <select
                  value={props.selectedCustomStrand.spec.layer}
                  onChange={(e) => props.onPatchSelectedCustomStrand?.({ layer: e.target.value as any })}
                >
                  <option value="front">Front</option>
                  <option value="mid">Mid</option>
                  <option value="back">Back</option>
                </select>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

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
            disabled={tools.mode !== "place_strand"}
            className={tools.mode !== "place_strand" ? "muted" : ""}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Top Chain</span>
          <input
            value={tools.draftStrand.topChainLengthIn}
            onChange={(e) => props.onDraftPatch({ topChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_strand"}
            className={tools.mode !== "place_strand" ? "muted" : ""}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Bottom Chain</span>
          <input
            value={tools.draftStrand.bottomChainLengthIn}
            onChange={(e) => props.onDraftPatch({ bottomChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_strand"}
            className={tools.mode !== "place_strand" ? "muted" : ""}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Mound</span>
          <select value={tools.draftStrand.moundPreset} onChange={(e) => props.onDraftPatch({ moundPreset: e.target.value as any })} disabled={tools.mode !== "place_strand"} className={tools.mode !== "place_strand" ? "muted" : ""}>
            <option value="none">None</option>
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="18">18</option>
            <option value="24">24</option>
            <option value="36">36</option>
          </select>
        </div>

        <div className="field">
          <span className="smallLabel">Layer</span>
          <select value={tools.draftStrand.layer} onChange={(e) => props.onDraftPatch({ layer: e.target.value as any })} disabled={tools.mode !== "place_strand"} className={tools.mode !== "place_strand" ? "muted" : ""}>
            <option value="front">Front</option>
            <option value="mid">Mid</option>
            <option value="back">Back</option>
          </select>
        </div>

        <div className="field">
          <span className="smallLabel">Color</span>
          <select value={tools.draftStrand.colorId} onChange={(e) => props.onDraftPatch({ colorId: e.target.value })} disabled={tools.mode !== "place_strand"} className={tools.mode !== "place_strand" ? "muted" : ""}>
            {props.palette.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.id}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            disabled={tools.mode !== "place_stack"}
            className={tools.mode !== "place_stack" ? "muted" : ""}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Top Chain</span>
          <input
            value={tools.draftStack.topChainLengthIn}
            onChange={(e) => props.onDraftStackPatch({ topChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_stack"}
            className={tools.mode !== "place_stack" ? "muted" : ""}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Bottom Chain</span>
          <input
            value={tools.draftStack.bottomChainLengthIn}
            onChange={(e) => props.onDraftStackPatch({ bottomChainLengthIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_stack"}
            className={tools.mode !== "place_stack" ? "muted" : ""}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Mound</span>
          <select value={tools.draftStack.moundPreset} onChange={(e) => props.onDraftStackPatch({ moundPreset: e.target.value as any })} disabled={tools.mode !== "place_stack"} className={tools.mode !== "place_stack" ? "muted" : ""}>
            <option value="none">None</option>
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="18">18</option>
            <option value="24">24</option>
            <option value="36">36</option>
          </select>
        </div>

        <div className="field">
          <span className="smallLabel">Layer</span>
          <select value={tools.draftStack.layer} onChange={(e) => props.onDraftStackPatch({ layer: e.target.value as any })} disabled={tools.mode !== "place_stack"} className={tools.mode !== "place_stack" ? "muted" : ""}>
            <option value="front">Front</option>
            <option value="mid">Mid</option>
            <option value="back">Back</option>
          </select>
        </div>

        <div className="field">
          <span className="smallLabel">Color</span>
          <select value={tools.draftStack.colorId} onChange={(e) => props.onDraftStackPatch({ colorId: e.target.value })} disabled={tools.mode !== "place_stack"} className={tools.mode !== "place_stack" ? "muted" : ""}>
            {props.palette.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pvToolsRow pvToolsRow--cluster">
        <div className="btnGroup" title="Cluster mode">
          <button className={tools.mode === "place_cluster" ? "active" : ""} onClick={() => props.onMode("place_cluster")}>
            Cluster
          </button>
        </div>

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
            disabled={tools.mode !== "place_cluster"}
            className={tools.mode !== "place_cluster" ? "muted" : ""}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Spread</span>
          <input
            value={props.clusterBuilder.spreadIn}
            onChange={(e) => props.onClusterBuilderPatch({ spreadIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_cluster"}
            className={tools.mode !== "place_cluster" ? "muted" : ""}
          />
          <span className="smallLabel">"</span>
        </div>
      </div>

      <div className="pvToolsRow pvToolsRow--cluster">
        <div className="field">
          <span className="smallLabel">Top Chain</span>
          <input
            value={props.clusterBuilder.topChainLengthIn}
            onChange={(e) => props.onClusterBuilderPatch({ topChainLengthIn: num(e.target.value) })}
            style={{ width: 62, borderColor: clusterTopInvalid ? "#ff6666" : undefined }}
            disabled={tools.mode !== "place_cluster"}
            className={tools.mode !== "place_cluster" ? "muted" : ""}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Spheres</span>
          <input
            value={props.clusterBuilder.sphereCount}
            onChange={(e) => props.onClusterBuilderPatch({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62, borderColor: clusterSphereInvalid ? "#ff6666" : undefined }}
            disabled={tools.mode !== "place_cluster"}
            className={tools.mode !== "place_cluster" ? "muted" : ""}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Bottom</span>
          <input
            value={props.clusterBuilder.bottomSphereCount}
            onChange={(e) => props.onClusterBuilderPatch({ bottomSphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62, borderColor: clusterBottomInvalid ? "#ff6666" : undefined }}
            disabled={tools.mode !== "place_cluster"}
            className={tools.mode !== "place_cluster" ? "muted" : ""}
          />
        </div>

        <div className="field">
          <span className="smallLabel">Color</span>
          <select
            value={props.clusterBuilder.colorId}
            onChange={(e) => props.onClusterBuilderPatch({ colorId: e.target.value })}
            disabled={tools.mode !== "place_cluster"}
            className={tools.mode !== "place_cluster" ? "muted" : ""}
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

      {clusterStrands.length > 0 ? (
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

      <div className={`pvToolsRow pvToolsRow--swoop ${tools.mode !== "place_swoop" ? "muted" : ""}`}>
        <div className="btnGroup" title="Swoop mode">
          <button className={tools.mode === "place_swoop" ? "active" : ""} onClick={() => props.onMode("place_swoop")}>Swoop</button>
        </div>

        <div className="field">
          <span className="smallLabel">Sphere Count</span>
          <input
            value={(tools.draftSwoop?.sphereCount ?? 6)}
            onChange={(e) => props.onDraftSwoopPatch && props.onDraftSwoopPatch({ sphereCount: Math.max(0, Math.floor(num(e.target.value))) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_swoop"}
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
            disabled={tools.mode !== "place_swoop"}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Chain B</span>
          <input
            value={(tools.draftSwoop?.chainBIn ?? tools.draftSwoop?.chainAIn ?? 12)}
            onChange={(e) => props.onDraftSwoopPatch && props.onDraftSwoopPatch({ chainBIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_swoop" || linkAB}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Sag</span>
          <input
            value={(tools.draftSwoop?.sagIn ?? 12)}
            onChange={(e) => props.onDraftSwoopPatch && props.onDraftSwoopPatch({ sagIn: num(e.target.value) })}
            style={{ width: 62 }}
            disabled={tools.mode !== "place_swoop"}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={linkAB} onChange={(e) => setLinkAB(e.target.checked)} disabled={tools.mode !== "place_swoop"} />
            <span className="smallLabel">Link A/B</span>
          </label>
        </div>
      </div>

      <div className="pvToolsRow pvToolsRow--custom">
        <div className="btnGroup" title="Custom strand mode">
          <button className={tools.mode === "place_custom_strand" ? "active" : ""} onClick={() => props.onMode("place_custom_strand")}>
            Custom
          </button>
        </div>

        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn" onClick={() => setShowCustomBuilder((v) => !v)}>
            {showCustomBuilder ? "Hide Builder" : "Show Builder"}
          </button>
          {!showCustomBuilder ? <span className="smallLabel muted">Custom builder hidden</span> : null}
        </div>
      </div>

      {showCustomBuilder ? (
        <div className="pvToolsRow pvToolsRow--custom">
          <div className="field">
            <span className="smallLabel">Layer</span>
            <select
              value={props.customBuilder.layer}
              onChange={(e) => props.onCustomBuilderPatch({ layer: e.target.value as any })}
            >
              <option value="front">Front</option>
              <option value="mid">Mid</option>
              <option value="back">Back</option>
            </select>
          </div>

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
