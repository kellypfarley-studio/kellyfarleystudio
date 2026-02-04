import { DEFAULT_PALETTE, DEFAULT_SPECS, DEFAULT_NOTES, makeDefaultPlanTools } from "../../state/defaults";
import { gridCenterOffset, snapToGridWithOffset } from "../geometry";

export type ImportedPackage = {
  schemaVersion?: string;
  savedAt?: string;
  state?: unknown;
};

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.onerror = (e) => reject(e);
    fr.readAsText(file, "utf-8");
  });
}

/**
 * Read and parse a project JSON file. Returns the parsed object (either the
 * `state` property if present, or the parsed top-level object).
 * Performs a minimal validation check and will throw if the file is not valid JSON
 * or does not include reasonable project content.
 */
export async function importProjectJson(file: File): Promise<any> {
  const txt = await readFileAsText(file);
  let parsed: any;
  try {
    parsed = JSON.parse(txt);
  } catch (e) {
    throw new Error("Failed to parse JSON file");
  }

  const pkg: ImportedPackage = parsed;
  const candidate = (pkg && (pkg as any).state) ? (pkg as any).state : parsed;

  // Minimal validation: must have projectSpecs (object) and anchors/strands arrays
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Invalid project file: root is not an object");
  }

  if (!candidate.projectSpecs || typeof candidate.projectSpecs !== "object") {
    // tolerate older payloads that had flat properties but at least require some top-level keys
    throw new Error("Invalid project file: missing projectSpecs");
  }

  // Merge projectSpecs with defaults to ensure required fields exist
  candidate.projectSpecs = { ...DEFAULT_SPECS, ...(candidate.projectSpecs || {}) };

  // Palette
  candidate.palette = candidate.palette && Array.isArray(candidate.palette) ? candidate.palette : DEFAULT_PALETTE;

  // Notes
  candidate.notes = candidate.notes || DEFAULT_NOTES;

  // Plan tools
  candidate.planTools = candidate.planTools || makeDefaultPlanTools(candidate.palette || DEFAULT_PALETTE);

  // anchors/strands
  candidate.anchors = Array.isArray(candidate.anchors) ? candidate.anchors : [];
  candidate.strands = Array.isArray(candidate.strands) ? candidate.strands : [];
  candidate.stacks = Array.isArray(candidate.stacks) ? candidate.stacks : [];
  candidate.customStrands = Array.isArray(candidate.customStrands) ? candidate.customStrands : [];
  candidate.clusters = Array.isArray(candidate.clusters) ? candidate.clusters : [];

  // Migration: if anchors lack gridCol/gridRow, compute them by snapping existing xIn/yIn to current grid origin + spacing
  try {
    const specs = candidate.projectSpecs;
    const g = specs?.gridSpacingIn;
    if (g && g > 0 && Array.isArray(candidate.anchors)) {
      // use shared grid math to compute 1-based indices and snapped world coords
      // import helpers dynamically to avoid circular issues with other utils
      // (we already import gridCenterOffset/snapToGridWithOffset above; keep compatibility)
      candidate.anchors = candidate.anchors.map((a: any) => {
        if (a && (a.gridCol == null || a.gridRow == null)) {
          const ox = gridCenterOffset(specs.boundaryWidthIn, g);
          const oy = gridCenterOffset(specs.boundaryHeightIn, g);
          const col = Math.round((a.xIn - ox) / g) + 1;
          const row = Math.round((a.yIn - oy) / g) + 1;
          const snappedX = snapToGridWithOffset(a.xIn, g, ox);
          const snappedY = snapToGridWithOffset(a.yIn, g, oy);
          return { ...a, gridCol: col, gridRow: row, xIn: snappedX, yIn: snappedY };
        }
        return a;
      });
    }
  } catch (e) {
    // if migration fails, leave anchors as-is
  }

  return candidate;
}

export default importProjectJson;
