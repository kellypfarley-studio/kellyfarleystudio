// src/components/ToolsPanel.tsx
// =============================================================================
// Tools Panel (MVP 1)
//
// IMPORTANT:
// We keep ToolMode as a strict union so the rest of the app can rely on it.
// Only these two tools exist right now:
//   - "select"  : select + drag anchors
//   - "anchor"  : add anchors by clicking
// =============================================================================

import React from "react";

// STRICT tool names (this prevents mismatches like "addAnchor", "Anchor", etc.)
export type ToolMode = "select" | "anchor";

type Props = {
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
};

export function ToolsPanel({ tool, setTool }: Props) {
  return (
    <div style={wrap}>
      <div style={title}>Tools</div>

      <div style={sub}>
        Current tool: <b>{tool}</b>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={() => setTool("select")}
          style={tool === "select" ? btnActive : btn}
        >
          Select / Move
        </button>

        <button
          type="button"
          onClick={() => setTool("anchor")}
          style={tool === "anchor" ? btnActive : btn}
        >
          Add Anchor
        </button>
      </div>

      <div style={help}>
        <div><b>Tip</b></div>
        <div style={{ marginTop: 6 }}>
          <div>• Add Anchor: click inside the boundary</div>
          <div>• Select/Move: click anchor, drag to move</div>
          <div>• Delete: press Delete / Backspace on selected anchor</div>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  width: 220,
  padding: 12,
  borderRight: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.9)",
};

const title: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 6,
};

const sub: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
  marginBottom: 12,
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  cursor: "pointer",
  textAlign: "left",
  fontWeight: 600,
};

const btnActive: React.CSSProperties = {
  ...btn,
  border: "2px solid rgba(0,0,0,0.55)",
};

const help: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 12,
  borderTop: "1px solid rgba(0,0,0,0.10)",
  fontSize: 12,
  opacity: 0.8,
};
