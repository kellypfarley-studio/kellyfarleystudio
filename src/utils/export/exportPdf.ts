import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { downloadBlob } from "./download";

export type PdfImage = {
  title: string;
  pngBytes: Uint8Array;
};

function drawImageContained(page: any, img: any, box: { x: number; y: number; w: number; h: number }) {
  const iw = img.width;
  const ih = img.height;
  const scale = Math.min(box.w / iw, box.h / ih);
  const w = iw * scale;
  const h = ih * scale;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  page.drawImage(img, { x, y, width: w, height: h });
}

export async function exportPdfPages(args: {
  filenameBase: string;
  subtitle?: string;
  pages: PdfImage[];
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Letter portrait in points
  const PAGE_W = 612;
  const PAGE_H = 792;
  const M = 36;

  const headerH = 56;
  const footerH = 18;

  for (let i = 0; i < args.pages.length; i++) {
    const { title, pngBytes } = args.pages[i];
    const page = pdf.addPage([PAGE_W, PAGE_H]);

    // Header
    page.drawText(args.filenameBase, { x: M, y: PAGE_H - M - 14, size: 12, font: fontBold, color: rgb(0, 0, 0) });
    if (args.subtitle) {
      page.drawText(args.subtitle, { x: M, y: PAGE_H - M - 30, size: 9, font, color: rgb(0, 0, 0) });
    }
    page.drawText(title, { x: M, y: PAGE_H - M - 46, size: 10, font: fontBold, color: rgb(0, 0, 0) });

    // Footer
    const footer = `Page ${i + 1} of ${args.pages.length}`;
    page.drawText(footer, { x: PAGE_W - M - font.widthOfTextAtSize(footer, 9), y: M - 10, size: 9, font });

    // Image box
    const box = {
      x: M,
      y: M + footerH,
      w: PAGE_W - M * 2,
      h: PAGE_H - (M + headerH) - (M + footerH),
    };

    const img = await pdf.embedPng(pngBytes);
    drawImageContained(page, img, box);
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  downloadBlob(`${args.filenameBase}.pdf`, blob);
}

export default exportPdfPages;
