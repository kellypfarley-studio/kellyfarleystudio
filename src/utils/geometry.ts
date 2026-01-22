export function snapToGrid(value: number, gridSize: number, offset = 0): number {
  if (gridSize <= 0) return value;
  return Math.round((value - offset) / gridSize) * gridSize + offset;
}

export function snapAndClampPoint(
  x: number,
  y: number,
  gridSize: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  offsetX = 0,
  offsetY = 0
) {
  const sx = snapToGrid(x, gridSize, offsetX);
  const sy = snapToGrid(y, gridSize, offsetY);

  return {
    x: clamp(sx, minX, maxX),
    y: clamp(sy, minY, maxY),
  };
}
