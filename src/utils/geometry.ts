import { clamp } from "./number";
import type { BoundaryShape } from "../types/appTypes";

/**
 * If boundary size isn't a perfect multiple of grid size, we inset the grid by (remainder/2)
 * so the leftover space is split evenly on both sides.
 */
export function gridCenterOffset(sizeIn: number, gridIn: number): number {
  if (gridIn <= 0) return 0;
  // safer remainder for floats
  const rem = sizeIn - Math.floor(sizeIn / gridIn) * gridIn;
  return rem / 2;
}

export function snapToGridWithOffset(valueIn: number, gridIn: number, offsetIn: number): number {
  if (gridIn <= 0) return valueIn;
  const t = (valueIn - offsetIn) / gridIn;
  const snapped = Math.round(t) * gridIn + offsetIn;
  return snapped;
}

export function clampToBoundary(
  xIn: number,
  yIn: number,
  widthIn: number,
  heightIn: number,
  offsetXIn: number,
  offsetYIn: number,
): { xIn: number; yIn: number } {
  const minX = offsetXIn;
  const maxX = Math.max(minX, widthIn - offsetXIn);
  const minY = offsetYIn;
  const maxY = Math.max(minY, heightIn - offsetYIn);
  return {
    xIn: clamp(xIn, minX, maxX),
    yIn: clamp(yIn, minY, maxY),
  };
}

export function clampToBoundaryShape(
  xIn: number,
  yIn: number,
  widthIn: number,
  heightIn: number,
  shape: BoundaryShape = "rect",
): { xIn: number; yIn: number } {
  if (shape === "rect") return { xIn, yIn };
  const cx = widthIn / 2;
  const cy = heightIn / 2;
  const rx = shape === "circle" ? Math.min(widthIn, heightIn) / 2 : widthIn / 2;
  const ry = shape === "circle" ? Math.min(widthIn, heightIn) / 2 : heightIn / 2;
  if (rx <= 0 || ry <= 0) return { xIn: cx, yIn: cy };

  const dx = xIn - cx;
  const dy = yIn - cy;
  const t = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (t <= 1) return { xIn, yIn };
  const scale = 1 / Math.sqrt(t);
  return { xIn: cx + dx * scale, yIn: cy + dy * scale };
}
