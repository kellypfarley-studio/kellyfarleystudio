import type { ProjectSpecs } from "../types/appTypes";

// Parallax / depth projection helpers for preview panels
export function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function depth01(specs: ProjectSpecs, anchorYIn: number): number {
  const denom = specs.boundaryHeightIn || 1;
  return clamp01(anchorYIn / denom);
}

// Parallax defaults (fallback if project specs lack previewDepth)
const FALLBACK = {
  depthSpreadIn: 3.0,
  layerSpreadIn: 1.0,
  jitterIn: 0.25,
  perspectiveFactor: 1.0,
};

// Vertical raise (in inches) when projecting depth: how much closer strands lift up visually
const DEPTH_RAISE_IN = 0.8;
const LAYER_RAISE_IN = 0.15;
const STRAND_JITTER_Y_IN = 0.12;

function hashStringTo01(s: string): number {
  // djb2-ish hash -> deterministic pseudo-random in [0,1)
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  // keep positive
  h = Math.abs(h);
  return (h % 1000000) / 1000000;
}

/**
 * projectX: returns a parallax-adjusted x (in inches) for previews.
 * side: "front" or "back" determines mirroring.
 * anchorId optional: used to produce a stable jitter per-anchor.
 */
export function projectX(
  specs: ProjectSpecs,
  anchorXIn: number,
  anchorYIn: number,
  layer: string,
  side: "front" | "back",
  anchorId?: string,
): number {
  const pd = specs.previewDepth ?? FALLBACK;
  const d01 = depth01(specs, anchorYIn);
  const d = d01 - 0.5;
  const parallax = d * (pd.depthSpreadIn ?? FALLBACK.depthSpreadIn);
  const layerShift = layer === "front" ? -(pd.layerSpreadIn ?? FALLBACK.layerSpreadIn) : layer === "back" ? (pd.layerSpreadIn ?? FALLBACK.layerSpreadIn) : 0;
  const jitter = anchorId ? (hashStringTo01(anchorId) - 0.5) * (pd.jitterIn ?? FALLBACK.jitterIn) : 0;
  const shift = parallax + layerShift + jitter;
  // For back side, mirror the shift to the opposite direction so back previews offset oppositely.
  return side === "front" ? anchorXIn + shift : anchorXIn - shift;
}

/**
 * projectY: returns a vertical raise (in inches) to subtract from rendered y positions.
 * The returned value should be subtracted from preview y coordinates to raise the strand up.
 */
export function projectY(
  specs: ProjectSpecs,
  anchorYIn: number,
  layer: string,
  anchorId?: string,
): number {
  const pd = specs.previewDepth ?? FALLBACK;
  const d01 = depth01(specs, anchorYIn);
  const raise = d01 * DEPTH_RAISE_IN * (pd.perspectiveFactor ?? 1);
  const layerLift = (layer === "front" ? LAYER_RAISE_IN : layer === "back" ? -LAYER_RAISE_IN : 0) * (pd.perspectiveFactor ?? 1);
  const jitterY = anchorId ? (hashStringTo01(anchorId) - 0.5) * STRAND_JITTER_Y_IN * (pd.perspectiveFactor ?? 1) : 0;
  return raise + layerLift + jitterY;
}

export default {
  clamp01,
  depth01,
  projectX,
};
