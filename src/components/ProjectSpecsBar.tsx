import { useEffect, useState } from "react";
import type { ProjectSpecs } from "../types/appTypes";

export type ProjectSpecsBarProps = {
  specs: ProjectSpecs;
  onChange: (patch: Partial<ProjectSpecs>) => void;
  dueDate?: string;
  onDueDateChange?: (next: string) => void;
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ProjectSpecsBar({ specs, onChange, dueDate, onDueDateChange }: ProjectSpecsBarProps) {
  // Let users type freely (including decimals, intermediate states, and empty string)
  // without pushing invalid values into global state (which can freeze grid rendering).
  const [gridText, setGridText] = useState<string>(String(specs.gridSpacingIn ?? ""));

  useEffect(() => {
    setGridText(String(specs.gridSpacingIn ?? ""));
  }, [specs.gridSpacingIn]);

  const commitGrid = () => {
    const trimmed = gridText.trim();
    const next = Number(trimmed);
    if (!trimmed || !Number.isFinite(next) || next <= 0) {
      // revert to last known good value
      setGridText(String(specs.gridSpacingIn ?? ""));
      return;
    }
    onChange({ gridSpacingIn: next });
  };

  return (
    <div className="card specsBar row" style={{ justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="panelTitle">Project Specs:</div>
        <div className="field">
          <span className="smallLabel">Name</span>
          <input
            value={specs.projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
            style={{ width: 220 }}
          />
        </div>
      </div>

      <div className="row" style={{ flexWrap: "wrap" }}>
        <div className="field">
          <span className="smallLabel">Ceiling height</span>
          <input
            value={specs.ceilingHeightIn}
            onChange={(e) => onChange({ ceilingHeightIn: num(e.target.value) })}
            style={{ width: 70 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Boundary x=</span>
          <input
            value={specs.boundaryWidthIn}
            onChange={(e) => onChange({ boundaryWidthIn: num(e.target.value) })}
            style={{ width: 70 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">y=</span>
          <input
            value={specs.boundaryHeightIn}
            onChange={(e) => onChange({ boundaryHeightIn: num(e.target.value) })}
            style={{ width: 70 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Strand Hole Ø</span>
          <input
            type="number"
            step="0.01"
            value={specs.strandHoleDiameterIn}
            onChange={(e) => onChange({ strandHoleDiameterIn: num(e.target.value) })}
            style={{ width: 70 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Fastener Hole Ø</span>
          <input
            type="number"
            step="0.01"
            value={specs.fastenerHoleDiameterIn}
            onChange={(e) => onChange({ fastenerHoleDiameterIn: num(e.target.value) })}
            style={{ width: 70 }}
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Grid</span>
          <input
            type="text"
            inputMode="decimal"
            value={gridText}
            onChange={(e) => setGridText(e.target.value)}
            onBlur={commitGrid}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitGrid();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setGridText(String(specs.gridSpacingIn ?? ""));
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{ width: 70 }}
            aria-label="Grid spacing in inches"
          />
          <span className="smallLabel">"</span>
        </div>

        <div className="field">
          <span className="smallLabel">Due Date</span>
          <input
            type="date"
            value={dueDate ?? specs.dueDate ?? ""}
            onChange={(e) => {
              if (onDueDateChange) onDueDateChange(e.target.value);
              else onChange({ dueDate: e.target.value });
            }}
            style={{ width: 140 }}
          />
        </div>
      </div>
    </div>
  );
}
