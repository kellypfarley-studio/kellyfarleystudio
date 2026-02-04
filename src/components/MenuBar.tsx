import type { MenuAction } from "../types/appTypes";

export type MenuBarProps = {
  onAction: (action: MenuAction) => void;
  onLoad?: (file: File) => void;
  viewerOnly?: boolean;
};

export default function MenuBar({ onAction, onLoad, viewerOnly }: MenuBarProps) {
  const items: { a: MenuAction; label: string }[] = viewerOnly
    ? []
    : [
        { a: "save", label: "Save" },
        { a: "png", label: "PNG" },
        { a: "gif", label: "GIF" },
        { a: "viewer_zip", label: "Viewer" },
        { a: "pdf", label: "PDF" },
        { a: "proposal", label: "Proposal" },
        { a: "csv", label: "CSV" },
        { a: "dxf", label: "DXF" },
        { a: "export_3d_zip", label: "3D" },
        { a: "dfa", label: "DFA" },
      ];
  let fileInput: HTMLInputElement | null = null;

  const onLoadClick = () => {
    if (!onLoad) return;
    if (!fileInput) return;
    fileInput.value = "";
    fileInput.click();
  };
  return (
    <div className="card menuBar row">
      <div className="panelTitle" style={{ marginRight: 10 }}>
        {viewerOnly ? "Client Viewer" : "Menu Options"}
      </div>
      {items.map((it) => (
        <button key={it.a} className={`btn ${it.a === "save" ? "btnPrimary" : ""}`} onClick={() => onAction(it.a)}>
          {it.label}
        </button>
      ))}
      <button className="btn" onClick={onLoadClick}>
        Load
      </button>
      <input
        style={{ display: "none" }}
        ref={(el) => {
          fileInput = el;
        }}
        type="file"
        accept=".json,.ssp.json,application/json"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f && onLoad) onLoad(f);
        }}
      />
    </div>
  );
}
