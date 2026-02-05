import { useEffect, useState } from "react";
import QRCode from "qrcode";
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

  const viewerUrl = (specs.clientViewerUrl ?? "").trim();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (!viewerUrl) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(viewerUrl, { width: 140, margin: 1 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [viewerUrl]);

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
          <span className="smallLabel">Ceiling Fixture</span>
          <select
            value={specs.ceilingFixtureType ?? "sheetrock"}
            onChange={(e) => onChange({ ceilingFixtureType: e.target.value as any })}
          >
            <option value="sheetrock">Sheetrock</option>
            <option value="decorative_metal_plate">Decorative Metal Plate</option>
            <option value="decorative_wood_slab">Decorative Wood Slab</option>
          </select>
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
          <span className="smallLabel">Shape</span>
          <select
            value={specs.boundaryShape ?? "rect"}
            onChange={(e) => onChange({ boundaryShape: e.target.value as any })}
          >
            <option value="rect">Rect</option>
            <option value="oval">Oval</option>
            <option value="circle">Circle</option>
          </select>
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

      <div className="row" style={{ flexWrap: "wrap", marginTop: 6, alignItems: "center", gap: 12 }}>
        <div className="field" style={{ minWidth: 320 }}>
          <span className="smallLabel">Client Viewer URL</span>
          <input
            value={specs.clientViewerUrl ?? ""}
            onChange={(e) => onChange({ clientViewerUrl: e.target.value })}
            placeholder="https://kellyfarleyart.com/clientname"
            style={{ width: 360 }}
          />
        </div>
        {viewerUrl ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="smallLabel muted">QR Preview</div>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Client viewer QR code" width={70} height={70} style={{ border: "1px solid #111" }} />
            ) : (
              <div className="smallLabel muted">Generating...</div>
            )}
            <button
              className="btn"
              onClick={() => {
                if (!qrDataUrl) return;
                const a = document.createElement("a");
                const name = (specs.projectName?.trim() || "client-viewer").replace(/\s+/g, "-");
                a.href = qrDataUrl;
                a.download = `${name}-qr.png`;
                a.click();
              }}
              disabled={!qrDataUrl}
            >
              Download QR
            </button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(viewerUrl);
                } catch {
                  // fallback for browsers without clipboard permissions
                  const temp = document.createElement("textarea");
                  temp.value = viewerUrl;
                  document.body.appendChild(temp);
                  temp.select();
                  document.execCommand("copy");
                  document.body.removeChild(temp);
                }
              }}
            >
              Copy URL
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
