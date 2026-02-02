import { downloadText } from "../download";

export type ExportPackage = {
  schemaVersion: string;
  savedAt: string; // ISO
  state: unknown;
};

export function exportProjectJson(state: unknown, projectName?: string) {
  const pkg: ExportPackage = {
    schemaVersion: "1.0.0",
    savedAt: new Date().toISOString(),
    state,
  };

  const name = (projectName && projectName.trim()) || "untitled";
  const filename = `${name}.ssp.json`;
  downloadText(filename, JSON.stringify(pkg, null, 2), "application/json;charset=utf-8");
}

export default exportProjectJson;
