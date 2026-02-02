import serializeSvg from "./svgSerialize";
import type { FitBounds } from "./svgSerialize";
import svgStringToPngBlob from "./svgToPng";
import { downloadBlob } from "./download";

export type ExportPngOptions = {
  /** Background color for rasterization */
  backgroundColor?: string;
};

export async function exportSvgElementToPng(svgEl: SVGSVGElement, fitBounds: FitBounds | undefined, filename: string, opts?: ExportPngOptions) {
  if (!svgEl) throw new Error("No SVG element provided");

  const svgString = serializeSvg(svgEl, { fitBounds });

  // Derive pixel dimensions from the element's layout size and device DPR
  const rect = svgEl.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const widthPx = Math.max(1, Math.round(rect.width * dpr));
  const heightPx = Math.max(1, Math.round(rect.height * dpr));

  const pngBlob = await svgStringToPngBlob(svgString, { widthPx, heightPx, backgroundColor: opts?.backgroundColor ?? '#ffffff' });
  downloadBlob(filename, pngBlob);
}

export default exportSvgElementToPng;
