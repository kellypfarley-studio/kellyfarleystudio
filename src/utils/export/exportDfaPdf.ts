import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { ProjectSpecs } from "../../types/appTypes";
import { downloadBlob } from "./download";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function wrapParagraph(font: PDFFont, size: number, maxWidth: number, text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function wrapText(font: PDFFont, size: number, maxWidth: number, text: string): string[] {
  const paras = String(text ?? "").split(/\r?\n/);
  const lines: string[] = [];
  for (const p of paras) {
    if (!p.trim()) {
      lines.push("");
      continue;
    }
    lines.push(...wrapParagraph(font, size, maxWidth, p));
  }
  return lines;
}

type PageStyle = {
  pageW: number;
  pageH: number;
  margin: number;
  headerH: number;
  footerH: number;
  qrSize: number;
};

function drawHeader(args: {
  page: PDFPage;
  style: PageStyle;
  title: string;
  projectName: string;
  subtitle?: string;
  font: PDFFont;
  fontBold: PDFFont;
  qrImg?: any;
}) {
  const { page, style, projectName, subtitle, title, font, fontBold, qrImg } = args;
  const M = style.margin;
  const top = style.pageH - M;
  page.drawText(projectName, { x: M, y: top - 14, size: 12, font: fontBold, color: rgb(0, 0, 0) });
  if (subtitle) {
    page.drawText(subtitle, { x: M, y: top - 30, size: 9, font, color: rgb(0, 0, 0) });
  }
  page.drawText(title, { x: M, y: top - 46, size: 10, font: fontBold, color: rgb(0, 0, 0) });

  if (qrImg) {
    const x = style.pageW - M - style.qrSize;
    const y = style.pageH - M - style.qrSize;
    page.drawImage(qrImg, { x, y, width: style.qrSize, height: style.qrSize });
  }
}

function drawFooter(page: PDFPage, style: PageStyle, font: PDFFont, footer: string) {
  const M = style.margin;
  const w = font.widthOfTextAtSize(footer, 9);
  page.drawText(footer, { x: style.pageW - M - w, y: M - 10, size: 9, font, color: rgb(0, 0, 0) });
}

function drawImageContained(page: PDFPage, img: any, box: { x: number; y: number; w: number; h: number }) {
  const iw = img.width;
  const ih = img.height;
  const scale = Math.min(box.w / iw, box.h / ih);
  const w = iw * scale;
  const h = ih * scale;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  page.drawImage(img, { x, y, width: w, height: h });
}

export async function exportDfaPdf(args: {
  projectSpecs: ProjectSpecs;
  previewPngBytes: Uint8Array;
  customerNotes?: string;
  artistNotes?: string;
}) {
  const { projectSpecs } = args;
  const name = (projectSpecs.projectName?.trim() || "Project");
  const filenameBase = `${name}-DFA`;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Letter portrait in points
  const style: PageStyle = {
    pageW: 612,
    pageH: 792,
    margin: 36,
    headerH: 80,
    footerH: 18,
    qrSize: 72,
  };

  const subtitleParts: string[] = [];
  if (projectSpecs.dueDate) subtitleParts.push(`Due: ${projectSpecs.dueDate}`);
  const subtitle = subtitleParts.join("  •  ");

  // Optional QR
  let qrImg: any | undefined;
  const viewerUrl = (projectSpecs.clientViewerUrl ?? "").trim();
  if (viewerUrl) {
    const qrDataUrl = await QRCode.toDataURL(viewerUrl, { width: 240, margin: 1 });
    const qrBytes = dataUrlToBytes(qrDataUrl);
    qrImg = await pdf.embedPng(qrBytes);
  }

  // Page 1: Preview
  {
    const page = pdf.addPage([style.pageW, style.pageH]);
    drawHeader({ page, style, title: "Drawing For Approval — Preview", projectName: name, subtitle, font, fontBold, qrImg });

    const box = {
      x: style.margin,
      y: style.margin + style.footerH,
      w: style.pageW - style.margin * 2,
      h: style.pageH - (style.margin + style.headerH) - (style.margin + style.footerH),
    };

    const img = await pdf.embedPng(args.previewPngBytes);
    drawImageContained(page, img, box);
  }

  // Pages: Notes (customer + artist/literature)
  const textPages: Array<{ title: string; text: string }> = [];
  const cust = String(args.customerNotes ?? "").trim();
  const art = String(args.artistNotes ?? "").trim();
  textPages.push({ title: "Client Notes", text: cust || "—" });
  textPages.push({ title: "Artist Notes / Literature", text: art || "—" });

  const contentX = style.margin;
  const contentW = style.pageW - style.margin * 2;
  const fontSize = 10;
  const lineH = 13;

  for (const section of textPages) {
    const lines = wrapText(font, fontSize, contentW, section.text);
    let page = pdf.addPage([style.pageW, style.pageH]);
    let y = style.pageH - style.margin - style.headerH - 8;

    drawHeader({ page, style, title: `Drawing For Approval — ${section.title}`, projectName: name, subtitle, font, fontBold, qrImg });

    // Small URL line for convenience
    if (viewerUrl) {
      const urlLabel = `Viewer: ${viewerUrl}`;
      page.drawText(urlLabel, { x: contentX, y, size: 9, font, color: rgb(0, 0, 0) });
      y -= lineH;
      y -= 6;
    }

    for (const ln of lines) {
      if (y <= style.margin + style.footerH + 10) {
        page = pdf.addPage([style.pageW, style.pageH]);
        drawHeader({ page, style, title: `Drawing For Approval — ${section.title} (cont.)`, projectName: name, subtitle, font, fontBold, qrImg });
        y = style.pageH - style.margin - style.headerH - 8;
      }
      page.drawText(ln, { x: contentX, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= lineH;
    }

    // Add approval lines on the final page of client notes section
    if (section.title === "Client Notes") {
      y -= 10;
      const lineY = Math.max(style.margin + style.footerH + 40, y);
      page.drawText("Approval", { x: contentX, y: lineY + 18, size: 11, font: fontBold, color: rgb(0, 0, 0) });
      page.drawText("Approved by:", { x: contentX, y: lineY, size: 10, font, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: contentX + 80, y: lineY - 2 }, end: { x: contentX + 300, y: lineY - 2 }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawText("Date:", { x: contentX + 330, y: lineY, size: 10, font, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: contentX + 365, y: lineY - 2 }, end: { x: contentX + 520, y: lineY - 2 }, thickness: 1, color: rgb(0, 0, 0) });
    }
  }

  // Footers (page numbers)
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    drawFooter(pages[i], style, font, `Page ${i + 1} of ${pages.length}`);
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  downloadBlob(`${filenameBase}.pdf`, blob);
}

export default exportDfaPdf;
