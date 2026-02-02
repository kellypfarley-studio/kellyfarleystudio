import type { ViewTransform } from "../types/appTypes";

export type ViewControlsProps = {
  view: ViewTransform;
  onChange: (next: ViewTransform) => void;
  onFit: () => void;
  panEnabled?: boolean;
  onTogglePan?: () => void;
  showPanHint?: boolean;
};

export default function ViewControls({ view, onChange, onFit, panEnabled, onTogglePan }: ViewControlsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <div className="muted" style={{ fontSize: 10 }}>
        ZOOM
      </div>
      <button
        className="btn"
        style={{ width: 44 }}
        onClick={() => onChange({ ...view, zoom: Math.min(32, view.zoom * 1.25) })}
        title="Zoom In"
      >
        +
      </button>
      <button
        className="btn"
        style={{ width: 44 }}
        onClick={() => onChange({ ...view, zoom: Math.max(0.2, view.zoom / 1.25) })}
        title="Zoom Out"
      >
        −
      </button>
      <button className="btn" style={{ width: 44 }} onClick={onFit} title="Fit to content">
        Fit
      </button>
      <button
        className={`btn ${panEnabled ? 'active' : ''}`}
        style={{ width: 44 }}
        onClick={() => onTogglePan && onTogglePan()}
        title="Toggle pan (drag to move view)"
      >
        ⇿
      </button>
    </div>
  );
}
