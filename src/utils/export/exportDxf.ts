import { downloadText } from "../download";

export type ExportDxfInput = {
  projectName?: string;
  projectSpecs: any;
  anchors: Array<{ id: string; xIn: number; yIn: number; type?: string; holeType?: string }>;
};

function headerSection(): string {
  return "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";
}

function tablesLayerSection(): string {
  // Define two layers: HOLES_STRAND and HOLES_FASTENER
  return (
    "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n" +
    // Layer HOLES_STRAND
    "0\nLAYER\n2\nHOLES_STRAND\n70\n0\n62\n1\n6\nCONTINUOUS\n" +
    // Layer HOLES_FASTENER
    "0\nLAYER\n2\nHOLES_FASTENER\n70\n0\n62\n3\n6\nCONTINUOUS\n" +
    "0\nENDTAB\n0\nENDSEC\n"
  );
}

function entitiesSection(body: string): string {
  return `0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n`;
}

function footer(): string {
  return "0\nEOF\n";
}

/** Build a DXF circle entity centered at x,y (in inches) with radius in inches on given layer */
function circleEntity(layer: string, x: number, y: number, radius: number): string {
  // DXF R12/CIRCLE format
  return (
    "0\nCIRCLE\n" +
    "8\n" + layer + "\n" +
    "10\n" + x + "\n" +
    "20\n" + y + "\n" +
    "30\n0.0\n" +
    "40\n" + radius + "\n"
  );
}

export function buildProjectDxf(input: ExportDxfInput): { filenameBase: string; dxf: string } {
  const { projectName, projectSpecs, anchors } = input;

  let body = "";

  anchors.forEach((a) => {
    const holeType = a.holeType || (a.type === "canopy_fastener" ? "fastener" : "strand");
    const diam = holeType === "fastener" ? projectSpecs.fastenerHoleDiameterIn : projectSpecs.strandHoleDiameterIn;
    const radius = (typeof diam === "number" ? diam : 0) / 2;
    const layer = holeType === "fastener" ? "HOLES_FASTENER" : "HOLES_STRAND";
    // use xIn, yIn directly (units = inches)
    body += circleEntity(layer, a.xIn, a.yIn, radius);
  });

  // prepend project info as DXF comments in the ENTITIES section so it travels with the file
  const name = (projectName && projectName.trim()) || "project";
  const now = new Date().toISOString();
  const comment = (s: string) => `999\n${s}\n`;
  const bodyWithMeta = comment(`Project: ${name}`) + comment(`Exported: ${now}`) + body;

  const dxf = headerSection() + tablesLayerSection() + entitiesSection(bodyWithMeta) + footer();
  return { filenameBase: name, dxf };
}

export function exportProjectDxf(input: ExportDxfInput) {
  const { filenameBase, dxf } = buildProjectDxf(input);
  const filename = `${filenameBase}_export.dxf`;
  downloadText(filename, dxf, "application/dxf;charset=utf-8");
}

export default exportProjectDxf;
