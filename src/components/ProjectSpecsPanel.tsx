import type { ProjectSpecs } from "../types";

type Props = {
  specs: ProjectSpecs;
  onChange: (next: ProjectSpecs) => void;
};

export function ProjectSpecsPanel({ specs, onChange }: Props) {
  function setField<K extends keyof ProjectSpecs>(key: K, value: ProjectSpecs[K]) {
    onChange({ ...specs, [key]: value });
  }

  return (
    <div style={panelStyle}>
      <h3 style={hStyle}>Project Specs</h3>

      <label style={labelStyle}>
        Units
        <select
          value={specs.units}
          onChange={(e) => setField("units", e.target.value as ProjectSpecs["units"])}
          style={inputStyle}
        >
          <option value="in">inches (in)</option>
        </select>
      </label>

      <label style={labelStyle}>
        Footprint Width (X)
        <input
          type="number"
          value={specs.width}
          step={0.5}
          onChange={(e) => setField("width", Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Footprint Depth (Y)
        <input
          type="number"
          value={specs.depth}
          step={0.5}
          onChange={(e) => setField("depth", Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        Grid Size
        <input
          type="number"
          value={specs.gridSize}
          step={0.25}
          onChange={(e) => setField("gridSize", Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        Tip: Click Plan View to add anchors. Drag to move. Delete removes selected.
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 280,
  padding: 12,
  borderLeft: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.9)",
};

const hStyle: React.CSSProperties = {
  margin: "0 0 12px 0",
  fontSize: 16,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 10,
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.2)",
};
