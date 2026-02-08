import type { MenuAction } from "../types/appTypes";
import type { ProjectListItem } from "../utils/tauri/projectStorage";

export type MenuBarProps = {
  onAction: (action: MenuAction) => void;
  viewerOnly?: boolean;
  statusMessage?: string;
  isTauri?: boolean;
  projectList?: ProjectListItem[];
  selectedProjectPath?: string;
  onSelectProjectPath?: (path: string) => void;
  onOpenProject?: (path: string) => void;
  onOpenExportsFolder?: () => void;
  onRefreshProjects?: () => void;
};

export default function MenuBar({
  onAction,
  viewerOnly,
  statusMessage,
  isTauri,
  projectList,
  selectedProjectPath,
  onSelectProjectPath,
  onOpenProject,
  onOpenExportsFolder,
  onRefreshProjects,
}: MenuBarProps) {
  const items: { a: MenuAction; label: string }[] = viewerOnly
    ? []
    : [
        { a: "new", label: "New" },
        { a: "save", label: "Save" },
        { a: "png", label: "PNG" },
        { a: "gif", label: "GIF" },
        ...(isTauri ? [{ a: "publish_viewer" as const, label: "Publish Viewer" }] : []),
        { a: "pdf", label: "PDF" },
        { a: "proposal", label: "Proposal" },
        { a: "csv", label: "CSV" },
        { a: "dxf", label: "DXF" },
        { a: "export_3d_zip", label: "3D" },
        { a: "dfa", label: "DFA" },
      ];
  return (
    <div className="card menuBar row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <div className="panelTitle" style={{ marginRight: 6 }}>
        {viewerOnly ? "Client Viewer" : "Menu Options"}
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {items.map((it) => (
          <button key={it.a} className={`btn ${it.a === "save" ? "btnPrimary" : ""}`} onClick={() => onAction(it.a)}>
            {it.label}
          </button>
        ))}
      </div>
      {!viewerOnly && isTauri ? (
        <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span className="smallLabel">Active Projects</span>
          <select
            value={selectedProjectPath ?? ""}
            onChange={(e) => onSelectProjectPath && onSelectProjectPath(e.target.value)}
            onFocus={() => onRefreshProjects && onRefreshProjects()}
            onMouseDown={() => onRefreshProjects && onRefreshProjects()}
            style={{ minWidth: 220 }}
          >
            <option value="">Select project…</option>
            {(projectList || []).map((p) => {
              const days = p.daysLeft;
              const due = p.dueDate ? `Due ${p.dueDate}` : "";
              const dLabel = days == null ? "" : (days < 0 ? `Overdue ${Math.abs(days)}d` : `${days}d`);
              const meta = [dLabel, due].filter(Boolean).join(" • ");
              return (
                <option key={p.path} value={p.path}>
                  {p.name}{meta ? ` — ${meta}` : ""}
                </option>
              );
            })}
          </select>
          <button
            className="btn"
            onClick={() => {
              if (!onOpenProject || !selectedProjectPath) return;
              onOpenProject(selectedProjectPath);
            }}
            disabled={!selectedProjectPath}
          >
            Open
          </button>
          <button className="btn" onClick={() => onOpenExportsFolder && onOpenExportsFolder()}>
            Exports
          </button>
        </div>
      ) : null}
      {statusMessage ? <div className="smallLabel muted">{statusMessage}</div> : null}
    </div>
  );
}
