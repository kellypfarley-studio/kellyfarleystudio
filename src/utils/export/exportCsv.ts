import { downloadText } from "../download";
import { calcResources, calcCosts } from "../calcProjectTotals";

function quote(s: unknown) {
  if (s === null || s === undefined) return "";
  const str = String(s);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function row(...cols: unknown[]) {
  return cols.map(quote).join(",") + "\n";
}

export type ExportCsvInput = {
  projectName?: string;
  projectSpecs: any;
  anchors: any[];
  strands: any[];
  stacks?: any[];
  piles?: any[];
  customStrands?: any[];
  clusters?: any[];
  notes?: { customerNotes?: string; artistNotes?: string } | null;
};

export function buildProjectCsv(input: ExportCsvInput): string {
  const { projectName, projectSpecs, anchors, strands, stacks, piles, customStrands, clusters, notes } = input;

  let out = "";

  // Header
  out += row(`Project: ${projectName ?? projectSpecs?.projectName ?? "untitled"}`);
  out += row(`Saved: ${new Date().toISOString()}`);
  out += "\n";

  // Holes section
  out += row("Holes");
  out += row(
    "id",
    "xIn",
    "yIn",
    "type",
    "holeType",
    "strandHoleDiameterIn",
    "fastenerHoleDiameterIn",
  );
  anchors.forEach((a) => {
    out += row(a.id, a.xIn, a.yIn, a.type, a.holeType ?? "", projectSpecs.strandHoleDiameterIn, projectSpecs.fastenerHoleDiameterIn);
  });

  out += "\n";

  // Resources & Costs using calculators
  const resources = calcResources({ strands, stacks, piles, customStrands, clusters, anchors, projectSpecs });
  const costs = calcCosts({ strands, stacks, piles, customStrands, clusters, anchors, projectSpecs }, resources);

  out += row("Resources");
  out += row("item", "quantity");
  out += row("spheres", resources.spheres);
  out += row("clasps", resources.clasps);
  out += row("strandHoleCount", resources.strandHoleCount ?? resources.holes);
  out += row("fastenerHoleCount", resources.fastenerHoleCount ?? 0);
  out += row("hangingAnchors", resources.hangingAnchors);
  out += row("canopyFasteners", resources.canopyFasteners);
  out += row("stacks", resources.stacks ?? 0);
  out += row("piles", piles?.length ?? 0);
  out += row("customStrands", resources.customStrands ?? 0);
  out += row("clusters", resources.clusters ?? 0);
  out += row("chainFeet", resources.chainFeet);
  out += row("totalWeightLb", resources.totalWeightLb.toFixed(3));

  out += "\n";

  out += row("Costs");
  out += row("line", "amount");
  const lt = costs.lineTotals || {};
  Object.keys(lt).forEach((k) => {
    out += row(k, lt[k as string]?.toFixed ? (lt[k as string] as number).toFixed(2) : String(lt[k as string]));
  });
  out += row("materialsSubtotal", costs.materialsSubtotal.toFixed(2));
  if (typeof costs.laborSubtotal === "number") out += row("laborSubtotal", costs.laborSubtotal.toFixed(2));
  out += row("artistNet", costs.artistNet.toFixed(2));
  out += row("showroomNet", costs.showroomNet.toFixed(2));
  out += row("designerNet", costs.designerNet.toFixed(2));
  out += row("total", costs.total.toFixed(2));

  out += "\n";

  out += row("Notes");
  out += row("Customer Notes", notes?.customerNotes ?? "");
  out += row("Artist Notes", notes?.artistNotes ?? "");

  return out;
}

export function exportProjectCsv(input: ExportCsvInput) {
  const csv = buildProjectCsv(input);
  const name = (input.projectName && input.projectName.trim()) || "project";
  const filename = `${name}_export.csv`;
  downloadText(filename, csv, "text/csv;charset=utf-8");
}

export default exportProjectCsv;
