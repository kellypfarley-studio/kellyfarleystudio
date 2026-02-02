import { clamp } from "./number";

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
