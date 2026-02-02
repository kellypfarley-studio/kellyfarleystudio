import { useMemo, useState } from "react";
import type { Anchor, CursorState, PaletteColor, PlanToolsState, Strand, StrandSpec, ToolMode, SwoopSpec } from "../types/appTypes";

export type PlanViewToolsBarProps = {
  tools: PlanToolsState;
  palette: PaletteColor[];
  cursor: CursorState | null;
  cursorText: string;
  selectedAnchor?: Anchor | null;
  selectedStrand?: Strand | null;
  onPatchSelectedStrand?: (patch: Partial<StrandSpec>) => void;
  onMode: (mode: ToolMode) => void;
  onDraftPatch: (patch: Partial<PlanToolsState["draftStrand"]>) => void;
  onDraftSwoopPatch?: (patch: Partial<SwoopSpec>) => void;
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function PlanViewToolsBar(props: PlanViewToolsBarProps) {
  const { tools } = props;
  const [linkAB, setLinkAB] = useState(false);

  const selectedStrandSummary = useMemo(() => {
    const s = props.selectedStrand;
    if (!s) return "";
    const n = s.spec.sphereCount;
    const top = s.spec.topChainLengthIn;
    const bottom = s.spec.bottomChainLengthIn;
    return `Selected strand → spheres: ${n}, top chain: ${top}", bottom chain: ${bottom}"`;
  }, [props.selectedStrand]);

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
      default:
        return "";
    }
  })();

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

      {tools.mode === "select" && (props.selectedAnchor || props.selectedStrand) ? (
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
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
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

      <div className="pvToolsRow pvToolsRow--custom muted">
        <div className="smallLabel">Coming next: Custom Strand builder</div>
      </div>

      <div className="planToolsInstructions">
        {instruction}
      </div>
    </div>
  );
}
