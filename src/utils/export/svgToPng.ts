export type SvgToPngOptions = {
  widthPx: number;
  heightPx: number;
  /** CSS color string for the background fill (default white). */
  backgroundColor?: string;
};

/**
 * Convert an SVG string into a PNG Blob by loading it into an Image and
 * drawing it onto a canvas. The canvas is filled with a opaque background
 * color first to ensure exported PNGs have a white background.
 */
export async function svgStringToPngBlob(
  svgString: string,
  options: SvgToPngOptions
): Promise<Blob> {
  const { widthPx, heightPx, backgroundColor = '#ffffff' } = options;

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG data as image'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx));
  canvas.height = Math.max(1, Math.round(heightPx));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to get 2D canvas context');

  // Ensure an opaque background (white) before drawing the SVG
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw the SVG image stretched to requested dimensions
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Convert canvas to PNG blob
  const pngBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );

  URL.revokeObjectURL(url);

  if (!pngBlob) throw new Error('Failed to convert canvas to PNG blob');
  return pngBlob;
}

export default svgStringToPngBlob;
