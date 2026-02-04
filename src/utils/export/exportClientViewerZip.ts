import { zipSync, strToU8 } from "fflate";
import type { ExportPackage } from "./exportProjectJson";
import { downloadBlob } from "./download";

export function exportClientViewerZip(state: unknown, projectName?: string) {
  const pkg: ExportPackage = {
    schemaVersion: "1.0.0",
    savedAt: new Date().toISOString(),
    state,
  };

  const name = (projectName && projectName.trim()) || "untitled";
  const baseFolder = `${name}-viewer`;
  const jsonFilename = `${name}.ssp.json`;

  const readme = [
    "Suspended Builder - Client Viewer Package",
    "",
    "This package includes your project file for the Suspended Builder viewer.",
    "",
    "How to use:",
    "1) Open your hosted viewer page in a browser.",
    `2) Click Load and choose ${jsonFilename}.`,
    "3) Use the preview slider to inspect the piece.",
    "",
    "If you don't have a hosted viewer yet, ask the creator to provide the viewer URL.",
    "",
  ].join("\n");

  const files: Record<string, Uint8Array> = {};
  files[`${baseFolder}/${jsonFilename}`] = strToU8(JSON.stringify(pkg, null, 2));
  files[`${baseFolder}/README.txt`] = strToU8(readme);

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped as any], { type: "application/zip" });
  const zipName = `${baseFolder}.zip`;
  downloadBlob(zipName, blob);
}

export default exportClientViewerZip;
