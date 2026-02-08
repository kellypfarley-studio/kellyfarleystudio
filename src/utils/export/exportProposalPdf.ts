import { PDFDocument, StandardFonts, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { CostsSummary, ProjectSpecs, ResourcesSummary } from "../../types/appTypes";
import { downloadBlob } from "./download";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
  page.drawText(title, { x: M, y: top - 50, size: 11, font: fontBold, color: rgb(0, 0, 0) });

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

function addUrlLink(pdf: PDFDocument, page: PDFPage, url: string, rect: { x: number; y: number; w: number; h: number }) {
  const link = pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [rect.x, rect.y, rect.x + rect.w, rect.y + rect.h],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(url),
    },
  });
  const linkRef = pdf.context.register(link);
  page.node.addAnnot(linkRef);
}

const fmtMoney = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtLb = (n: number) => `${n.toFixed(2)} lb`;

export async function exportProposalPdf(args: {
  projectSpecs: ProjectSpecs;
  previewPngBytes: Uint8Array;
  previewGifBytes?: Uint8Array;
  resources: ResourcesSummary;
  costs: CostsSummary;
}, opts?: { returnBytes?: boolean }) {
  const { projectSpecs, resources, costs } = args;
  const name = (projectSpecs.projectName?.trim() || "Project");
  const filenameBase = `${name}-Proposal`;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Attach animated preview (single-file deliverable). Note: most PDF viewers
  // won't animate it inline; it appears as an attachment.
  if (args.previewGifBytes?.length) {
    await pdf.attach(args.previewGifBytes, `${name}-preview.gif`, {
      mimeType: "image/gif",
      description: "Rotating preview animation",
      creationDate: new Date(),
      modificationDate: new Date(),
    });
  }

  const style: PageStyle = {
    pageW: 612, // Letter portrait
    pageH: 792,
    margin: 36,
    headerH: 88,
    footerH: 18,
    qrSize: 72,
  };

  const subtitleParts: string[] = [];
  if (projectSpecs.dueDate) subtitleParts.push(`Due: ${projectSpecs.dueDate}`);
  const subtitle = subtitleParts.join("  •  ");

  const viewerUrl = (projectSpecs.clientViewerUrl ?? "").trim();
  let qrImg: any | undefined;
  if (viewerUrl) {
    const qrDataUrl = await QRCode.toDataURL(viewerUrl, { width: 240, margin: 1 });
    const qrBytes = dataUrlToBytes(qrDataUrl);
    qrImg = await pdf.embedPng(qrBytes);
  }

  const page = pdf.addPage([style.pageW, style.pageH]);
  drawHeader({
    page,
    style,
    title: "Proposal",
    projectName: name,
    subtitle,
    font,
    fontBold,
    qrImg: undefined,
  });

  // Summary box (pricing + weight)
  const M = style.margin;
  const summaryY = M + style.footerH + 10;
  const summaryH = 140;
  const summaryW = style.pageW - M * 2;
  page.drawRectangle({ x: M, y: summaryY, width: summaryW, height: summaryH, borderWidth: 1, borderColor: rgb(0, 0, 0) });

  const safeDesignerNet = Number.isFinite(costs.designerNet) ? fmtMoney(costs.designerNet) : "—";
  const safeWeight = Number.isFinite(resources.totalWeightLb) ? fmtLb(resources.totalWeightLb) : "—";
  const poNumber = (projectSpecs.poNumber ?? "").trim();
  const qrPad = 16;
  const qrBox = {
    size: 84,
    x: M + summaryW - qrPad - 84,
    y: summaryY + summaryH - qrPad - 84,
  };

  let y = summaryY + summaryH - 18;
  page.drawText("Summary", { x: M + 12, y, size: 11, font: fontBold, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Designer net price: ${safeDesignerNet}`, { x: M + 12, y, size: 11, font: fontBold, color: rgb(0, 0, 0) });
  y -= 16;
  page.drawText(`Total weight: ${safeWeight}`, { x: M + 12, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 14;
  const dims = `${projectSpecs.boundaryWidthIn} in W × ${projectSpecs.boundaryHeightIn} in D`;
  page.drawText(`Plan boundary: ${dims}`, { x: M + 12, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 12;
  page.drawText(`Ceiling height: ${projectSpecs.ceilingHeightIn} in`, { x: M + 12, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 14;
  if (poNumber) {
    page.drawText(`PO: ${poNumber}`, { x: M + 12, y, size: 9, font, color: rgb(0, 0, 0) });
    y -= 14;
  }

  if (viewerUrl) {
    const label = "Viewer:";
    const labelSize = 9;
    const linkSize = 9;
    const labelX = M + 12;
    page.drawText(label, { x: labelX, y, size: labelSize, font, color: rgb(0, 0, 0) });
    const urlX = labelX + font.widthOfTextAtSize(`${label} `, labelSize);
    page.drawText(viewerUrl, { x: urlX, y, size: linkSize, font, color: rgb(0.1, 0.3, 0.6) });
    addUrlLink(pdf, page, viewerUrl, { x: urlX, y: y - 1, w: font.widthOfTextAtSize(viewerUrl, linkSize), h: linkSize + 2 });
    y -= 14;
  }

  if (args.previewGifBytes?.length) {
    page.drawText("Attached: rotating preview GIF (open the PDF attachments panel).", { x: M + 12, y, size: 9, font, color: rgb(0, 0, 0) });
  } else {
    page.drawText("Tip: Export a rotating GIF from the Menu to share an animated preview.", { x: M + 12, y, size: 9, font, color: rgb(0, 0, 0) });
  }

  if (qrImg) {
    const label = "Scan for a more interactive experience.";
    const labelW = font.widthOfTextAtSize(label, 8);
    const groupW = Math.max(qrBox.size, labelW);
    const groupX = M + summaryW - qrPad - groupW;
    const qrX = groupX + (groupW - qrBox.size) / 2;
    const labelX = groupX + (groupW - labelW) / 2;

    page.drawImage(qrImg, { x: qrX, y: qrBox.y, width: qrBox.size, height: qrBox.size });
    page.drawText(label, { x: labelX, y: qrBox.y - 12, size: 8, font, color: rgb(0, 0, 0) });
    if (viewerUrl) {
      const linkSize = 7;
      const linkW = font.widthOfTextAtSize(viewerUrl, linkSize);
      const linkX = groupX + (groupW - linkW) / 2;
      const linkY = qrBox.y - 24;
      page.drawText(viewerUrl, { x: linkX, y: linkY, size: linkSize, font, color: rgb(0.1, 0.3, 0.6) });
      addUrlLink(pdf, page, viewerUrl, { x: linkX, y: linkY - 1, w: linkW, h: linkSize + 2 });
    }
  }

  // Preview image box
  const contentTop = style.pageH - (style.margin + style.headerH);
  const imageBox = {
    x: M,
    y: summaryY + summaryH + 12,
    w: style.pageW - M * 2,
    h: contentTop - (summaryY + summaryH + 12),
  };
  const img = await pdf.embedPng(args.previewPngBytes);
  drawImageContained(page, img, imageBox);

  drawFooter(page, style, font, "Page 1 of 1");

  const bytes = await pdf.save();
  if (opts?.returnBytes) return bytes;
  const safeBytes = new Uint8Array(bytes);
  const blob = new Blob([safeBytes], { type: "application/pdf" });
  downloadBlob(`${filenameBase}.pdf`, blob);
}

export default exportProposalPdf;
