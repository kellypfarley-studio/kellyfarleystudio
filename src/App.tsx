// src/App.tsx
// =============================================================================
// Main app shell for MVP 1.
// Layout matches your concept: Tools on the left, main canvas center, specs on right.
// We'll add Top Menu, Layers, Resources later.
// =============================================================================

import { useEffect, useState } from "react";
import { useProjectState } from "./state/useProjectState";
import { ToolsPanel, type ToolMode } from "./components/ToolsPanel";
import { ProjectSpecsPanel } from "./components/ProjectSpecsPanel";
import { PlanView } from "./components/PlanView";

export default function App() {
  const {
    specs,
    setSpecs,
    anchors,
    createAnchor,
    updateAnchorPosition,
    deleteAnchor,
    selectedAnchorId,
    setSelectedAnchorId,
    selectedAnchor,
  } = useProjectState();

  // ---------------------------------------------------------------------------
  // SECTION A — Tool mode (Select vs Add Anchor)
  // ---------------------------------------------------------------------------
  const [tool, setTool] = useState<ToolMode>("select");

  // ---------------------------------------------------------------------------
  // SECTION B — Keyboard shortcuts (Delete to remove selected anchor)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Allow delete/backspace to remove selected anchor.
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnchorId) {
        deleteAnchor(selectedAnchorId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAnchorId, deleteAnchor]);

  return (
    <div style={appStyle}>
      {/* Left: Tools */}
      <ToolsPanel tool={tool} setTool={setTool} />
<button
  onClick={() => createAnchor(1, 1)}
  style={{ margin: 12, padding: 10, borderRadius: 10 }}
>
  Force Add Anchor at (1,1)
</button>


      {/* Center: Plan View (MVP 1). Later: tabs for Front/Back/Plan */}
      <div style={centerStyle}>
        <PlanView
          specs={specs}
          anchors={anchors}
          tool={tool}
          selectedAnchorId={selectedAnchorId}
          setSelectedAnchorId={setSelectedAnchorId}
          createAnchor={createAnchor}
          updateAnchorPosition={updateAnchorPosition}
        />

        {/* Small readout: selected anchor coordinates */}
        <div style={readoutStyle}>
          <b>Anchor Readout</b>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            {selectedAnchor ? (
              <>
                <div>ID: {selectedAnchor.id}</div>
                <div>
                  X: {selectedAnchor.x.toFixed(2)} {specs.units}
                </div>
                <div>
                  Y: {selectedAnchor.y.toFixed(2)} {specs.units}
                </div>
              </>
            ) : (
              <div style={{ opacity: 0.7 }}>Select an anchor to see coordinates.</div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Project Specs */}
      <ProjectSpecsPanel specs={specs} onChange={setSpecs} />
    </div>
  );
}

const appStyle: React.CSSProperties = {
  height: "100vh",
  display: "flex",
  background: "linear-gradient(180deg, rgba(245,245,245,1), rgba(255,255,255,1))",
  color: "rgba(0,0,0,0.9)",
};

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const readoutStyle: React.CSSProperties = {
  margin: "0 12px 12px 12px",
  padding: 12,
  borderRadius: 12,
  background: "white",
  border: "1px solid rgba(0,0,0,0.12)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
};
