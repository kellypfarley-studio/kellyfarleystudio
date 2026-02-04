import { GIFEncoder, applyPalette, quantize } from "gifenc";
import serializeSvg from "./svgSerialize";
import type { FitBounds } from "./svgSerialize";
import svgStringToPngBlob from "./svgToPng";
import { downloadBlob } from "./download";

export type ExportGifOptions = {
  svgEl: SVGSVGElement;
  fitBounds?: FitBounds;
  filename?: string;
  frameCount?: number;
  delayMs?: number;
  backgroundColor?: string;
  /** Output resolution control (long edge in px). */
  longEdgePx?: number;
  /** Optional hook to mutate app state per-frame (e.g. rotate preview). */
  setFrame?: (frameIndex: number, deg: number) => void | Promise<void>;
};

const waitNextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const rasterSizeForFit = (fit: { w: number; h: number }, longEdgePx = 1200) => {
  const ratio = fit.h / fit.w;
  if (ratio > 1) {
    const heightPx = longEdgePx;
    const widthPx = Math.max(1, Math.round(longEdgePx / ratio));
    return { widthPx, heightPx };
  }
  const widthPx = longEdgePx;
  const heightPx = Math.max(1, Math.round(longEdgePx * ratio));
  return { widthPx, heightPx };
};

async function blobToDrawableImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // fall through to <img> decode
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image from blob"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function svgToImageData(args: {
  svgEl: SVGSVGElement;
  fitBounds?: FitBounds;
  widthPx: number;
  heightPx: number;
  backgroundColor: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}): Promise<ImageData> {
  const svgString = serializeSvg(args.svgEl, { fitBounds: args.fitBounds });
  const pngBlob = await svgStringToPngBlob(svgString, {
    widthPx: args.widthPx,
    heightPx: args.heightPx,
    backgroundColor: args.backgroundColor,
  });

  const drawable = await blobToDrawableImage(pngBlob);

  args.ctx.clearRect(0, 0, args.widthPx, args.heightPx);
  // Stretch to exact output size
  args.ctx.drawImage(drawable as any, 0, 0, args.widthPx, args.heightPx);

  // Free ImageBitmap memory ASAP
  try {
    (drawable as any)?.close?.();
  } catch {
    // ignore
  }

  return args.ctx.getImageData(0, 0, args.widthPx, args.heightPx);
}

export async function renderPreviewGifBytes(opts: ExportGifOptions) {
  const {
    svgEl,
    fitBounds,
    frameCount = 36,
    delayMs = 60,
    backgroundColor = "#ffffff",
    longEdgePx = 1200,
    setFrame,
  } = opts;

  if (!svgEl) throw new Error("No SVG element provided");

  const fitW = fitBounds?.w ?? 1;
  const fitH = fitBounds?.h ?? 1;
  const { widthPx, heightPx } = rasterSizeForFit({ w: fitW, h: fitH }, longEdgePx);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context");

  const gif = GIFEncoder();

  let palette: any[] | null = null;

  for (let i = 0; i < frameCount; i++) {
    const deg = (i / frameCount) * 360;
    if (setFrame) {
      await setFrame(i, deg);
      await waitNextPaint();
    }

    const imageData = await svgToImageData({
      svgEl,
      fitBounds,
      widthPx,
      heightPx,
      backgroundColor,
      canvas,
      ctx,
    });

    if (!palette) {
      palette = quantize(imageData.data, 256);
    }
    const index = applyPalette(imageData.data, palette);

    gif.writeFrame(index, widthPx, heightPx, {
      palette: i === 0 ? palette : undefined,
      delay: delayMs,
      repeat: i === 0 ? 0 : undefined, // 0 = forever
    });
  }

  gif.finish();
  return gif.bytes();
}

export async function exportPreviewGif(opts: ExportGifOptions) {
  const filename = opts.filename ?? "preview.gif";
  const bytes = await renderPreviewGifBytes(opts);
  const blob = new Blob([bytes], { type: "image/gif" });
  downloadBlob(filename, blob);
}

export default exportPreviewGif;
