export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function round(n: number, decimals = 2): number {
  const p = Math.pow(10, decimals);
  return Math.round(n * p) / p;
}
